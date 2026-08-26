import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import { aIdOpcional } from '../common/validacion';

/** Lo que se devuelve de un ciclo. Nunca la fila cruda. */
const SELECT_CICLO = {
  id: true,
  numero: true,
  abiertoEn: true,
  cerradoEn: true,
  estado: { select: { id: true, nombre: true, color: true, activo: true } },
  abiertoPor: { select: { id: true, nombre: true } },
  cerradoPor: { select: { id: true, nombre: true } },
  _count: { select: { actividades: true } },
} as const;

/**
 * Los ciclos de un equipo: el historial de visitas (Fase 1 del rediseño).
 *
 * Un equipo deja de tener UN set fijo de actividades y pasa a tener una
 * secuencia de visitas, cada una con su fecha, su estado y su checklist.
 *
 * ⚠️ **Dos candados distintos, y no hay que confundirlos.** Una rama
 * ARCHIVADA es una obra terminada: nadie escribe en ninguna de sus
 * carpetas. Un ciclo CERRADO es una visita terminada: ese ciclo concreto ya
 * no se toca, pero el equipo sigue vivo y admite abrir el siguiente. Los dos
 * pueden decir que no por separado, y por eso se comprueban por separado.
 */
@Injectable()
export class CicloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /**
   * La carpeta, exigiendo permiso y que sea un EQUIPO.
   *
   * Los ciclos son de un equipo: una carpeta corriente no los tiene, igual
   * que no tiene actividades. Lectura estricta, como §13.
   */
  private async exigirEquipo(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    minimo: 'LECTURA' | 'EDICION' | 'TOTAL',
  ) {
    const carpeta = await this.acceso.exigirPermiso(usuario, carpetaId, minimo);
    if (carpeta.tipo !== 'EQUIPO')
      throw new BadRequestException(
        'Los ciclos son de las carpetas de tipo Equipo. Esta no lo es.',
      );
    return carpeta;
  }

  /** El historial completo, del más reciente al más antiguo. */
  async listar(usuario: UsuarioAutenticado, carpetaId: number) {
    await this.exigirEquipo(usuario, carpetaId, 'LECTURA');
    return this.prisma.cicloFotos.findMany({
      where: { carpetaId },
      orderBy: { numero: 'desc' },
      select: SELECT_CICLO,
    });
  }

  /**
   * El ciclo MÁS RECIENTE, abierto o no.
   *
   * Es de donde salen el estado del encabezado y el de la tarjeta del
   * explorador: §7 dice «siempre el del ciclo más reciente, sea el que está
   * en curso o el último cerrado».
   */
  async masReciente(carpetaId: number) {
    return this.prisma.cicloFotos.findFirst({
      where: { carpetaId },
      orderBy: { numero: 'desc' },
      select: SELECT_CICLO,
    });
  }

  /** El que está en curso, si lo hay. Como mucho uno — lo garantiza la BD. */
  async abierto(carpetaId: number) {
    return this.prisma.cicloFotos.findFirst({
      where: { carpetaId, cerradoEn: null },
      select: SELECT_CICLO,
    });
  }

  /**
   * Crea el Ciclo 1 de un equipo recién nacido.
   *
   * Se llama desde `CarpetaService.crear`, DENTRO de su transacción: un
   * equipo sin ciclo no tendría dónde colgar sus actividades, así que los dos
   * nacen juntos o no nace ninguno.
   *
   * No comprueba permisos a propósito: quien llama acaba de decidir que esta
   * persona puede crear aquí, y la carpeta todavía no está confirmada — el
   * mismo caso, y el mismo motivo, que `ValorCampoFotosService.escribirEn`.
   */
  async abrirPrimeroEn(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    carpetaId: number,
    usuarioId: number,
  ) {
    return tx.cicloFotos.create({
      data: { carpetaId, numero: 1, abiertoPorId: usuarioId },
      select: { id: true, numero: true },
    });
  }

  /**
   * Abre una visita nueva, heredando el checklist de la anterior (§4.3).
   *
   * ⚠️ Hereda la lista de actividades TAL COMO QUEDÓ, incluidas las que se
   * añadieron o quitaron a mitad del ciclo anterior — es el checklist real de
   * ese equipo, no el que se eligió al crearlo. Lo que NO se hereda es el
   * trabajo: las actividades nacen PENDIENTES y sin fotos, sin responsable de
   * la visita pasada y sin marca de completado. Copiar eso afirmaría trabajo
   * que nadie ha hecho todavía.
   *
   * Y NO hereda el estado del equipo (§4.3, decisión explícita): el ciclo
   * nace sin estado y alguien lo define durante la visita.
   */
  async abrir(usuario: UsuarioAutenticado, carpetaId: number) {
    const carpeta = await this.exigirEquipo(usuario, carpetaId, 'EDICION');

    const enCurso = await this.prisma.cicloFotos.findFirst({
      where: { carpetaId, cerradoEn: null },
      select: { id: true, numero: true },
    });
    if (enCurso)
      throw new BadRequestException(
        `El ciclo ${enCurso.numero} sigue abierto. Ciérralo antes de empezar otra visita.`,
      );

    const ultimo = await this.prisma.cicloFotos.findFirst({
      where: { carpetaId },
      orderBy: { numero: 'desc' },
      select: { id: true, numero: true },
    });

    // El checklist que se hereda: el del último ciclo, en su orden.
    const plantilla = ultimo
      ? await this.prisma.actividadFotos.findMany({
          where: { cicloId: ultimo.id },
          orderBy: { id: 'asc' },
          // ⚠️ `evidencia` también viaja: es parte del checklist —qué hay que
          // fotografiar en esta actividad—, no del trabajo hecho. Sin ella,
          // cada visita nueva volvería al defecto y se perdería que a esta
          // actividad concreta se le pide un antes y un después.
          select: {
            titulo: true,
            descripcion: true,
            prioridad: true,
            evidencia: true,
          },
        })
      : [];

    const creado = await this.prisma.$transaction(async (tx) => {
      const ciclo = await tx.cicloFotos.create({
        data: {
          carpetaId,
          numero: (ultimo?.numero ?? 0) + 1,
          abiertoPorId: usuario.id,
        },
        select: { id: true, numero: true },
      });

      if (plantilla.length > 0)
        await tx.actividadFotos.createMany({
          data: plantilla.map((a) => ({
            cicloId: ciclo.id,
            titulo: a.titulo,
            descripcion: a.descripcion,
            prioridad: a.prioridad,
            evidencia: a.evidencia,
            creadoPorId: usuario.id,
          })),
        });

      return ciclo;
    });

    await this.acceso.marcarActividad(carpeta.ruta);
    await this.auditoria.registrar(usuario, {
      carpetaId,
      entidad: 'CICLO',
      entidadId: creado.id,
      accion: 'CICLO_ABIERTO',
      descripcion:
        `Abrió el ciclo ${creado.numero} de "${carpeta.nombre}"` +
        (plantilla.length > 0
          ? `, heredando ${plantilla.length} actividad(es).`
          : '.'),
    });

    return this.detalle(usuario, creado.id);
  }

  /**
   * Cierra el ciclo: a partir de aquí es historial.
   *
   * ⚠️ Lo cierra quien tenga EDICION, pero una vez cerrado **no lo edita
   * nadie, tampoco un ADMIN_GLOBAL**. Esa asimetría es deliberada: el valor
   * del historial está en que nadie pueda retocarlo después, y una excepción
   * para el administrador es exactamente la excepción que lo vacía de
   * sentido. Para corregir hay que REABRIR, y eso deja rastro.
   */
  async cerrar(usuario: UsuarioAutenticado, cicloId: number) {
    const ciclo = await this.exigirCiclo(usuario, cicloId, 'EDICION');
    if (ciclo.cerradoEn)
      throw new BadRequestException(
        `El ciclo ${ciclo.numero} ya estaba cerrado.`,
      );

    await this.prisma.cicloFotos.update({
      where: { id: cicloId },
      data: { cerradoEn: new Date(), cerradoPorId: usuario.id },
    });

    await this.acceso.marcarActividad(ciclo.carpeta.ruta);
    await this.auditoria.registrar(usuario, {
      carpetaId: ciclo.carpetaId,
      entidad: 'CICLO',
      entidadId: cicloId,
      accion: 'CICLO_CERRADO',
      descripcion: `Cerró el ciclo ${ciclo.numero} de "${ciclo.carpeta.nombre}".`,
    });

    return this.detalle(usuario, cicloId);
  }

  /**
   * Reabre un ciclo cerrado. Excepcional, y por eso deja su propia huella.
   *
   * ⚠️ Choca con el invariante de «un solo ciclo abierto»: si ya hay uno en
   * curso, reabrir uno viejo dejaría dos. Se rechaza aquí con un mensaje que
   * lo explica, y si aun así se colara, el índice parcial de la base lo
   * pararía —que es justo para lo que está—.
   */
  async reabrir(usuario: UsuarioAutenticado, cicloId: number) {
    const ciclo = await this.exigirCiclo(usuario, cicloId, 'EDICION');
    if (!ciclo.cerradoEn)
      throw new BadRequestException(
        `El ciclo ${ciclo.numero} ya está abierto.`,
      );

    const otroAbierto = await this.prisma.cicloFotos.findFirst({
      where: { carpetaId: ciclo.carpetaId, cerradoEn: null },
      select: { numero: true },
    });
    if (otroAbierto)
      throw new BadRequestException(
        `No se puede reabrir: el ciclo ${otroAbierto.numero} está en curso. ` +
          'Un equipo solo puede tener una visita abierta a la vez.',
      );

    await this.prisma.cicloFotos.update({
      where: { id: cicloId },
      data: { cerradoEn: null, cerradoPorId: null },
    });

    await this.acceso.marcarActividad(ciclo.carpeta.ruta);
    await this.auditoria.registrar(usuario, {
      carpetaId: ciclo.carpetaId,
      entidad: 'CICLO',
      entidadId: cicloId,
      accion: 'CICLO_REABIERTO',
      descripcion:
        `Reabrió el ciclo ${ciclo.numero} de "${ciclo.carpeta.nombre}", ` +
        'que estaba cerrado.',
    });

    return this.detalle(usuario, cicloId);
  }

  /** Define o cambia el estado del equipo en este ciclo (§7). */
  async cambiarEstado(
    usuario: UsuarioAutenticado,
    cicloId: number,
    estadoCrudo: unknown,
  ) {
    const ciclo = await this.exigirCiclo(usuario, cicloId, 'EDICION');
    this.exigirAbierto(ciclo);

    const estadoId = aIdOpcional(
      estadoCrudo,
      'El estado indicado no es válido.',
    );

    if (estadoId !== null) {
      const estado = await this.prisma.estadoEquipoFotos.findUnique({
        where: { id: estadoId },
        select: { id: true, nombre: true, activo: true },
      });
      if (!estado)
        throw new NotFoundException('Ese estado de equipo ya no existe.');
      // Un estado retirado no se puede volver a elegir, pero el ciclo que ya
      // lo tenía lo conserva: `activo` retira del formulario, no reescribe.
      if (!estado.activo)
        throw new BadRequestException(
          `El estado "${estado.nombre}" está retirado y ya no se puede asignar.`,
        );
    }

    const anterior = ciclo.estado?.nombre ?? '(sin definir)';
    await this.prisma.cicloFotos.update({
      where: { id: cicloId },
      data: { estadoId },
    });

    const actualizado = await this.detalle(usuario, cicloId);
    await this.auditoria.registrar(usuario, {
      carpetaId: ciclo.carpetaId,
      entidad: 'CICLO',
      entidadId: cicloId,
      accion: 'EDICION',
      campoAfectado: 'estado',
      valorAnterior: anterior,
      valorNuevo: actualizado.estado?.nombre ?? '(sin definir)',
      descripcion:
        `Cambió el estado del equipo en el ciclo ${ciclo.numero}: ` +
        `${anterior} → ${actualizado.estado?.nombre ?? '(sin definir)'}.`,
    });
    return actualizado;
  }

  // ── Auxiliares que usan los demás services ────────────────────

  async detalle(usuario: UsuarioAutenticado, cicloId: number) {
    const ciclo = await this.exigirCiclo(usuario, cicloId, 'LECTURA');
    return {
      id: ciclo.id,
      numero: ciclo.numero,
      abiertoEn: ciclo.abiertoEn,
      cerradoEn: ciclo.cerradoEn,
      estado: ciclo.estado,
      abiertoPor: ciclo.abiertoPor,
      cerradoPor: ciclo.cerradoPor,
      carpetaId: ciclo.carpetaId,
    };
  }

  /**
   * El ciclo por id, con su carpeta y el permiso ya exigido.
   *
   * La negativa es el 404 uniforme del módulo cuando no se ve la carpeta:
   * un 403 confirmaría que el ciclo existe.
   */
  async exigirCiclo(
    usuario: UsuarioAutenticado,
    cicloId: number,
    minimo: 'LECTURA' | 'EDICION' | 'TOTAL',
  ) {
    const ciclo = await this.prisma.cicloFotos.findUnique({
      where: { id: cicloId },
      select: {
        id: true,
        numero: true,
        carpetaId: true,
        abiertoEn: true,
        cerradoEn: true,
        estado: {
          select: { id: true, nombre: true, color: true, activo: true },
        },
        abiertoPor: { select: { id: true, nombre: true } },
        cerradoPor: { select: { id: true, nombre: true } },
      },
    });
    if (!ciclo)
      throw new NotFoundException('Ese ciclo no existe o no tienes acceso.');

    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      ciclo.carpetaId,
      minimo,
    );
    return { ...ciclo, carpeta };
  }

  /**
   * El candado del historial: en un ciclo cerrado no se escribe.
   *
   * Lo llaman `ActividadService` y todo lo que cuelgue de un ciclo. Va
   * aparte de `exigirPermiso` a propósito: el permiso responde «quién eres»
   * y esto responde «este ciclo ya terminó», que son dos preguntas
   * distintas — y por eso el mensaje nombra la salida real, que es reabrir.
   */
  exigirAbierto(ciclo: { numero: number; cerradoEn: Date | null }) {
    if (ciclo.cerradoEn)
      throw new BadRequestException(
        `El ciclo ${ciclo.numero} está cerrado y no admite cambios. ` +
          'Si hay que corregir algo, reábrelo primero: queda registrado.',
      );
  }
}
