import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService, noExisteOSinAcceso } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import { AlmacenamientoService } from './almacenamiento.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import { aIdOpcional } from '../common/validacion';
import { aFechaUTC, claveDia } from '../common/fechas';
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

/** Lo que devuelve Prisma para una tarea, antes de normalizar la fecha. */
type TareaCruda = { fecha: Date | null } & Record<string, unknown>;

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
    private readonly almacenamiento: AlmacenamientoService,
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

  /**
   * Normaliza `fecha` a "YYYY-MM-DD" antes de salir.
   *
   * ⚠️ `@db.Date` llega como `Date` y se serializa a
   * `"2026-08-21T00:00:00.000Z"`. Un `<input type="date">` no acepta eso, así
   * que el formulario de edición se quedaba con la fecha VACÍA aunque la
   * tarea la tuviera —el listado sí la pintaba, porque ahí solo se formatea—.
   * Se corta aquí y no en el cliente para que el contrato diga la verdad: el
   * tipo del frontend ya prometía "YYYY-MM-DD". Es lo mismo que hace la
   * galería con la fecha del álbum.
   */
  private conFecha<T extends TareaCruda>(tarea: T): T;
  private conFecha<T extends TareaCruda>(tareas: T[]): T[];
  private conFecha<T extends TareaCruda>(entrada: T | T[]): T | T[] {
    const una = (t: T) => ({
      ...t,
      fecha: t.fecha ? claveDia(t.fecha) : null,
    });
    return Array.isArray(entrada) ? entrada.map(una) : una(entrada);
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

  /**
   * Quién puede ser RESPONSABLE de una tarea (§13).
   *
   * Solo id y nombre, y solo de cuentas ACTIVAS con el módulo FOTOS (más el
   * SuperAdmin, que llega a todo por su rol). **Sin correos**: §10 exige
   * TOTAL para ver la lista de colaboradores justamente porque ahí van
   * correos de terceros; un nombre para rellenar un desplegable no es lo
   * mismo, pero no hay razón para añadir el correo al lado.
   *
   * Vive aquí y no en `/usuario`, que es `@SoloSuperAdmin`: abrir aquella
   * ruta para esto habría dado a cualquier supervisor la ficha completa de
   * todas las cuentas del sistema. Es el mismo criterio que llevó el
   * catálogo de Equipos a un controller propio en la Fase 4.
   *
   * Los CLIENTES quedan fuera: son cuentas externas del portal (§4) y
   * asignarles trabajo de obra no significa nada.
   */
  async asignables() {
    return this.prisma.usuario.findMany({
      where: {
        estado: 'ACTIVO',
        OR: [
          { rol: 'SUPERADMIN' },
          { permisos: { some: { modulo: 'FOTOS' } } },
        ],
        NOT: { rol: 'CLIENTE' },
      },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Las fotos de una tarea (§15: «tarea relacionada»).
   *
   * ⚠️ Existe porque desde la Fase 6 se PODÍAN subir fotos a una tarea y no
   * había forma de volver a verlas: la galería lista por álbum
   * (`where: { album }`) y la bandeja solo lo que no está clasificado, así
   * que una foto de tarea quedaba invisible en las dos. Era un cabo suelto,
   * no una decisión.
   *
   * Sin paginar a propósito: las fotos de UNA tarea son unas pocas —lo que
   * documenta un trabajo concreto—, al revés que la galería de una carpeta,
   * que acumula todo lo del proyecto.
   */
  async fotosDe(usuario: UsuarioAutenticado, tareaId: number) {
    const { tarea } = await this.tareaConPermiso(usuario, tareaId, 'LECTURA');

    const fotos = await this.prisma.foto.findMany({
      where: { tareaId: tarea.id },
      orderBy: { creadoEn: 'asc' },
      select: {
        id: true,
        descripcion: true,
        anchoPx: true,
        altoPx: true,
        bytes: true,
        tomadaEn: true,
        creadoEn: true,
        claveImagen: true,
        claveMiniatura: true,
        subidaPor: { select: { id: true, nombre: true } },
      },
    });

    return Promise.all(
      fotos.map(async (f) => ({
        id: f.id,
        descripcion: f.descripcion,
        anchoPx: f.anchoPx,
        altoPx: f.altoPx,
        bytes: f.bytes,
        tomadaEn: f.tomadaEn ? claveDia(f.tomadaEn) : null,
        creadoEn: f.creadoEn,
        subidaPor: f.subidaPor,
        url: await this.almacenamiento.urlFirmada(f.claveImagen),
        urlMiniatura: await this.almacenamiento.urlFirmada(f.claveMiniatura),
      })),
    );
  }

  /** Las tareas de una carpeta. §5: ver es LECTURA. */
  async listar(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    filtros: { estado?: string | null } = {},
  ) {
    await this.acceso.exigirPermiso(usuario, carpetaId, 'LECTURA');
    const estado = this.validarEstado(filtros.estado);

    return this.conFecha(
      await this.prisma.tareaFotos.findMany({
        where: { carpetaId, ...(estado ? { estado } : {}) },
        select: SELECT_TAREA,
        // Pendientes arriba y, dentro de cada estado, lo más reciente
        // primero: una lista de tareas se mira para saber qué falta.
        orderBy: [{ estado: 'asc' }, { creadoEn: 'desc' }],
      }),
    );
  }

  async detalle(usuario: UsuarioAutenticado, tareaId: number) {
    await this.tareaConPermiso(usuario, tareaId, 'LECTURA');
    const tarea = await this.prisma.tareaFotos.findUniqueOrThrow({
      where: { id: tareaId },
      select: SELECT_TAREA,
    });
    return this.conFecha(tarea);
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
    return this.conFecha(tarea);
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

    // Instantánea ANTES de tocar nada: comparar los dos estados es más
    // fiable que deducir el cambio del payload, que no sabe qué había.
    // Mismo criterio que `EquipoService.editar` y que `CarpetaService`.
    const antes = await this.prisma.tareaFotos.findUniqueOrThrow({
      where: { id: tareaId },
      select: SELECT_TAREA,
    });

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

    // Un evento POR CAMPO que cambió, con su valor anterior (§23). §23 no
    // nombra «editar tarea» entre sus trece acciones —sí «crear» y
    // «completar»—, pero una carpeta ya lo registra y no tenerlo aquí
    // dejaba un agujero raro: se sabía quién creó la tarea y quién la dio
    // por hecha, pero no quién le cambió el responsable por el camino.
    const comoTexto = (t: typeof antes) => ({
      titulo: t.titulo,
      descripcion: t.descripcion,
      estado: t.estado,
      prioridad: t.prioridad ?? null,
      fecha: t.fecha ? claveDia(t.fecha) : null,
      responsable: t.responsable?.nombre ?? null,
    });

    await this.auditoria.registrar(
      usuario,
      this.auditoria.diferencias(comoTexto(antes), comoTexto(tarea), {
        carpetaId: carpeta.id,
        entidad: 'TAREA',
        entidadId: tareaId,
      }),
    );

    return this.conFecha(tarea);
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
    return this.conFecha(tarea);
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
