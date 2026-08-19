import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService, noExisteOSinAcceso } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import { aIdOpcional } from '../common/validacion';
import { aFechaUTC } from '../common/fechas';
import type {
  EstadoTareaFotos,
  PrioridadTareaFotos,
} from '../../generated/prisma/enums';

const ESTADOS = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA'] as const;
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA'] as const;

export interface CrearTareaDto {
  titulo?: string | null;
  descripcion?: string | null;
  estado?: string | null;
  prioridad?: string | null;
  fecha?: string | null;
  responsableId?: number | string | null;
}

export type EditarTareaDto = CrearTareaDto;

/** Lo que se devuelve de cada tarea. Nunca la fila cruda. */
const SELECT_TAREA = {
  id: true,
  carpetaId: true,
  titulo: true,
  descripcion: true,
  estado: true,
  prioridad: true,
  fecha: true,
  completadaEn: true,
  creadoEn: true,
  actualizadoEn: true,
  responsable: { select: { id: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
  completadaPor: { select: { id: true, nombre: true } },
  _count: { select: { fotos: true, comentarios: true } },
} as const;

/**
 * Las tareas de §13.
 *
 * Cuelgan de una CARPETA y no del catálogo de Equipos, aunque §13 diga
 * «dentro de cada equipo»: en este módulo una carpeta de tipo EQUIPO **es**
 * el equipo dentro del árbol, y colgarlas del catálogo obligaría a resolver
 * los permisos por un camino que no pasa por `ruta` —el único que Fotos
 * recorre—.
 *
 * ⚠️ **Solo se crean bajo una carpeta de tipo EQUIPO.** §13 lo enuncia así
 * («dentro de cada equipo») y es la lectura estricta: se puede relajar
 * después con una línea, mientras que permitirlas en cualquier carpeta y
 * querer restringirlas luego deja filas que ya no encajan.
 *
 * Ninguna operación decide permisos por su cuenta: todas pasan por
 * `AccesoService`, que además corta la escritura en una rama archivada.
 */
@Injectable()
export class TareaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /**
   * La tarea y la carpeta de la que cuelga, con el permiso ya exigido.
   *
   * Se resuelve SIEMPRE por la carpeta: una tarea no tiene permisos
   * propios. Y si la carpeta no se ve, la tarea contesta lo mismo que una
   * carpeta invisible —el 404 de `NO_EXISTE_O_SIN_ACCESO`—, porque de lo
   * contrario probar ids de tarea diría cuántas hay al otro lado.
   */
  private async tareaConPermiso(
    usuario: UsuarioAutenticado,
    tareaId: number,
    minimo: Parameters<AccesoService['exigirPermiso']>[2],
  ) {
    const tarea = await this.prisma.tareaFotos.findUnique({
      where: { id: tareaId },
      select: { id: true, carpetaId: true, creadoPorId: true, estado: true },
    });
    if (!tarea) throw new NotFoundException(noExisteOSinAcceso('Esa tarea'));

    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      tarea.carpetaId,
      minimo,
    );
    return { tarea, carpeta };
  }

  private validarEstado(valor: unknown): EstadoTareaFotos | null {
    const texto = limpiar(valor);
    if (texto === null) return null;
    const estado = texto.toUpperCase();
    if (!ESTADOS.includes(estado as EstadoTareaFotos))
      throw new BadRequestException(
        `Estado de tarea inválido: "${describir(valor)}". Valores permitidos: ${ESTADOS.join(', ')}.`,
      );
    return estado as EstadoTareaFotos;
  }

  private validarPrioridad(valor: unknown): PrioridadTareaFotos | null {
    const texto = limpiar(valor);
    if (texto === null) return null;
    const prioridad = texto.toUpperCase();
    if (!PRIORIDADES.includes(prioridad as PrioridadTareaFotos))
      throw new BadRequestException(
        `Prioridad inválida: "${describir(valor)}". Valores permitidos: ${PRIORIDADES.join(', ')}.`,
      );
    return prioridad as PrioridadTareaFotos;
  }

  /** El responsable tiene que existir. No se le exige tener acceso: §13 no lo pide. */
  private async validarResponsable(valor: unknown) {
    const responsableId = aIdOpcional(
      valor,
      'El responsable que indicaste no es válido.',
    );
    if (responsableId === null) return null;
    const existe = await this.prisma.usuario.findUnique({
      where: { id: responsableId },
      select: { id: true },
    });
    if (!existe)
      throw new NotFoundException('Ese usuario ya no existe en el sistema.');
    return responsableId;
  }

  /**
   * Las tres columnas de «completada» se escriben y se borran JUNTAS.
   *
   * §13 pide registrar fecha/hora y quién completó. Al reabrir se vacían:
   * una tarea que vuelve a PENDIENTE conservando «completada por Ana el
   * martes» afirma algo que ya no es cierto, y el historial de eso es la
   * bitácora, no la fila.
   */
  private marcaDeCompletada(
    estado: EstadoTareaFotos,
    usuario: UsuarioAutenticado,
  ) {
    return estado === 'COMPLETADA'
      ? { completadaEn: new Date(), completadaPorId: usuario.id }
      : { completadaEn: null, completadaPorId: null };
  }

  /** Las tareas de una carpeta. §5: ver es LECTURA. */
  async listar(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    filtros: { estado?: string | null } = {},
  ) {
    await this.acceso.exigirPermiso(usuario, carpetaId, 'LECTURA');
    const estado = this.validarEstado(filtros.estado);

    return this.prisma.tareaFotos.findMany({
      where: { carpetaId, ...(estado ? { estado } : {}) },
      select: SELECT_TAREA,
      // Pendientes arriba y, dentro de cada estado, lo más reciente
      // primero: una lista de tareas se mira para saber qué falta.
      orderBy: [{ estado: 'asc' }, { creadoEn: 'desc' }],
    });
  }

  async detalle(usuario: UsuarioAutenticado, tareaId: number) {
    await this.tareaConPermiso(usuario, tareaId, 'LECTURA');
    return this.prisma.tareaFotos.findUnique({
      where: { id: tareaId },
      select: SELECT_TAREA,
    });
  }

  /** Crear. §5: escribir dentro de una carpeta es EDICION. */
  async crear(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    dto: CrearTareaDto,
  ) {
    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      carpetaId,
      'EDICION',
    );

    const tipo = await this.prisma.carpetaFotos.findUnique({
      where: { id: carpetaId },
      select: { tipo: true },
    });
    if (tipo?.tipo !== 'EQUIPO')
      throw new BadRequestException(
        'Las tareas se crean dentro de un equipo. Esta carpeta no lo es.',
      );

    const titulo = limpiar(dto.titulo);
    if (titulo === null)
      throw new BadRequestException('La tarea necesita un título.');

    const estado = this.validarEstado(dto.estado) ?? 'PENDIENTE';

    const tarea = await this.prisma.tareaFotos.create({
      data: {
        carpetaId,
        titulo,
        descripcion: limpiar(dto.descripcion),
        estado,
        prioridad: this.validarPrioridad(dto.prioridad),
        fecha: dto.fecha ? aFechaUTC(dto.fecha, 'La fecha de la tarea') : null,
        responsableId: await this.validarResponsable(dto.responsableId),
        creadoPorId: usuario.id,
        ...this.marcaDeCompletada(estado, usuario),
      },
      select: SELECT_TAREA,
    });

    await this.acceso.marcarActividad(carpeta.ruta);

    // §23, acción 3 de 13.
    await this.auditoria.registrar(usuario, {
      carpetaId,
      entidad: 'TAREA',
      entidadId: tarea.id,
      accion: 'CREACION',
      descripcion: `Creó la tarea "${tarea.titulo}".`,
    });
    return tarea;
  }

  /**
   * Editar. Solo se tocan los campos QUE LLEGAN (`in dto`), no los que
   * llegan vacíos: mandar `{estado}` desde el detalle no puede borrar la
   * descripción que otro acaba de escribir.
   */
  async editar(
    usuario: UsuarioAutenticado,
    tareaId: number,
    dto: EditarTareaDto,
  ) {
    const { carpeta } = await this.tareaConPermiso(usuario, tareaId, 'EDICION');

    const datos: Record<string, unknown> = {};

    if ('titulo' in dto) {
      const titulo = limpiar(dto.titulo);
      if (titulo === null)
        throw new BadRequestException('La tarea necesita un título.');
      datos.titulo = titulo;
    }
    if ('descripcion' in dto) datos.descripcion = limpiar(dto.descripcion);
    if ('prioridad' in dto)
      datos.prioridad = this.validarPrioridad(dto.prioridad);
    if ('fecha' in dto)
      datos.fecha = dto.fecha
        ? aFechaUTC(dto.fecha, 'La fecha de la tarea')
        : null;
    if ('responsableId' in dto)
      datos.responsableId = await this.validarResponsable(dto.responsableId);

    if ('estado' in dto) {
      const estado = this.validarEstado(dto.estado);
      if (estado === null)
        throw new BadRequestException(
          'El estado de la tarea no puede ir vacío.',
        );
      datos.estado = estado;
      Object.assign(datos, this.marcaDeCompletada(estado, usuario));
    }

    const tarea = await this.prisma.tareaFotos.update({
      where: { id: tareaId },
      data: datos,
      select: SELECT_TAREA,
    });

    await this.acceso.marcarActividad(carpeta.ruta);
    return tarea;
  }

  /**
   * El check rápido de §13: completar o reabrir de un clic.
   *
   * Ruta propia y no un PATCH con `{estado}`, por lo mismo que archivar una
   * carpeta lo es: escribe TRES columnas a la vez y se dispara desde una
   * casilla, no desde el formulario. Con un PATCH, la casilla tendría que
   * saber que además hay que mandar la fecha y el usuario —o el servidor
   * tendría que adivinar cuál de los dos caminos vino—.
   *
   * Reabrir vuelve a PENDIENTE, no a EN_PROCESO: destildar dice «esto no
   * está hecho», y en qué punto quedó lo elige una persona en el formulario.
   */
  async completar(
    usuario: UsuarioAutenticado,
    tareaId: number,
    completada: boolean,
  ) {
    const { carpeta } = await this.tareaConPermiso(usuario, tareaId, 'EDICION');
    const estado: EstadoTareaFotos = completada ? 'COMPLETADA' : 'PENDIENTE';

    const tarea = await this.prisma.tareaFotos.update({
      where: { id: tareaId },
      data: { estado, ...this.marcaDeCompletada(estado, usuario) },
      select: SELECT_TAREA,
    });

    await this.acceso.marcarActividad(carpeta.ruta);

    // §23, acción 4. Es la que HVC quiere poder auditar de verdad: quién dio
    // por hecho qué, y cuándo.
    await this.auditoria.registrar(usuario, {
      carpetaId: tarea.carpetaId,
      entidad: 'TAREA',
      entidadId: tarea.id,
      accion: completada ? 'TAREA_COMPLETADA' : 'TAREA_REABIERTA',
      descripcion: `${completada ? 'Completó' : 'Reabrió'} "${tarea.titulo}".`,
    });
    return tarea;
  }

  /**
   * Borrar. La propia con EDICION; la ajena exige TOTAL.
   *
   * Es la misma distinción que §5 hace con las fotos —la propia se borra
   * con EDICION, la ajena con TOTAL—: retirar lo que uno mismo puso es
   * parte de trabajar; retirar lo de otro es administrar.
   */
  async eliminar(usuario: UsuarioAutenticado, tareaId: number) {
    const previa = await this.prisma.tareaFotos.findUnique({
      where: { id: tareaId },
      select: { creadoPorId: true },
    });
    if (!previa) throw new NotFoundException(noExisteOSinAcceso('Esa tarea'));

    const esPropia = previa.creadoPorId === usuario.id;
    const { carpeta } = await this.tareaConPermiso(
      usuario,
      tareaId,
      esPropia ? 'EDICION' : 'TOTAL',
    );

    // Las fotos de la tarea la seguirían: `Foto.tareaId` es Cascade. Se
    // corta antes para que borrar una tarea no se lleve por delante fotos
    // que documentan el trabajo — quedan en la bandeja de §18.
    const conFotos = await this.prisma.foto.count({ where: { tareaId } });
    if (conFotos > 0)
      throw new BadRequestException(
        `No se puede eliminar: la tarea tiene ${conFotos} foto(s). Muévelas o elimínalas antes.`,
      );

    await this.prisma.tareaFotos.delete({ where: { id: tareaId } });
    await this.acceso.marcarActividad(carpeta.ruta);

    // §23 no la nombra, pero es destructiva y se lleva comentarios por
    // cascada: se registra por el mismo criterio que eliminar una carpeta.
    await this.auditoria.registrar(usuario, {
      carpetaId: carpeta.id,
      entidad: 'TAREA',
      entidadId: tareaId,
      accion: 'ELIMINACION',
      descripcion: 'Eliminó una tarea.',
    });
    return { ok: true, id: tareaId };
  }
}
