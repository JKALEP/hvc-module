import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService, noExisteOSinAcceso } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import { IntervencionService } from './intervencion.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar } from '../common/texto';

/** Lo que se devuelve de una observación. Nunca la fila cruda. */
const SELECT_OBSERVACION = {
  id: true,
  carpetaId: true,
  intervencionOrigenId: true,
  actividadId: true,
  texto: true,
  estado: true,
  creadoEn: true,
  actualizadoEn: true,
  resueltaEn: true,
  creadoPor: { select: { id: true, nombre: true } },
  resueltaPor: { select: { id: true, nombre: true } },
  intervencionOrigen: { select: { id: true, numero: true } },
  intervencionResuelta: { select: { id: true, numero: true } },
} as const;

/**
 * Las observaciones de §8 (Fase 5 del rediseño).
 *
 * Lo que queda pendiente en un equipo: se levanta durante una intervención y sigue
 * abierta hasta que alguien la resuelve, sea en esa intervención o en otra.
 *
 * ⚠️ **El arrastre entre intervenciones NO se materializa.** La observación cuelga
 * del EQUIPO y solo recuerda en qué intervención se levantó; que aparezca en la
 * intervención siguiente no es una copia, es que nunca dejó de estar abierta.
 *
 * Copiarla al abrir la intervención —como sí se copia el checklist— se descartó a
 * propósito: duplicaría la misma observación en cada intervención, dejaría sin
 * respuesta «¿desde cuándo arrastramos esto?» y obligaría a acertar cuál de
 * las cinco copias resolver. El checklist se copia porque cada intervención REHACE
 * ese trabajo; una observación no se rehace, se resuelve una vez.
 *
 * Es el mismo criterio que el resto del módulo: derivar en lectura en vez de
 * almacenar —la cascada de permisos, los contadores del explorador,
 * `faltaEvidencia`—.
 */
@Injectable()
export class ObservacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
    private readonly intervenciones: IntervencionService,
  ) {}

  private textoValido(valor: unknown) {
    const texto = limpiar(valor);
    if (!texto)
      throw new BadRequestException('La observación necesita un texto.');
    return texto;
  }

  /**
   * Lo que hay que atender en ESTA intervención.
   *
   * Dos grupos en una sola lista, cada uno marcado:
   *
   *  · las levantadas en este intervencion;
   *  · las **arrastradas**: pendientes que se levantaron en intervenciones
   *    anteriores del mismo equipo y que nadie ha resuelto.
   *
   * ⚠️ `arrastrada` viaja en la respuesta y no se deduce en el cliente: la
   * distinción es la que da valor a la pantalla —«esto lleva tres intervenciones
   * abierto» no es lo mismo que «esto salió hoy»— y calcularla comparando
   * números de intervención en el frontend sería repetir la regla en dos sitios.
   *
   * Las RESUELTAS de intervenciónes anteriores no se traen: ya no hay nada que
   * hacer con ellas, y arrastrarlas convertiría la lista en un historial.
   * Para eso está la vista de la intervención donde se levantaron.
   */
  async listarDeIntervencion(
    usuario: UsuarioAutenticado,
    intervencionId: number,
  ) {
    const intervencion = await this.intervenciones.exigirIntervencion(
      usuario,
      intervencionId,
      'LECTURA',
    );

    const filas = await this.prisma.observacionFotos.findMany({
      where: {
        carpetaId: intervencion.carpetaId,
        OR: [
          // Las de ESTA intervención que son del equipo en general. Las que cuelgan
          // de una actividad se ven EN su actividad, no aquí: enseñarlas en
          // los dos sitios haría contar dos veces lo mismo.
          { intervencionOrigenId: intervencionId, actividadId: null },
          // Y las arrastradas, sean del equipo o de una actividad: la
          // actividad de la que colgaban es de una intervención pasada y ya no está
          // a la vista, así que su pendiente tiene que aparecer en algún
          // sitio — y el sitio es éste.
          {
            estado: 'PENDIENTE',
            intervencionOrigen: { numero: { lt: intervencion.numero } },
          },
        ],
      },
      orderBy: [{ estado: 'asc' }, { creadoEn: 'asc' }],
      select: SELECT_OBSERVACION,
    });

    return filas.map((o) => ({
      ...o,
      arrastrada: o.intervencionOrigenId !== intervencionId,
      /**
       * Cuántas intervenciones lleva abierta, contando la suya. 1 = salió en ésta.
       * Se calcula aquí porque el número de intervención ya está delante y en el
       * cliente obligaría a tener cargado el historial entero.
       */
      intervencionesAbierta:
        intervencion.numero - o.intervencionOrigen.numero + 1,
    }));
  }

  /**
   * Levanta una observación en la intervención en curso.
   *
   * Exige que la intervención esté ABIERTO: escribir en uno cerrado sería añadir
   * hallazgos a una intervención que ya terminó. Es el único punto de esta clase
   * donde el candado del historial aplica — ver `exigirTocable`.
   */
  async crear(
    usuario: UsuarioAutenticado,
    intervencionId: number,
    texto: unknown,
    /** De qué actividad es. `null` = del equipo en general. */
    actividadId: number | null = null,
  ) {
    const intervencion = await this.intervenciones.exigirIntervencion(
      usuario,
      intervencionId,
      'EDICION',
    );
    this.intervenciones.exigirAbierto(intervencion);
    const limpio = this.textoValido(texto);

    const creada = await this.prisma.observacionFotos.create({
      data: {
        carpetaId: intervencion.carpetaId,
        intervencionOrigenId: intervencionId,
        actividadId,
        texto: limpio,
        creadoPorId: usuario.id,
      },
      select: SELECT_OBSERVACION,
    });

    await this.acceso.marcarActividad(intervencion.carpeta.ruta);
    await this.auditoria.registrar(usuario, {
      carpetaId: intervencion.carpetaId,
      entidad: 'OBSERVACION',
      entidadId: creada.id,
      accion: 'CREACION',
      descripcion: `Registró una observación en la intervención ${intervencion.numero} de "${intervencion.carpeta.nombre}": «${limpio}».`,
    });
    return { ...creada, arrastrada: false, intervencionesAbierta: 1 };
  }

  /**
   * Las observaciones de UNA actividad.
   *
   * Se listan aparte de las del equipo porque se leen en otro sitio —dentro
   * de la actividad, junto a sus fotos y sus comentarios— y porque mezclarlas
   * en el panel general las contaría dos veces.
   *
   * El permiso se resuelve por la carpeta de su intervención, como todo lo que
   * cuelga de una actividad.
   */
  async listarDeActividad(usuario: UsuarioAutenticado, actividadId: number) {
    const actividad = await this.prisma.actividadFotos.findUnique({
      where: { id: actividadId },
      select: {
        id: true,
        intervencion: { select: { carpetaId: true, numero: true } },
      },
    });
    if (!actividad)
      throw new NotFoundException(noExisteOSinAcceso('Esa actividad'));
    await this.acceso.exigirPermiso(
      usuario,
      actividad.intervencion.carpetaId,
      'LECTURA',
    );

    const filas = await this.prisma.observacionFotos.findMany({
      where: { actividadId },
      orderBy: [{ estado: 'asc' }, { creadoEn: 'asc' }],
      select: SELECT_OBSERVACION,
    });
    // Dentro de su actividad ninguna es «arrastrada»: se está mirando la
    // intervención a la que pertenece.
    return filas.map((o) => ({
      ...o,
      arrastrada: false,
      intervencionesAbierta: 1,
    }));
  }

  /**
   * Levanta una observación sobre UNA actividad concreta.
   *
   * Pasa por el mismo `crear`: la observación es igual, lo único que cambia
   * es de qué cuelga. La intervención sale de la actividad, así que el candado de
   * «intervención abierta» se aplica igual sin repetirlo aquí.
   */
  async crearEnActividad(
    usuario: UsuarioAutenticado,
    actividadId: number,
    texto: unknown,
  ) {
    const actividad = await this.prisma.actividadFotos.findUnique({
      where: { id: actividadId },
      select: { id: true, intervencionId: true },
    });
    if (!actividad)
      throw new NotFoundException(noExisteOSinAcceso('Esa actividad'));
    return this.crear(usuario, actividad.intervencionId, texto, actividad.id);
  }

  /**
   * La observación y su carpeta, con el permiso ya exigido.
   *
   * ⚠️ **NO se comprueba que su intervención de origen siga abierto, y es la
   * decisión más importante de la fase.** Una observación pertenece al
   * EQUIPO: si se congelara con su intervención, una levantada en la intervención 1
   * dejaría de poder resolverse en cuanto la intervención 1 se cerrara — que es
   * exactamente el caso para el que existe el arrastre.
   *
   * Lo que una intervención cerrada congela es lo que pasó DENTRO de él: sus
   * actividades, sus fotos, su estado. Una observación abierta no es algo
   * que pasó: es algo que sigue pasando.
   */
  private async conPermiso(
    usuario: UsuarioAutenticado,
    id: number,
    minimo: 'LECTURA' | 'EDICION' | 'TOTAL',
  ) {
    const observacion = await this.prisma.observacionFotos.findUnique({
      where: { id },
      select: {
        id: true,
        carpetaId: true,
        texto: true,
        estado: true,
        creadoPorId: true,
        intervencionOrigen: { select: { numero: true } },
      },
    });
    if (!observacion)
      throw new NotFoundException(noExisteOSinAcceso('Esa observación'));

    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      observacion.carpetaId,
      minimo,
    );
    return { observacion, carpeta };
  }

  /** Corregir el texto. Queda el valor anterior en la bitácora. */
  async editar(usuario: UsuarioAutenticado, id: number, texto: unknown) {
    const { observacion, carpeta } = await this.conPermiso(
      usuario,
      id,
      'EDICION',
    );
    const limpio = this.textoValido(texto);
    if (limpio === observacion.texto) return this.detalle(usuario, id);

    await this.prisma.observacionFotos.update({
      where: { id },
      data: { texto: limpio },
    });

    await this.acceso.marcarActividad(carpeta.ruta);
    await this.auditoria.registrar(usuario, {
      carpetaId: observacion.carpetaId,
      entidad: 'OBSERVACION',
      entidadId: id,
      accion: 'EDICION',
      campoAfectado: 'texto',
      valorAnterior: observacion.texto,
      valorNuevo: limpio,
      descripcion: 'Corrigió el texto de una observación.',
    });
    return this.detalle(usuario, id);
  }

  /**
   * Dar por resuelta, o volver a abrir.
   *
   * Las tres marcas —cuándo, quién y en qué visita— se llenan y se vacían
   * JUNTAS, igual que la marca de completado de una actividad: una
   * observación que vuelve a PENDIENTE conservando «resuelta por Ana»
   * afirmaría algo que ya no es cierto. El historial de eso es la bitácora.
   *
   * ⚠️ Resolver **no exige que haya una intervención abierta**. Si la hay se anota
   * en `intervencionResueltaId`, y si no, queda en null: lo que importa registrar es
   * que quedó resuelta y quién; dónde es contexto. Exigirla dejaría sin poder
   * cerrar las observaciones de un equipo cuyas intervenciones están todas cerradas,
   * que es justo cuando alguien repasa lo pendiente.
   */
  async resolver(usuario: UsuarioAutenticado, id: number, resuelta: boolean) {
    const { observacion, carpeta } = await this.conPermiso(
      usuario,
      id,
      'EDICION',
    );

    const yaEsta = (observacion.estado === 'RESUELTA') === resuelta;
    if (yaEsta) return this.detalle(usuario, id);

    const abierto = resuelta
      ? await this.prisma.intervencionFotos.findFirst({
          where: { carpetaId: observacion.carpetaId, cerradoEn: null },
          select: { id: true },
        })
      : null;

    await this.prisma.observacionFotos.update({
      where: { id },
      data: resuelta
        ? {
            estado: 'RESUELTA',
            resueltaEn: new Date(),
            resueltaPorId: usuario.id,
            intervencionResueltaId: abierto?.id ?? null,
          }
        : {
            estado: 'PENDIENTE',
            resueltaEn: null,
            resueltaPorId: null,
            intervencionResueltaId: null,
          },
    });

    await this.acceso.marcarActividad(carpeta.ruta);
    await this.auditoria.registrar(usuario, {
      carpetaId: observacion.carpetaId,
      entidad: 'OBSERVACION',
      entidadId: id,
      accion: resuelta ? 'OBSERVACION_RESUELTA' : 'OBSERVACION_REABIERTA',
      descripcion: resuelta
        ? `Dio por resuelta la observación «${observacion.texto}».`
        : `Reabrió la observación «${observacion.texto}»: vuelve a estar pendiente.`,
    });
    return this.detalle(usuario, id);
  }

  /**
   * Borrar. La propia con EDICION, la ajena con TOTAL.
   *
   * Es la misma distinción de §5 que ya siguen las fotos, las actividades y
   * los comentarios. Borrar no es resolver: se borra lo que se anotó por
   * error, no lo que se atendió — para eso está resolver, que deja rastro de
   * quién y cuándo.
   */
  async eliminar(usuario: UsuarioAutenticado, id: number) {
    const previa = await this.prisma.observacionFotos.findUnique({
      where: { id },
      select: { creadoPorId: true },
    });
    if (!previa)
      throw new NotFoundException(noExisteOSinAcceso('Esa observación'));

    const esPropia = previa.creadoPorId === usuario.id;
    const { observacion, carpeta } = await this.conPermiso(
      usuario,
      id,
      esPropia ? 'EDICION' : 'TOTAL',
    );

    await this.prisma.observacionFotos.delete({ where: { id } });
    await this.acceso.marcarActividad(carpeta.ruta);
    await this.auditoria.registrar(usuario, {
      carpetaId: observacion.carpetaId,
      entidad: 'OBSERVACION',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: esPropia
        ? `Eliminó una observación suya: «${observacion.texto}».`
        : `Eliminó la observación de otro usuario: «${observacion.texto}».`,
    });
    return { ok: true, id };
  }

  async detalle(usuario: UsuarioAutenticado, id: number) {
    const observacion = await this.prisma.observacionFotos.findUnique({
      where: { id },
      select: SELECT_OBSERVACION,
    });
    if (!observacion)
      throw new NotFoundException(noExisteOSinAcceso('Esa observación'));
    await this.acceso.exigirPermiso(usuario, observacion.carpetaId, 'LECTURA');
    return observacion;
  }

  /**
   * Cuántas quedan pendientes en un equipo.
   *
   * La usa `NavegacionService` para la tarjeta del explorador: «2 pendientes»
   * es, junto al estado, lo que se viene a saber sin entrar. No comprueba
   * permisos porque quien la llama ya filtró las carpetas que ve.
   */
  async pendientesPorCarpeta(carpetaIds: number[]) {
    if (carpetaIds.length === 0) return new Map<number, number>();
    const filas = await this.prisma.observacionFotos.groupBy({
      by: ['carpetaId'],
      where: { carpetaId: { in: carpetaIds }, estado: 'PENDIENTE' },
      _count: { _all: true },
    });
    return new Map(filas.map((f) => [f.carpetaId, f._count._all]));
  }
}
