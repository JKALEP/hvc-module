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

/** Lo que se devuelve de una intervención. Nunca la fila cruda. */
const SELECT_INTERVENCION = {
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
 * Las intervenciones de un equipo: el historial de intervenciónes (Fase 1 del rediseño).
 *
 * Un equipo deja de tener UN set fijo de actividades y pasa a tener una
 * secuencia de intervenciónes, cada una con su fecha, su estado y su checklist.
 *
 * ⚠️ **Dos candados distintos, y no hay que confundirlos.** Una rama
 * ARCHIVADA es una obra terminada: nadie escribe en ninguna de sus
 * carpetas. Una intervención CERRADO es una intervención terminada: esa intervención concreto ya
 * no se toca, pero el equipo sigue vivo y admite abrir el siguiente. Los dos
 * pueden decir que no por separado, y por eso se comprueban por separado.
 */
@Injectable()
export class IntervencionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /**
   * La carpeta, exigiendo permiso y que sea un EQUIPO.
   *
   * Las intervenciones son de un equipo: una carpeta corriente no los tiene, igual
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
        'Las intervenciones son de las carpetas de tipo Equipo. Esta no lo es.',
      );
    return carpeta;
  }

  /** El historial completo, del más reciente al más antiguo. */
  async listar(usuario: UsuarioAutenticado, carpetaId: number) {
    await this.exigirEquipo(usuario, carpetaId, 'LECTURA');
    return this.prisma.intervencionFotos.findMany({
      where: { carpetaId },
      orderBy: { numero: 'desc' },
      select: SELECT_INTERVENCION,
    });
  }

  /**
   * La intervención MÁS RECIENTE, abierto o no.
   *
   * Es de donde salen el estado del encabezado y el de la tarjeta del
   * explorador: §7 dice «siempre el de la intervención más reciente, sea el que está
   * en curso o el último cerrado».
   */
  async masReciente(carpetaId: number) {
    return this.prisma.intervencionFotos.findFirst({
      where: { carpetaId },
      orderBy: { numero: 'desc' },
      select: SELECT_INTERVENCION,
    });
  }

  /** El que está en curso, si lo hay. Como mucho uno — lo garantiza la BD. */
  async abierto(carpetaId: number) {
    return this.prisma.intervencionFotos.findFirst({
      where: { carpetaId, cerradoEn: null },
      select: SELECT_INTERVENCION,
    });
  }

  /**
   * Crea el Intervención 1 de un equipo recién nacido.
   *
   * Se llama desde `CarpetaService.crear`, DENTRO de su transacción: un
   * equipo sin intervención no tendría dónde colgar sus actividades, así que los dos
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
    return tx.intervencionFotos.create({
      data: { carpetaId, numero: 1, abiertoPorId: usuarioId },
      select: { id: true, numero: true },
    });
  }

  /**
   * Abre una intervención nueva, heredando el checklist de la anterior (§4.3).
   *
   * ⚠️ Hereda la lista de actividades TAL COMO QUEDÓ, incluidas las que se
   * añadieron o quitaron a mitad de la intervención anterior — es el checklist real de
   * ese equipo, no el que se eligió al crearlo. Lo que NO se hereda es el
   * trabajo: las actividades nacen PENDIENTES y sin fotos, sin responsable de
   * la intervención pasada y sin marca de completado. Copiar eso afirmaría trabajo
   * que nadie ha hecho todavía.
   *
   * Y NO hereda el estado del equipo (§4.3, decisión explícita): la intervención
   * nace sin estado y alguien lo define durante la intervención.
   */
  async abrir(usuario: UsuarioAutenticado, carpetaId: number) {
    const carpeta = await this.exigirEquipo(usuario, carpetaId, 'EDICION');

    const enCurso = await this.prisma.intervencionFotos.findFirst({
      where: { carpetaId, cerradoEn: null },
      select: { id: true, numero: true },
    });
    if (enCurso)
      throw new BadRequestException(
        `La intervención ${enCurso.numero} sigue abierta. Ciérrala antes de empezar otra.`,
      );

    const ultimo = await this.prisma.intervencionFotos.findFirst({
      where: { carpetaId },
      orderBy: { numero: 'desc' },
      select: { id: true, numero: true },
    });

    // El checklist que se hereda: el del último intervención, en su orden.
    const plantilla = ultimo
      ? await this.prisma.actividadFotos.findMany({
          where: { intervencionId: ultimo.id },
          orderBy: { id: 'asc' },
          // ⚠️ `evidencia` también viaja: es parte del checklist —qué hay que
          // fotografiar en esta actividad—, no del trabajo hecho. Sin ella,
          // cada intervención nueva volvería al defecto y se perdería que a esta
          // actividad concreta se le pide un antes y un después.
          //
          // Y ya no hay nada más que heredar: una actividad es su título y su
          // evidencia. Aquí viajaban también descripción y prioridad.
          select: { titulo: true, evidencia: true },
        })
      : [];

    const creado = await this.prisma.$transaction(async (tx) => {
      const intervencion = await tx.intervencionFotos.create({
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
            intervencionId: intervencion.id,
            titulo: a.titulo,
            evidencia: a.evidencia,
            creadoPorId: usuario.id,
          })),
        });

      return intervencion;
    });

    await this.acceso.marcarActividad(carpeta.ruta);
    await this.auditoria.registrar(usuario, {
      carpetaId,
      entidad: 'INTERVENCION',
      entidadId: creado.id,
      accion: 'INTERVENCION_ABIERTA',
      descripcion:
        `Abrió la intervención ${creado.numero} de "${carpeta.nombre}"` +
        (plantilla.length > 0
          ? `, heredando ${plantilla.length} actividad(es).`
          : '.'),
    });

    return this.detalle(usuario, creado.id);
  }

  /**
   * Cierra la intervención: a partir de aquí es historial.
   *
   * ⚠️ Lo cierra quien tenga EDICION, pero una vez cerrado **no lo edita
   * nadie, tampoco un ADMIN_GLOBAL**. Esa asimetría es deliberada: el valor
   * del historial está en que nadie pueda retocarlo después, y una excepción
   * para el administrador es exactamente la excepción que lo vacía de
   * sentido. Para corregir hay que REABRIR, y eso deja rastro.
   */
  async cerrar(usuario: UsuarioAutenticado, intervencionId: number) {
    const intervencion = await this.exigirIntervencion(
      usuario,
      intervencionId,
      'EDICION',
    );
    if (intervencion.cerradoEn)
      throw new BadRequestException(
        `La intervención ${intervencion.numero} ya estaba cerrada.`,
      );

    await this.prisma.intervencionFotos.update({
      where: { id: intervencionId },
      data: { cerradoEn: new Date(), cerradoPorId: usuario.id },
    });

    await this.acceso.marcarActividad(intervencion.carpeta.ruta);
    await this.auditoria.registrar(usuario, {
      carpetaId: intervencion.carpetaId,
      entidad: 'INTERVENCION',
      entidadId: intervencionId,
      accion: 'INTERVENCION_CERRADA',
      descripcion: `Cerró la intervención ${intervencion.numero} de "${intervencion.carpeta.nombre}".`,
    });

    return this.detalle(usuario, intervencionId);
  }

  /**
   * Reabre una intervención cerrada. Excepcional, y por eso deja su propia huella.
   *
   * ⚠️ Choca con el invariante de «una sola intervención abierta»: si ya hay uno en
   * curso, reabrir uno viejo dejaría dos. Se rechaza aquí con un mensaje que
   * lo explica, y si aun así se colara, el índice parcial de la base lo
   * pararía —que es justo para lo que está—.
   */
  async reabrir(usuario: UsuarioAutenticado, intervencionId: number) {
    const intervencion = await this.exigirIntervencion(
      usuario,
      intervencionId,
      'EDICION',
    );
    if (!intervencion.cerradoEn)
      throw new BadRequestException(
        `La intervención ${intervencion.numero} ya está abierta.`,
      );

    const otroAbierto = await this.prisma.intervencionFotos.findFirst({
      where: { carpetaId: intervencion.carpetaId, cerradoEn: null },
      select: { numero: true },
    });
    if (otroAbierto)
      throw new BadRequestException(
        `No se puede reabrir: la intervención ${otroAbierto.numero} está en curso. ` +
          'Un equipo solo puede tener una intervención abierta a la vez.',
      );

    await this.prisma.intervencionFotos.update({
      where: { id: intervencionId },
      data: { cerradoEn: null, cerradoPorId: null },
    });

    await this.acceso.marcarActividad(intervencion.carpeta.ruta);
    await this.auditoria.registrar(usuario, {
      carpetaId: intervencion.carpetaId,
      entidad: 'INTERVENCION',
      entidadId: intervencionId,
      accion: 'INTERVENCION_REABIERTA',
      descripcion:
        `Reabrió la intervención ${intervencion.numero} de "${intervencion.carpeta.nombre}", ` +
        'que estaba cerrado.',
    });

    return this.detalle(usuario, intervencionId);
  }

  /** Define o cambia el estado del equipo en esta intervención (§7). */
  async cambiarEstado(
    usuario: UsuarioAutenticado,
    intervencionId: number,
    estadoCrudo: unknown,
  ) {
    const intervencion = await this.exigirIntervencion(
      usuario,
      intervencionId,
      'EDICION',
    );
    this.exigirAbierto(intervencion);

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
      // Un estado retirado no se puede volver a elegir, pero la intervención que ya
      // lo tenía lo conserva: `activo` retira del formulario, no reescribe.
      if (!estado.activo)
        throw new BadRequestException(
          `El estado "${estado.nombre}" está retirado y ya no se puede asignar.`,
        );
    }

    const anterior = intervencion.estado?.nombre ?? '(sin definir)';
    await this.prisma.intervencionFotos.update({
      where: { id: intervencionId },
      data: { estadoId },
    });

    const actualizado = await this.detalle(usuario, intervencionId);
    await this.auditoria.registrar(usuario, {
      carpetaId: intervencion.carpetaId,
      entidad: 'INTERVENCION',
      entidadId: intervencionId,
      accion: 'EDICION',
      campoAfectado: 'estado',
      valorAnterior: anterior,
      valorNuevo: actualizado.estado?.nombre ?? '(sin definir)',
      descripcion:
        `Cambió el estado del equipo en la intervención ${intervencion.numero}: ` +
        `${anterior} → ${actualizado.estado?.nombre ?? '(sin definir)'}.`,
    });
    return actualizado;
  }

  // ── Auxiliares que usan los demás services ────────────────────

  async detalle(usuario: UsuarioAutenticado, intervencionId: number) {
    const intervencion = await this.exigirIntervencion(
      usuario,
      intervencionId,
      'LECTURA',
    );
    return {
      id: intervencion.id,
      numero: intervencion.numero,
      abiertoEn: intervencion.abiertoEn,
      cerradoEn: intervencion.cerradoEn,
      estado: intervencion.estado,
      abiertoPor: intervencion.abiertoPor,
      cerradoPor: intervencion.cerradoPor,
      carpetaId: intervencion.carpetaId,
    };
  }

  /**
   * La intervención por id, con su carpeta y el permiso ya exigido.
   *
   * La negativa es el 404 uniforme del módulo cuando no se ve la carpeta:
   * un 403 confirmaría que la intervención existe.
   */
  async exigirIntervencion(
    usuario: UsuarioAutenticado,
    intervencionId: number,
    minimo: 'LECTURA' | 'EDICION' | 'TOTAL',
  ) {
    const intervencion = await this.prisma.intervencionFotos.findUnique({
      where: { id: intervencionId },
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
    if (!intervencion)
      throw new NotFoundException(
        'Ese intervención no existe o no tienes acceso.',
      );

    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      intervencion.carpetaId,
      minimo,
    );
    return { ...intervencion, carpeta };
  }

  /**
   * El candado del historial: en una intervención cerrada no se escribe.
   *
   * Lo llaman `ActividadService` y todo lo que cuelgue de una intervención. Va
   * aparte de `exigirPermiso` a propósito: el permiso responde «quién eres»
   * y esto responde «esta intervención ya terminó», que son dos preguntas
   * distintas — y por eso el mensaje nombra la salida real, que es reabrir.
   */
  exigirAbierto(intervencion: { numero: number; cerradoEn: Date | null }) {
    if (intervencion.cerradoEn)
      throw new BadRequestException(
        `La intervención ${intervencion.numero} está cerrada y no admite cambios. ` +
          'Si hay que corregir algo, reábrelo primero: queda registrado.',
      );
  }
}
