import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService, noExisteOSinAcceso } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import { CicloService } from './ciclo.service';
import { AlmacenamientoService } from './almacenamiento.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import { aIdOpcional } from '../common/validacion';
import { aFechaUTC, claveDia } from '../common/fechas';
import type {
  EstadoActividadFotos,
  PrioridadActividadFotos,
  TipoEvidenciaFotos,
} from '../../generated/prisma/enums';

const ESTADOS = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA'] as const;
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA'] as const;
const EVIDENCIAS = ['NINGUNA', 'UNA', 'ANTES_DESPUES'] as const;

export interface CrearActividadDto {
  titulo?: string | null;
  descripcion?: string | null;
  estado?: string | null;
  prioridad?: string | null;
  fecha?: string | null;
  responsableId?: number | string | null;
  /** Qué evidencia se le pide (Fase 3): NINGUNA, UNA o ANTES_DESPUES. */
  evidencia?: string | null;
}

export type EditarActividadDto = CrearActividadDto;

/** Lo que se devuelve de cada actividad. Nunca la fila cruda. */
// ⚠️ Lleva `cicloId` y NO `carpetaId`: desde la Fase 1 la actividad cuelga
// del ciclo, y la carpeta se deduce de él. `carpetaId` sobrevivió aquí al
// cambio de modelo y **el compilador no lo vio** —un `select` que es una
// constante con nombre no pasa por la comprobación de propiedades de más de
// TypeScript, que solo se aplica a los literales—; reventó en la primera
// llamada real, que es justo lo que este `select` alimenta.
const SELECT_ACTIVIDAD = {
  id: true,
  cicloId: true,
  titulo: true,
  descripcion: true,
  estado: true,
  prioridad: true,
  evidencia: true,
  fecha: true,
  completadaEn: true,
  creadoEn: true,
  actualizadoEn: true,
  responsable: { select: { id: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
  completadaPor: { select: { id: true, nombre: true } },
  _count: { select: { fotos: true, comentarios: true } },
  // ⚠️ Solo el `momento`, no las fotos: hace falta saber si el antes y el
  // después están puestos, y traer la fila entera de cada foto para contar
  // dos huecos sería pagar el detalle de la galería en cada listado.
  fotos: { select: { momento: true } },
} as const;

/** Lo que devuelve Prisma para una actividad, antes de normalizarla. */
type ActividadCruda = { fecha: Date | null } & Record<string, unknown>;

/** Lo que trae la relación `fotos` del select, reducido a su hueco. */
type HuecoDeFoto = { momento: 'ANTES' | 'DESPUES' | null };

/** Lo que se añade al salir: la fecha en texto y el estado de la evidencia. */
type ActividadNormalizada<T> = Omit<T, 'fecha' | 'fotos'> & {
  fecha: string | null;
  tieneAntes: boolean;
  tieneDespues: boolean;
  faltaEvidencia: boolean;
};

/**
 * Las actividades de §13.
 *
 * Desde la Fase 1 del rediseño cuelgan de un CICLO —una visita concreta al
 * equipo— y no de la carpeta. El cambio no es de forma: el mismo equipo
 * repite «Revisar filtros» en cada visita, así que preguntar «las actividades
 * de esta carpeta» dejó de tener una respuesta única.
 *
 * La carpeta se deduce del ciclo, y por ahí se resuelven los permisos: una
 * actividad no tiene permisos propios, igual que antes.
 *
 * ⚠️ **La regla de §13 —solo dentro de un EQUIPO— se hace cumplir un escalón
 * más arriba**, en `CicloService`: los ciclos son de un equipo, así que una
 * carpeta corriente no tiene dónde colgar actividades y aquí no hace falta
 * volver a comprobarlo.
 *
 * ⚠️ Y hay un segundo candado, distinto del permiso: en un ciclo CERRADO no
 * se escribe, tampoco siendo `ADMIN_GLOBAL` (`CicloService.exigirAbierto`).
 *
 * Ninguna operación decide permisos por su cuenta: todas pasan por
 * `AccesoService`, que además corta la escritura en una rama archivada.
 */
@Injectable()
export class ActividadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly ciclos: CicloService,
  ) {}

  /**
   * La actividad y la carpeta de la que cuelga, con el permiso ya exigido.
   *
   * Se resuelve SIEMPRE por la carpeta: una actividad no tiene permisos
   * propios. Y si la carpeta no se ve, la actividad contesta lo mismo que una
   * carpeta invisible —el 404 de `NO_EXISTE_O_SIN_ACCESO`—, porque de lo
   * contrario probar ids de actividad diría cuántas hay al otro lado.
   */
  private async actividadConPermiso(
    usuario: UsuarioAutenticado,
    actividadId: number,
    minimo: Parameters<AccesoService['exigirPermiso']>[2],
  ) {
    const actividad = await this.prisma.actividadFotos.findUnique({
      where: { id: actividadId },
      select: {
        id: true,
        cicloId: true,
        creadoPorId: true,
        estado: true,
        // El ciclo viaja con la actividad: quien la va a tocar necesita
        // saber si su visita sigue abierta, y la carpeta sale de aquí.
        ciclo: {
          select: { id: true, numero: true, cerradoEn: true, carpetaId: true },
        },
      },
    });
    if (!actividad)
      throw new NotFoundException(noExisteOSinAcceso('Esa actividad'));

    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      actividad.ciclo.carpetaId,
      minimo,
    );

    // ⚠️ El segundo candado, y va AQUÍ y no en cada método a propósito.
    //
    // Se decide por el mínimo pedido, igual que la rama archivada en
    // `exigirPermiso`: si exiges EDICION o más, vas a escribir, y en un
    // ciclo cerrado no se escribe. Repartido por `editar`, `completar` y
    // `eliminar` bastaba olvidarlo en uno para abrir el historial entero
    // —que es exactamente lo que pasó: los tres se lo saltaban y un
    // ADMIN_GLOBAL podía retocar una visita cerrada—.
    //
    // LECTURA pasa siempre: un ciclo cerrado es historial, no un secreto.
    if (minimo !== 'LECTURA') this.ciclos.exigirAbierto(actividad.ciclo);

    return { actividad, carpeta };
  }

  /**
   * Normaliza `fecha` a "YYYY-MM-DD" antes de salir.
   *
   * ⚠️ `@db.Date` llega como `Date` y se serializa a
   * `"2026-08-21T00:00:00.000Z"`. Un `<input type="date">` no acepta eso, así
   * que el formulario de edición se quedaba con la fecha VACÍA aunque la
   * actividad la tuviera —el listado sí la pintaba, porque ahí solo se formatea—.
   * Se corta aquí y no en el cliente para que el contrato diga la verdad: el
   * tipo del frontend ya prometía "YYYY-MM-DD". Es lo mismo que hace la
   * galería con la fecha del álbum.
   */
  private conFecha<T extends ActividadCruda>(
    actividad: T,
  ): ActividadNormalizada<T>;
  private conFecha<T extends ActividadCruda>(
    actividades: T[],
  ): ActividadNormalizada<T>[];
  private conFecha<T extends ActividadCruda>(
    entrada: T | T[],
  ): ActividadNormalizada<T> | ActividadNormalizada<T>[] {
    const una = (t: T) => {
      // La evidencia se DERIVA aquí y no se guarda (Fase 3): almacenar
      // «tiene el antes» obligaría a reescribirlo al subir y al borrar una
      // foto, que son dos caminos para quedarse desincronizado a cambio de
      // no contar dos elementos de una lista que ya viene cargada. Es el
      // mismo criterio que los contadores por usuario del explorador.
      const huecos = (t.fotos ?? []) as HuecoDeFoto[];
      const tieneAntes = huecos.some((f) => f.momento === 'ANTES');
      const tieneDespues = huecos.some((f) => f.momento === 'DESPUES');
      const evidencia = t.evidencia as
        'NINGUNA' | 'UNA' | 'ANTES_DESPUES' | undefined;

      // La lista de huecos NO sale: es materia prima de las tres banderas
      // de abajo, y devolverla además invitaría a que alguien contara por su
      // cuenta y llegara a otra conclusión.
      const resto = { ...(t as T & { fotos?: HuecoDeFoto[] }) };
      delete resto.fotos;
      return {
        ...(resto as Omit<T, 'fecha' | 'fotos'>),
        fecha: t.fecha ? claveDia(t.fecha) : null,
        tieneAntes,
        tieneDespues,
        /**
         * ⚠️ Es una SEÑAL, no un candado: una actividad se puede completar
         * sin su evidencia. Bloquear el check por esto es exactamente el
         * fallo que el módulo evita en todas partes —trabar el trabajo en
         * obra por un dato que no se tiene delante—; lo que se hace es
         * decirlo, en la tarjeta y en la exportación.
         */
        faltaEvidencia:
          evidencia === 'ANTES_DESPUES'
            ? !tieneAntes || !tieneDespues
            : evidencia === 'UNA'
              ? huecos.length === 0
              : false,
      };
    };
    return Array.isArray(entrada) ? entrada.map(una) : una(entrada);
  }

  private validarEstado(valor: unknown): EstadoActividadFotos | null {
    const texto = limpiar(valor);
    if (texto === null) return null;
    const estado = texto.toUpperCase();
    if (!ESTADOS.includes(estado as EstadoActividadFotos))
      throw new BadRequestException(
        `Estado de actividad inválido: "${describir(valor)}". Valores permitidos: ${ESTADOS.join(', ')}.`,
      );
    return estado as EstadoActividadFotos;
  }

  /**
   * La evidencia esperada (Fase 3). `null` = no se toca / se queda la de
   * fábrica; nunca se guarda null porque la columna no lo admite.
   */
  private validarEvidencia(valor: unknown): TipoEvidenciaFotos | null {
    const texto = limpiar(valor);
    if (texto === null) return null;
    const evidencia = texto.toUpperCase();
    if (!EVIDENCIAS.includes(evidencia as TipoEvidenciaFotos))
      throw new BadRequestException(
        `Tipo de evidencia inválido: "${describir(valor)}". Valores permitidos: ${EVIDENCIAS.join(', ')}.`,
      );
    return evidencia as TipoEvidenciaFotos;
  }

  private validarPrioridad(valor: unknown): PrioridadActividadFotos | null {
    const texto = limpiar(valor);
    if (texto === null) return null;
    const prioridad = texto.toUpperCase();
    if (!PRIORIDADES.includes(prioridad as PrioridadActividadFotos))
      throw new BadRequestException(
        `Prioridad inválida: "${describir(valor)}". Valores permitidos: ${PRIORIDADES.join(', ')}.`,
      );
    return prioridad as PrioridadActividadFotos;
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
   * una actividad que vuelve a PENDIENTE conservando «completada por Ana el
   * martes» afirma algo que ya no es cierto, y el historial de eso es la
   * bitácora, no la fila.
   */
  private marcaDeCompletada(
    estado: EstadoActividadFotos,
    usuario: UsuarioAutenticado,
  ) {
    return estado === 'COMPLETADA'
      ? { completadaEn: new Date(), completadaPorId: usuario.id }
      : { completadaEn: null, completadaPorId: null };
  }

  /**
   * Quién puede ser RESPONSABLE de una actividad (§13).
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
   * Las fotos de una actividad (§15: «actividad relacionada»).
   *
   * ⚠️ Existe porque desde la Fase 6 se PODÍAN subir fotos a una actividad y no
   * había forma de volver a verlas: la galería lista por álbum
   * (`where: { album }`) y la bandeja solo lo que no está clasificado, así
   * que una foto de actividad quedaba invisible en las dos. Era un cabo suelto,
   * no una decisión.
   *
   * Sin paginar a propósito: las fotos de UNA actividad son unas pocas —lo que
   * documenta un trabajo concreto—, al revés que la galería de una carpeta,
   * que acumula todo lo del proyecto.
   */
  async fotosDe(usuario: UsuarioAutenticado, actividadId: number) {
    const { actividad } = await this.actividadConPermiso(
      usuario,
      actividadId,
      'LECTURA',
    );

    const fotos = await this.prisma.foto.findMany({
      where: { actividadId: actividad.id },
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
        momento: true,
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
        // En qué hueco del antes/después está (Fase 3). `null` cuando la
        // actividad no pide dos: la galería la pinta igual, sin etiqueta.
        momento: f.momento,
        subidaPor: f.subidaPor,
        url: await this.almacenamiento.urlFirmada(f.claveImagen),
        urlMiniatura: await this.almacenamiento.urlFirmada(f.claveMiniatura),
      })),
    );
  }

  /**
   * Las actividades de UN CICLO. §5: ver es LECTURA.
   *
   * ⚠️ Por ciclo y no por carpeta desde la Fase 1: un equipo tiene una
   * actividad «Limpieza de filtro» por cada visita, y listarlas todas
   * juntas mezclaría el trabajo de marzo con el de agosto.
   */
  async listar(
    usuario: UsuarioAutenticado,
    cicloId: number,
    filtros: { estado?: string | null } = {},
  ) {
    await this.ciclos.exigirCiclo(usuario, cicloId, 'LECTURA');
    const estado = this.validarEstado(filtros.estado);

    return this.conFecha(
      await this.prisma.actividadFotos.findMany({
        where: { cicloId, ...(estado ? { estado } : {}) },
        select: SELECT_ACTIVIDAD,
        // Pendientes arriba y, dentro de cada estado, lo más reciente
        // primero: una lista de actividades se mira para saber qué falta.
        orderBy: [{ estado: 'asc' }, { creadoEn: 'desc' }],
      }),
    );
  }

  async detalle(usuario: UsuarioAutenticado, actividadId: number) {
    await this.actividadConPermiso(usuario, actividadId, 'LECTURA');
    const actividad = await this.prisma.actividadFotos.findUniqueOrThrow({
      where: { id: actividadId },
      select: SELECT_ACTIVIDAD,
    });
    return this.conFecha(actividad);
  }

  /**
   * Crear dentro de un ciclo. §5: escribir es EDICION.
   *
   * ⚠️ Ya no hace falta comprobar que la carpeta sea un EQUIPO: los ciclos
   * SOLO existen en equipos —lo hace cumplir `CicloService`— así que tener
   * un `cicloId` válido ya lo garantiza. La regla de §13 no desapareció:
   * se movió una capa más abajo, donde no se puede esquivar.
   *
   * Lo que sí se comprueba aquí es que la visita siga abierta.
   */
  async crear(
    usuario: UsuarioAutenticado,
    cicloId: number,
    dto: CrearActividadDto,
  ) {
    const ciclo = await this.ciclos.exigirCiclo(usuario, cicloId, 'EDICION');
    this.ciclos.exigirAbierto(ciclo);
    const carpeta = ciclo.carpeta;
    const carpetaId = ciclo.carpetaId;

    const titulo = limpiar(dto.titulo);
    if (titulo === null)
      throw new BadRequestException('La actividad necesita un título.');

    const estado = this.validarEstado(dto.estado) ?? 'PENDIENTE';

    const actividad = await this.prisma.actividadFotos.create({
      data: {
        cicloId,
        titulo,
        descripcion: limpiar(dto.descripcion),
        estado,
        prioridad: this.validarPrioridad(dto.prioridad),
        // Sin decir nada se queda el defecto de la columna (UNA), que es lo
        // razonable para una actividad de inspección escrita a mano.
        ...(this.validarEvidencia(dto.evidencia)
          ? { evidencia: this.validarEvidencia(dto.evidencia)! }
          : {}),
        fecha: dto.fecha
          ? aFechaUTC(dto.fecha, 'La fecha de la actividad')
          : null,
        responsableId: await this.validarResponsable(dto.responsableId),
        creadoPorId: usuario.id,
        ...this.marcaDeCompletada(estado, usuario),
      },
      select: SELECT_ACTIVIDAD,
    });

    await this.acceso.marcarActividad(carpeta.ruta);

    // §23, acción 3 de 13.
    await this.auditoria.registrar(usuario, {
      carpetaId,
      entidad: 'ACTIVIDAD',
      entidadId: actividad.id,
      accion: 'CREACION',
      descripcion: `Creó la actividad "${actividad.titulo}".`,
    });
    return this.conFecha(actividad);
  }

  /**
   * Editar. Solo se tocan los campos QUE LLEGAN (`in dto`), no los que
   * llegan vacíos: mandar `{estado}` desde el detalle no puede borrar la
   * descripción que otro acaba de escribir.
   */
  async editar(
    usuario: UsuarioAutenticado,
    actividadId: number,
    dto: EditarActividadDto,
  ) {
    const { carpeta } = await this.actividadConPermiso(
      usuario,
      actividadId,
      'EDICION',
    );

    // Instantánea ANTES de tocar nada: comparar los dos estados es más
    // fiable que deducir el cambio del payload, que no sabe qué había.
    // Mismo criterio que `EquipoService.editar` y que `CarpetaService`.
    const antes = await this.prisma.actividadFotos.findUniqueOrThrow({
      where: { id: actividadId },
      select: SELECT_ACTIVIDAD,
    });

    const datos: Record<string, unknown> = {};

    if ('titulo' in dto) {
      const titulo = limpiar(dto.titulo);
      if (titulo === null)
        throw new BadRequestException('La actividad necesita un título.');
      datos.titulo = titulo;
    }
    if ('descripcion' in dto) datos.descripcion = limpiar(dto.descripcion);
    if ('prioridad' in dto)
      datos.prioridad = this.validarPrioridad(dto.prioridad);
    if ('evidencia' in dto) {
      const evidencia = this.validarEvidencia(dto.evidencia);
      if (evidencia === null)
        throw new BadRequestException(
          `El tipo de evidencia es obligatorio. Valores permitidos: ${EVIDENCIAS.join(', ')}.`,
        );
      datos.evidencia = evidencia;
    }
    if ('fecha' in dto)
      datos.fecha = dto.fecha
        ? aFechaUTC(dto.fecha, 'La fecha de la actividad')
        : null;
    if ('responsableId' in dto)
      datos.responsableId = await this.validarResponsable(dto.responsableId);

    if ('estado' in dto) {
      const estado = this.validarEstado(dto.estado);
      if (estado === null)
        throw new BadRequestException(
          'El estado de la actividad no puede ir vacío.',
        );
      datos.estado = estado;
      Object.assign(datos, this.marcaDeCompletada(estado, usuario));
    }

    const actividad = await this.prisma.actividadFotos.update({
      where: { id: actividadId },
      data: datos,
      select: SELECT_ACTIVIDAD,
    });

    await this.acceso.marcarActividad(carpeta.ruta);

    // Un evento POR CAMPO que cambió, con su valor anterior (§23). §23 no
    // nombra «editar actividad» entre sus trece acciones —sí «crear» y
    // «completar»—, pero una carpeta ya lo registra y no tenerlo aquí
    // dejaba un agujero raro: se sabía quién creó la actividad y quién la dio
    // por hecha, pero no quién le cambió el responsable por el camino.
    const comoTexto = (t: typeof antes) => ({
      titulo: t.titulo,
      descripcion: t.descripcion,
      estado: t.estado,
      prioridad: t.prioridad ?? null,
      evidencia: t.evidencia,
      fecha: t.fecha ? claveDia(t.fecha) : null,
      responsable: t.responsable?.nombre ?? null,
    });

    await this.auditoria.registrar(
      usuario,
      this.auditoria.diferencias(comoTexto(antes), comoTexto(actividad), {
        carpetaId: carpeta.id,
        entidad: 'ACTIVIDAD',
        entidadId: actividadId,
      }),
    );

    return this.conFecha(actividad);
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
    actividadId: number,
    completada: boolean,
  ) {
    const { carpeta } = await this.actividadConPermiso(
      usuario,
      actividadId,
      'EDICION',
    );
    const estado: EstadoActividadFotos = completada
      ? 'COMPLETADA'
      : 'PENDIENTE';

    const actividad = await this.prisma.actividadFotos.update({
      where: { id: actividadId },
      data: { estado, ...this.marcaDeCompletada(estado, usuario) },
      select: SELECT_ACTIVIDAD,
    });

    await this.acceso.marcarActividad(carpeta.ruta);

    // §23, acción 4. Es la que HVC quiere poder auditar de verdad: quién dio
    // por hecho qué, y cuándo.
    await this.auditoria.registrar(usuario, {
      carpetaId: carpeta.id,
      entidad: 'ACTIVIDAD',
      entidadId: actividad.id,
      accion: completada ? 'ACTIVIDAD_COMPLETADA' : 'ACTIVIDAD_REABIERTA',
      descripcion: `${completada ? 'Completó' : 'Reabrió'} "${actividad.titulo}".`,
    });
    return this.conFecha(actividad);
  }

  /**
   * Borrar. La propia con EDICION; la ajena exige TOTAL.
   *
   * Es la misma distinción que §5 hace con las fotos —la propia se borra
   * con EDICION, la ajena con TOTAL—: retirar lo que uno mismo puso es
   * parte de trabajar; retirar lo de otro es administrar.
   */
  async eliminar(usuario: UsuarioAutenticado, actividadId: number) {
    const previa = await this.prisma.actividadFotos.findUnique({
      where: { id: actividadId },
      select: { creadoPorId: true },
    });
    if (!previa)
      throw new NotFoundException(noExisteOSinAcceso('Esa actividad'));

    const esPropia = previa.creadoPorId === usuario.id;
    const { carpeta } = await this.actividadConPermiso(
      usuario,
      actividadId,
      esPropia ? 'EDICION' : 'TOTAL',
    );

    // Las fotos de la actividad la seguirían: `Foto.actividadId` es Cascade. Se
    // corta antes para que borrar una actividad no se lleve por delante fotos
    // que documentan el trabajo — quedan en la bandeja de §18.
    const conFotos = await this.prisma.foto.count({ where: { actividadId } });
    if (conFotos > 0)
      throw new BadRequestException(
        `No se puede eliminar: la actividad tiene ${conFotos} foto(s). Muévelas o elimínalas antes.`,
      );

    await this.prisma.actividadFotos.delete({ where: { id: actividadId } });
    await this.acceso.marcarActividad(carpeta.ruta);

    // §23 no la nombra, pero es destructiva y se lleva comentarios por
    // cascada: se registra por el mismo criterio que eliminar una carpeta.
    await this.auditoria.registrar(usuario, {
      carpetaId: carpeta.id,
      entidad: 'ACTIVIDAD',
      entidadId: actividadId,
      accion: 'ELIMINACION',
      descripcion: 'Eliminó una actividad.',
    });
    return { ok: true, id: actividadId };
  }
}
