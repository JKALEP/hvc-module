import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CorreoService } from '../common/correo.service';
import { AccesoService } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import type { PermisoCarpeta } from '../../generated/prisma/enums';
import { limpiar, describir } from '../common/texto';
import { aFechaUTC } from '../common/fechas';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * «Compartir»: correo primero, carpetas después.
 *
 * El flujo es un solo paso — se escribe un correo, se marcan una o
 * varias carpetas y se confirma— y NO obliga a navegar hasta cada
 * carpeta para compartirla desde dentro.
 *
 * Quien comparte tampoco elige entre "colaborador interno" e "invitación
 * externa": eso lo decide el sistema según exista o no la cuenta. Pedirle
 * esa decisión sería pedirle que sepa algo que el sistema ya sabe.
 *
 * Solo se comparten CARPETAS. Un álbum de fotos nunca se comparte suelto:
 * vive dentro de una carpeta y hereda su acceso.
 */

/** Días que vive un enlace de invitación. Sobrevive a un puente. */
const DIAS_VIGENCIA = 7;

/** Formato genérico: cualquier dominio. El verificado es el del remitente. */
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Los grados que se pueden CONCEDER al compartir (§10).
 *
 * `SIN_ACCESO` queda fuera a propósito: no es un grado que se conceda sino
 * la restricción explícita de §7, que se pone sobre una subcarpeta de algo
 * ya compartido. «Compartir sin acceso» no significa nada.
 */
const GRADOS_OTORGABLES = ['LECTURA', 'EDICION', 'TOTAL'] as const;

export type ResultadoCompartir = {
  via: 'acceso-directo' | 'invitacion';
  email: string;
  /** Quién es, si ya tenía cuenta. */
  nombre?: string;
  rol?: string;
  /** Solo en invitación. */
  enlace?: string;
  expiraEn?: Date;
  /** Carpetas que quedaron efectivamente compartidas ahora. */
  carpetas: { id: number; nombre: string }[];
  /** Las que ya tenía y se dejaron como estaban. */
  yaTenia: { id: number; nombre: string }[];
};

@Injectable()
export class CompartirService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  private normalizar(email: unknown): string {
    if (typeof email !== 'string')
      throw new BadRequestException('El correo es obligatorio.');
    const limpio = email.trim().toLowerCase();
    if (!FORMATO_EMAIL.test(limpio))
      throw new BadRequestException(
        `"${limpio}" no parece un correo válido. Revisa que tenga el formato nombre@dominio.com.`,
      );
    return limpio;
  }

  /**
   * Carpetas que quien comparte puede ofrecer en el selector.
   *
   * Solo aquéllas donde tiene **TOTAL**: §5 le da «compartir, administrar
   * colaboradores de esa carpeta y cambiar permisos» a Acceso Total y no al
   * Editor. Eso ENDURECE v2, donde cualquier interno con acceso podía
   * repartir lo que alcanzaba.
   *
   * El `where` es solo un prefiltro —no sabe de la cascada—, así que cada
   * fila pasa después por `permisoSobre` contra el alcance ya cargado.
   */
  async carpetasQuePuedeCompartir(usuario: UsuarioAutenticado) {
    if (this.acceso.esCliente(usuario))
      throw new ForbiddenException('Tu cuenta no puede compartir.');

    const alcance = await this.acceso.alcanceDe(usuario);
    const candidatas = await this.prisma.carpetaFotos.findMany({
      where: this.acceso.prefiltroDeCarpetas(alcance),
      orderBy: { ruta: 'asc' },
      select: { id: true, nombre: true, parentId: true, ruta: true },
    });

    return candidatas.filter((c) =>
      this.acceso.alcanza(this.acceso.permisoSobre(alcance, c.ruta), 'TOTAL'),
    );
  }

  /**
   * Valida las carpetas elegidas y el grado que se quiere otorgar sobre
   * cada una (§10, §26.8).
   *
   * El grado se comprueba carpeta a carpeta y no una vez: quien comparte
   * puede tener TOTAL en una y solo EDICION en otra, y una única
   * comprobación global dejaría pasar la segunda.
   */
  private async resolverCarpetas(
    usuario: UsuarioAutenticado,
    carpetaIds: unknown,
    permiso: PermisoCarpeta,
  ) {
    const ids = Array.isArray(carpetaIds)
      ? carpetaIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (ids.length === 0)
      throw new BadRequestException('Elige al menos una carpeta.');

    const carpetas = await this.prisma.carpetaFotos.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, nombre: true, ruta: true },
    });
    if (carpetas.length !== new Set(ids).size)
      throw new NotFoundException('Alguna de las carpetas ya no existe.');

    for (const c of carpetas)
      await this.acceso.exigirPuedeOtorgar(usuario, c.id, permiso);

    return carpetas;
  }

  /**
   * El grado que se está otorgando, validado.
   *
   * `SIN_ACCESO` NO se admite al COMPARTIR: es la restricción explícita de
   * §7 y se pone sobre una carpeta que ya está dentro de algo compartido,
   * no «compartiendo sin acceso», que no significa nada. Su puerta es
   * `cambiarGrado`, que sí lo acepta con `admitirSinAcceso`.
   */
  private permisoValido(
    valor: unknown,
    opciones: { admitirSinAcceso?: boolean } = {},
  ): PermisoCarpeta {
    const admitidos = opciones.admitirSinAcceso
      ? [...GRADOS_OTORGABLES, 'SIN_ACCESO']
      : [...GRADOS_OTORGABLES];

    const s = limpiar(valor)?.toUpperCase();
    if (!s || !admitidos.includes(s))
      throw new BadRequestException(
        `Permiso inválido: "${describir(valor)}". Valores permitidos: ${admitidos.join(', ')}.`,
      );
    return s as PermisoCarpeta;
  }

  /**
   * La fecha de caducidad del ENLACE de invitación (§9).
   *
   * Opcional: sin ella valen los {@link DIAS_VIGENCIA} días de siempre. §9
   * pide en su paso 3 una «fecha de expiración opcional» y su apartado
   * «Importante» exige que el token caduque SIEMPRE — de ahí que esto sea un
   * override del plazo por defecto y no un permiso para no caducar.
   *
   * ⚠️ §9 no dice si esa fecha caduca el ENLACE o el ACCESO concedido. Se
   * implementó lo primero, que es lo que su propio apartado «Importante»
   * respalda —habla del token— y lo que no obliga a que cada comprobación de
   * permiso mire un reloj. Un acceso con caducidad sería
   * `AccesoCompartido.expiraEn` y tocaría la cascada de §25 entera; si HVC
   * lo quiere, es otra fase.
   */
  private vigenciaValida(valor: unknown): Date {
    const porDefecto = new Date(
      Date.now() + DIAS_VIGENCIA * 24 * 60 * 60 * 1000,
    );
    const texto = limpiar(valor);
    if (texto === null) return porDefecto;

    const fecha = aFechaUTC(texto, 'La fecha de expiración');
    // Fin del día: quien escribe «el 20» espera que valga todo el 20.
    fecha.setUTCHours(23, 59, 59, 999);

    if (fecha.getTime() <= Date.now())
      throw new BadRequestException(
        'La fecha de expiración ya pasó. Elige una futura o déjala vacía.',
      );
    return fecha;
  }

  /**
   * Con quién está compartida una carpeta: cuentas activas + invitaciones
   * (§10).
   *
   * Exige TOTAL, no LECTURA: la lista de colaboradores con sus correos es
   * parte de administrar la carpeta, y quien solo puede mirar las fotos no
   * tiene por qué saber a qué otros clientes se les compartió.
   */
  async listar(usuario: UsuarioAutenticado, carpetaId: number) {
    await this.acceso.exigirPermiso(usuario, carpetaId, 'TOTAL');

    const [accesos, invitaciones] = await Promise.all([
      this.prisma.accesoCompartido.findMany({
        where: { carpetaId },
        orderBy: { creadoEn: 'asc' },
        select: {
          id: true,
          creadoEn: true,
          permiso: true,
          usuario: {
            select: { id: true, nombre: true, email: true, rol: true },
          },
          otorgadoPor: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.invitacionCliente.findMany({
        where: { estado: 'PENDIENTE', carpetas: { some: { carpetaId } } },
        orderBy: { creadoEn: 'asc' },
        select: {
          id: true,
          email: true,
          expiraEn: true,
          creadoEn: true,
          invitadoPor: { select: { id: true, nombre: true } },
          carpetas: {
            where: { carpetaId },
            select: { permiso: true },
          },
        },
      }),
    ]);

    const ahora = new Date();
    return {
      // `permiso` va tal cual: la UI lo traduce, y el service no debe
      // inventar una segunda escala de nombres para lo mismo. En v2 aquí se
      // derivaba un 'ver' / 'ver-y-organizar' del ROL, que era la única
      // pista disponible cuando el grado no se guardaba.
      accesos,
      invitaciones: invitaciones.map((i) => ({
        id: i.id,
        email: i.email,
        expiraEn: i.expiraEn,
        creadoEn: i.creadoEn,
        invitadoPor: i.invitadoPor,
        permiso: i.carpetas[0]?.permiso ?? null,
        vencida: i.expiraEn < ahora,
      })),
    };
  }

  /**
   * Cambiar el grado de alguien sobre una carpeta (§10, «cambiar permiso»).
   *
   * Es una acción PROPIA y no «volver a compartir»: `compartir()` reparte un
   * grado a N carpetas y falla si ya había acceso, porque su trabajo es dar
   * de alta. Aquí hay una fila que ya existe y lo único que cambia es su
   * valor; mezclarlo en `compartir` habría convertido el «ya tenía acceso» en
   * una actualización silenciosa, que es justo lo que no quieres cuando te
   * equivocas de correo.
   *
   * ⚠️ **Aquí SÍ se admite `SIN_ACCESO`**, al revés que en `compartir`. Es la
   * restricción explícita de §7 —«Proyecto A → Lectura, pero Inspecciones →
   * Sin acceso»— y solo tiene sentido sobre una carpeta a la que ya se llega
   * por herencia: «compartir sin acceso» no significa nada, pero «bajar a sin
   * acceso lo que heredaba lectura» sí. Era el hueco que quedaba desde la
   * Fase 2.
   *
   * El techo de §26.8 lo sigue poniendo `exigirPuedeOtorgar`.
   */
  async cambiarGrado(
    quienComparte: UsuarioAutenticado,
    carpetaId: number,
    usuarioId: number,
    permisoCrudo: unknown,
    /** §23 pide IP «si corresponde», y aquí corresponde. */
    ip?: string | null,
  ) {
    if (this.acceso.esCliente(quienComparte))
      throw new ForbiddenException('Tu cuenta no puede cambiar permisos.');

    const permiso = this.permisoValido(permisoCrudo, {
      admitirSinAcceso: true,
    });
    await this.acceso.exigirPuedeOtorgar(quienComparte, carpetaId, permiso);

    if (usuarioId === quienComparte.id)
      throw new BadRequestException(
        'No puedes cambiarte el permiso a ti mismo.',
      );

    const destino = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, nombre: true },
    });
    if (!destino) throw new NotFoundException('Esa cuenta ya no existe.');

    const existente = await this.prisma.accesoCompartido.findUnique({
      where: { usuarioId_carpetaId: { usuarioId, carpetaId } },
      select: { id: true, permiso: true },
    });

    // Una restricción de §7 se PONE donde no había fila: la carpeta se
    // alcanzaba por herencia. Por eso esto es un upsert y no un update.
    const acceso = await this.prisma.accesoCompartido.upsert({
      where: { usuarioId_carpetaId: { usuarioId, carpetaId } },
      create: {
        usuarioId,
        carpetaId,
        permiso,
        otorgadoPorId: quienComparte.id,
      },
      update: { permiso, otorgadoPorId: quienComparte.id },
      select: {
        id: true,
        permiso: true,
        creadoEn: true,
        usuario: { select: { id: true, nombre: true, email: true, rol: true } },
        otorgadoPor: { select: { id: true, nombre: true } },
      },
    });

    // §23, acción 9. Con IP: repartir accesos es de lo más sensible que
    // hace el módulo, y es justo donde «quién fue» tiene que ser rastreable.
    await this.auditoria.registrar(quienComparte, {
      carpetaId,
      entidad: 'ACCESO',
      entidadId: acceso.id,
      accion: 'CAMBIO_PERMISO',
      campoAfectado: 'permiso',
      valorAnterior: existente?.permiso ?? null,
      valorNuevo: permiso,
      descripcion: `${permiso === 'SIN_ACCESO' ? 'Restringió' : 'Cambió el permiso'} de ${destino.nombre}.`,
      ip,
    });

    return {
      ...acceso,
      anterior: existente?.permiso ?? null,
      /** true si la fila se creó para restringir algo que se heredaba (§7). */
      esRestriccionNueva: !existente && permiso === 'SIN_ACCESO',
    };
  }

  /** El flujo: un correo, N carpetas, UN grado (§10). */
  async compartir(
    quienComparte: UsuarioAutenticado,
    emailCrudo: unknown,
    carpetaIds: unknown,
    permisoCrudo: unknown,
    /** §9: fecha de caducidad del enlace. Sin ella, el plazo por defecto. */
    expiraEnCrudo?: unknown,
    nombreCrudo?: unknown,
    /** §23 pide IP «si corresponde»: compartir es de las sensibles. */
    ip?: string | null,
  ): Promise<ResultadoCompartir> {
    if (this.acceso.esCliente(quienComparte))
      throw new ForbiddenException('Tu cuenta no puede compartir.');

    const email = this.normalizar(emailCrudo);
    const permiso = this.permisoValido(permisoCrudo);
    // Se valida SIEMPRE, aunque el correo ya tenga cuenta y no vaya a hacer
    // falta: una fecha inválida debe fallar antes de conceder nada, no
    // después de haber creado los accesos.
    const expiraEn = this.vigenciaValida(expiraEnCrudo);
    const carpetas = await this.resolverCarpetas(
      quienComparte,
      carpetaIds,
      permiso,
    );

    const existente = await this.prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        estado: true,
        permisos: { select: { modulo: true, nivelFotos: true } },
      },
    });

    if (existente) {
      if (existente.estado !== 'ACTIVO')
        throw new BadRequestException(
          `La cuenta de ${existente.nombre} está desactivada. Reactívala antes de compartirle nada.`,
        );
      if (existente.id === quienComparte.id)
        throw new BadRequestException('No hace falta compartirte algo a ti.');

      const permisoFotos = existente.permisos.find((p) => p.modulo === 'FOTOS');
      if (existente.rol !== 'CLIENTE') {
        if (
          existente.rol === 'SUPERADMIN' ||
          permisoFotos?.nivelFotos === 'ADMIN_GLOBAL'
        )
          throw new BadRequestException(
            `${existente.nombre} ya ve todo el módulo Fotos por su rol: no hace falta compartirle nada.`,
          );
        if (!permisoFotos)
          throw new BadRequestException(
            `${existente.nombre} tiene cuenta en el sistema pero no el módulo Fotos. El SuperAdmin debe asignárselo antes.`,
          );
      }

      const yaTeniaIds = new Set(
        (
          await this.prisma.accesoCompartido.findMany({
            where: {
              usuarioId: existente.id,
              carpetaId: { in: carpetas.map((c) => c.id) },
            },
            select: { carpetaId: true },
          })
        ).map((a) => a.carpetaId),
      );

      const nuevas = carpetas.filter((c) => !yaTeniaIds.has(c.id));
      if (nuevas.length > 0)
        await this.prisma.accesoCompartido.createMany({
          data: nuevas.map((c) => ({
            usuarioId: existente.id,
            carpetaId: c.id,
            otorgadoPorId: quienComparte.id,
            permiso,
          })),
        });

      if (nuevas.length === 0)
        throw new BadRequestException(
          `${existente.nombre} ya tenía acceso a ${carpetas.length === 1 ? 'esa carpeta' : 'todas esas carpetas'}.`,
        );

      // A un cliente se le avisa; un interno lo verá al entrar.
      //
      // Se espera al envío pero NO se comprueba si salió: el acceso ya
      // está concedido y el aviso es cortesía. Si el correo falla, el
      // cliente entra igual con su cuenta de siempre.
      if (existente.rol === 'CLIENTE')
        await this.correo.enviarAvisoDeAcceso({
          para: email,
          recurso: nuevas.map((c) => c.nombre).join(', '),
          invitadoPor: quienComparte.nombre,
          enlace: this.correo.enlaceDelPortal(),
        });

      // §23, acción 8, por el camino del acceso directo.
      await this.auditoria.registrar(quienComparte, {
        carpetaId: nuevas[0].id,
        entidad: 'ACCESO',
        entidadId: existente.id,
        accion: 'COMPARTIR',
        valorNuevo: permiso,
        descripcion: `Compartió ${nuevas.length} carpeta(s) con ${existente.email} (${permiso}).`,
        ip,
      });

      return {
        via: 'acceso-directo',
        email: existente.email,
        nombre: existente.nombre,
        rol: existente.rol,
        carpetas: nuevas.map((c) => ({ id: c.id, nombre: c.nombre })),
        yaTenia: carpetas
          .filter((c) => yaTeniaIds.has(c.id))
          .map((c) => ({ id: c.id, nombre: c.nombre })),
      };
    }

    return this.invitar(
      quienComparte,
      email,
      carpetas.map((c) => ({ ...c, permiso })),
      expiraEn,
      limpiar(nombreCrudo),
      ip,
    );
  }

  /**
   * Crea o refresca la invitación. UN token para TODAS las carpetas:
   * mandarle tres enlaces distintos al mismo cliente sería absurdo.
   *
   * El grado viene POR CARPETA y no uno para toda la invitación, aunque
   * `compartir` mande el mismo en todas: `InvitacionCarpeta.permiso` es por
   * fila, y un reenvío tiene que poder devolver los grados que ya estaban
   * guardados sin aplanarlos a uno.
   */
  private async invitar(
    quienComparte: UsuarioAutenticado,
    email: string,
    carpetas: { id: number; nombre: string; permiso: PermisoCarpeta }[],
    /** §9: caducidad del enlace, ya validada por `vigenciaValida`. */
    expiraEn: Date,
    /** §9 lo pide opcional: quien comparte no siempre sabe el nombre. */
    nombre: string | null,
    ip?: string | null,
  ): Promise<ResultadoCompartir> {
    // El token viaja en el enlace; en la BD solo su hash. Un enlace es
    // una credencial, y las credenciales no se guardan en claro.
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Si ya había una pendiente para ese correo se reutiliza y se le
    // SUMAN las carpetas nuevas: acumular invitaciones al mismo correo
    // solo multiplica enlaces vivos.
    const pendiente = await this.prisma.invitacionCliente.findFirst({
      where: { email, estado: 'PENDIENTE' },
      select: { id: true, carpetas: { select: { carpetaId: true } } },
    });

    const invitacionId = pendiente
      ? (
          await this.prisma.invitacionCliente.update({
            where: { id: pendiente.id },
            data: {
              tokenHash,
              expiraEn,
              invitadoPorId: quienComparte.id,
              // Solo si llega: reenviar no debe borrar el nombre que se
              // escribió al invitar.
              ...(nombre !== null ? { nombre } : {}),
            },
            select: { id: true },
          })
        ).id
      : (
          await this.prisma.invitacionCliente.create({
            data: {
              email,
              nombre,
              tokenHash,
              expiraEn,
              invitadoPorId: quienComparte.id,
            },
            select: { id: true },
          })
        ).id;

    const yaEstaban = new Set(
      pendiente?.carpetas.map((c) => c.carpetaId) ?? [],
    );
    const nuevas = carpetas.filter((c) => !yaEstaban.has(c.id));
    if (nuevas.length > 0)
      await this.prisma.invitacionCarpeta.createMany({
        data: nuevas.map((c) => ({
          invitacionId,
          carpetaId: c.id,
          // El grado viaja EN la invitación desde que se envía: aceptarla
          // solo lo copia (ver `InvitacionService`). Decidirlo al aceptar
          // convertiría el enlace en algo que concede un acceso distinto
          // del que se prometió.
          permiso: c.permiso,
        })),
      });

    const enlace = this.correo.enlaceDeInvitacion(token);
    // La invitación ya está guardada: si el correo no sale, el enlace se
    // devuelve igual y quien comparte puede pasarlo a mano. Por eso no
    // se mira el resultado ni se deshace nada.
    await this.correo.enviarCorreoInvitacion({
      para: email,
      recurso: carpetas.map((c) => c.nombre).join(', '),
      invitadoPor: quienComparte.nombre,
      enlace,
      expiraEn,
    });

    // §23, acción 8 por el camino de la invitación (la 12 se registra al
    // aceptarla, que es otro momento y otra persona).
    await this.auditoria.registrar(quienComparte, {
      carpetaId: carpetas[0].id,
      entidad: 'INVITACION',
      entidadId: invitacionId,
      accion: 'INVITACION_ENVIADA',
      descripcion: `Invitó a ${email} a ${carpetas.length} carpeta(s).`,
      ip,
    });

    return {
      via: 'invitacion',
      email,
      enlace,
      expiraEn,
      carpetas: carpetas.map((c) => ({ id: c.id, nombre: c.nombre })),
      yaTenia: [],
    };
  }

  /**
   * Deja de compartir una carpeta con alguien (§10: revocar acceso).
   *
   * Exige TOTAL, igual que otorgar: §5 mete «administrar colaboradores» y
   * «cambiar permisos» en el mismo grado, y poder revocar con menos del que
   * hace falta para conceder dejaría a un Editor echando a los invitados de
   * quien sí administra la carpeta.
   */
  async quitarAcceso(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    usuarioId: number,
    /** §23 pide IP «si corresponde»: revocar es de las sensibles. */
    ip?: string | null,
  ) {
    if (usuarioId === usuario.id)
      throw new BadRequestException(
        'No puedes quitarte tu propio acceso: te dejarías fuera sin poder volver.',
      );

    await this.acceso.exigirPermiso(usuario, carpetaId, 'TOTAL');

    const acceso = await this.prisma.accesoCompartido.findFirst({
      where: { carpetaId, usuarioId },
      select: { id: true },
    });
    if (!acceso)
      throw new NotFoundException('Esa persona no tiene acceso a esto.');

    await this.prisma.accesoCompartido.delete({ where: { id: acceso.id } });

    // §23, acción 10. `entidadId` es el del ACCESO borrado: sirve para
    // encadenar «se le dio → se le quitó» sobre la misma fila.
    await this.auditoria.registrar(usuario, {
      carpetaId,
      entidad: 'ACCESO',
      entidadId: acceso.id,
      accion: 'REVOCAR_ACCESO',
      descripcion: 'Revocó el acceso de un colaborador.',
      ip,
    });
    return { ok: true };
  }

  /**
   * Reenvía: token nuevo, el anterior deja de valer.
   *
   * Los grados NO se recalculan: se devuelven los que ya estaban guardados
   * por carpeta. Reenviar es volver a mandar el mismo enlace, no
   * renegociar lo que concede.
   */
  async reenviar(
    usuario: UsuarioAutenticado,
    invitacionId: number,
    ip?: string | null,
  ) {
    const inv = await this.exigirPuedeAdministrarInvitacion(
      usuario,
      invitacionId,
    );

    // Reenviar NO recalcula el grado —viaja en la invitación desde que se
    // envió (§9)— pero sí renueva el plazo: un enlace caducado se reenvía
    // justamente para que vuelva a servir.
    return this.invitar(
      usuario,
      inv.email,
      inv.carpetas.map((c) => ({ ...c.carpeta, permiso: c.permiso })),
      this.vigenciaValida(null),
      null,
      ip,
    );
  }

  async cancelar(usuario: UsuarioAutenticado, invitacionId: number) {
    await this.exigirPuedeAdministrarInvitacion(usuario, invitacionId);
    await this.prisma.invitacionCliente.update({
      where: { id: invitacionId },
      data: { estado: 'CANCELADA' },
    });
    return { ok: true };
  }

  /**
   * Una invitación solo la administra quien tiene TOTAL en TODAS sus
   * carpetas.
   *
   * En TODAS y no «en alguna», que es lo que hacía v2: una invitación es un
   * único enlace que abre varias carpetas a la vez, así que reenviarla
   * vuelve a conceder todas. Con «alguna» bastaba administrar una para
   * refrescar el acceso a las demás — y para volver a dar por bueno un
   * grado que quien administra la otra carpeta quizá quería revocar.
   */
  private async exigirPuedeAdministrarInvitacion(
    usuario: UsuarioAutenticado,
    invitacionId: number,
  ) {
    if (this.acceso.esCliente(usuario))
      throw new ForbiddenException(
        'Tu cuenta no puede gestionar invitaciones.',
      );

    const inv = await this.prisma.invitacionCliente.findUnique({
      where: { id: invitacionId },
      select: {
        id: true,
        email: true,
        estado: true,
        carpetas: {
          select: {
            permiso: true,
            carpeta: { select: { id: true, nombre: true, ruta: true } },
          },
        },
      },
    });
    if (!inv) throw new NotFoundException('Esa invitación no existe.');
    if (inv.estado !== 'PENDIENTE')
      throw new BadRequestException('Esa invitación ya no está pendiente.');

    {
      const alcance = await this.acceso.alcanceDe(usuario);
      const fuera = inv.carpetas.find(
        (c) =>
          !this.acceso.alcanza(
            this.acceso.permisoSobre(alcance, c.carpeta.ruta),
            'TOTAL',
          ),
      );
      if (fuera)
        throw new ForbiddenException(
          `No administras "${fuera.carpeta.nombre}", que también va en esa invitación.`,
        );
    }

    return inv;
  }
}
