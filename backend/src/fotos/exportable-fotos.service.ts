import { Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/tipos';
import type { Exportable } from '../common/exportacion.service';
import type { AccionFotos, EntidadFotos } from '../../generated/prisma/enums';
import { AccesoService } from './acceso.service';
import { TareaService } from './tarea.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';

/**
 * ⚠️ **Hay DOS formateadores y no se pueden intercambiar**, porque las dos
 * clases de fecha del módulo no significan lo mismo:
 *
 * - `diaCalendario` es para los `@db.Date` —`TareaFotos.fecha`, y los
 *   `desde`/`hasta` de los filtros—. Se leen en **UTC**, que es la regla del
 *   proyecto (`common/fechas.ts`): un día calendario no tiene hora, así que
 *   pasarlo por una zona horaria solo puede correrlo.
 * - `instanteLima` es para los `DateTime` de verdad —`creadoEn` de la
 *   bitácora, `completadaEn` de una tarea—. Ésos SÍ son un momento, y hay
 *   que enseñarlos en la hora de quien lee.
 *
 * Mezclarlos no da un error, da un documento que miente: con el formateador
 * UTC, la bitácora fechaba a las 23:00 de Lima como del día siguiente a las
 * 04:00 —cinco horas de desfase en el archivo que responde «quién hizo qué y
 * cuándo»—, y una tarea completada al final de la tarde figuraba completada
 * mañana. Se vio al leer el primer Excel generado.
 */
const ZONA = 'America/Lima';

function diaCalendario(f: Date | string | null | undefined): string {
  if (!f) return '—';
  const d = typeof f === 'string' ? new Date(f) : f;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10).split('-').reverse().join('/');
}

function instanteLima(f: Date | string | null | undefined): string {
  if (!f) return '—';
  const d = typeof f === 'string' ? new Date(f) : f;
  if (Number.isNaN(d.getTime())) return '—';
  // `sv-SE` da «YYYY-MM-DD HH:mm», que es el único formato de `toLocaleString`
  // que sale ya ordenado y sin ambigüedad de día/mes; se le da la vuelta a la
  // fecha para leerla como aquí se escribe.
  const [fecha, hora] = d
    .toLocaleString('sv-SE', {
      timeZone: ZONA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .split(' ');
  return `${fecha.split('-').reverse().join('/')} ${hora}`;
}

/** Un `DateTime` del que solo interesa el día, ya en hora de Lima. */
function diaLima(f: Date | string | null | undefined): string {
  const t = instanteLima(f);
  return t === '—' ? t : t.slice(0, 10);
}

const guion = (v: string | null | undefined) => v ?? '—';

/**
 * Los enums, en castellano y en minúscula donde toca.
 *
 * Mismo motivo que `ESTADO_COTIZACION` en Costos: el papel lo lee una
 * persona. `EQUIPO_CREADO_DESDE_FOTOS` en una columna estrecha se parte por
 * los guiones bajos y queda ilegible.
 *
 * Son `Record<Enum, string>` completos —no `Partial`— para que añadir un
 * valor al enum NO compile hasta decidir cómo se dice en la exportación.
 * Es el mismo criterio que `INICIO_ROL_COSTOS` en el frontend.
 */
const ETIQUETA_ESTADO_TAREA: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
};

const ETIQUETA_PRIORIDAD: Record<string, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
};

const ETIQUETA_ACCION: Record<AccionFotos, string> = {
  CREACION: 'Creación',
  EDICION: 'Edición',
  ELIMINACION: 'Eliminación',
  MOVIMIENTO: 'Movimiento',
  ARCHIVADO: 'Archivado',
  REAPERTURA: 'Reapertura',
  TAREA_COMPLETADA: 'Tarea completada',
  TAREA_REABIERTA: 'Tarea reabierta',
  SUBIDA_FOTO: 'Subida de foto',
  DESCARGA_FOTO: 'Descarga de foto',
  CLASIFICACION: 'Clasificación',
  COMPARTIR: 'Compartir',
  CAMBIO_PERMISO: 'Cambio de permiso',
  REVOCAR_ACCESO: 'Revocar acceso',
  INVITACION_ENVIADA: 'Invitación enviada',
  INVITACION_ACEPTADA: 'Invitación aceptada',
  IMPORTACION_EXCEL: 'Importación por Excel',
  CREACION_DESDE_PLANTILLA: 'Creación desde plantilla',
  EQUIPO_CREADO_DESDE_FOTOS: 'Equipo creado desde Fotos',
};

const ETIQUETA_ENTIDAD: Record<EntidadFotos, string> = {
  CARPETA: 'Carpeta',
  CAMPO_EQUIPO: 'Campo de equipo',
  ALBUM: 'Álbum',
  TAREA: 'Tarea',
  COMENTARIO: 'Comentario',
  FOTO: 'Foto',
  ACCESO: 'Acceso',
  INVITACION: 'Invitación',
  PLANTILLA: 'Plantilla',
  IMPORTACION: 'Importación',
  EQUIPO: 'Equipo',
};

/** Lo que la bitácora devuelve, visto desde aquí. */
interface EventoExportable {
  creadoEn: Date;
  usuarioNombre: string | null;
  accion: AccionFotos;
  entidad: EntidadFotos;
  entidadId: number;
  campoAfectado: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  descripcion: string | null;
  ip: string | null;
  carpeta?: { id: number; nombre: string } | null;
}

/**
 * Las descargas del módulo Fotos (§69).
 *
 * Service de solo lectura, hermano del `ExportableService` de Costos y con
 * su misma regla, que es la que da sentido a §69: **no recalcula ni vuelve a
 * consultar nada**. Traduce a `Exportable` lo que ya respondieron
 * `TareaService` y `AuditoriaFotosService`, así que el archivo dice
 * exactamente lo que dice la pantalla. Si armara sus propias consultas
 * habría dos verdades, y la de papel es la que se archiva.
 *
 * ⚠️ Y **tampoco vuelve a decidir permisos**, que es la otra mitad de la
 * misma idea. Cada método entra por la puerta normal del service que lee
 * —`tareas.listar` exige LECTURA sobre la carpeta, `auditoria.consultar`
 * exige ADMIN_GLOBAL, `auditoria.deCarpeta` exige LECTURA— así que exportar
 * no puede enseñar nada que la pantalla no enseñe. Una exportación con su
 * propia comprobación de acceso es una segunda política que mantener a la
 * par, y la primera vez que se quedara corta sería un archivo en el disco de
 * alguien.
 *
 * Se apoya en `common/exportacion.service.ts`, el mismo generador que usan
 * Equipos y Costos —incluida la corrección del alto de fila del PDF—.
 */
@Injectable()
export class ExportableFotosService {
  constructor(
    private readonly acceso: AccesoService,
    private readonly tareas: TareaService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /**
   * El listado de tareas de una carpeta (§13, §69).
   *
   * Es lo que un supervisor se lleva a obra o adjunta a un informe: qué hay
   * que hacer en este equipo, quién lo tiene y qué falta.
   *
   * Respeta el filtro de estado que traiga la pantalla, porque exportar «lo
   * que estoy viendo» es lo que se espera al pulsar el botón; un archivo con
   * más filas que la tabla de al lado parece un fallo.
   */
  async tareasDeCarpeta(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    filtros: { estado?: string | null } = {},
  ): Promise<Exportable> {
    // `listar` ya exige LECTURA: si no la tiene, no llegamos a la línea
    // siguiente y la negativa es el 404 uniforme del módulo.
    const tareas = await this.tareas.listar(usuario, carpetaId, filtros);
    const carpeta = await this.acceso.carpetaPorId(carpetaId);

    const pendientes = tareas.filter((t) => t.estado !== 'COMPLETADA').length;

    return {
      titulo: `Tareas · ${carpeta.nombre}`,
      nombreArchivo: `tareas-${carpeta.nombre}`,
      datos: [
        { etiqueta: 'Carpeta', valor: carpeta.nombre },
        // ⚠️ Aquí iba una fila «Equipo» con el `codigoInterno` del catálogo
        // de Gestión de Equipos. Se retiró en la Fase 1a de «Gestión de
        // contenido» junto con la FK, y no se sustituye por `tipo`: las
        // tareas solo existen dentro de una carpeta de tipo EQUIPO (§13),
        // así que esa fila diría siempre lo mismo, y el nombre de la
        // carpeta YA es el del equipo. Cuando la Fase 1b traiga los campos
        // configurables, este encabezado es el sitio donde ponerlos.
        {
          etiqueta: 'Filtro de estado',
          valor: filtros.estado
            ? (ETIQUETA_ESTADO_TAREA[filtros.estado] ?? filtros.estado)
            : 'Todas',
        },
        { etiqueta: 'Total de tareas', valor: String(tareas.length) },
        { etiqueta: 'Sin completar', valor: String(pendientes) },
        { etiqueta: 'Generado', valor: instanteLima(new Date()) },
      ],
      bloques: [
        {
          titulo: 'Tareas',
          vacio: 'Esta carpeta no tiene tareas registradas.',
          columnas: [
            { titulo: '#', ancho: 6, anchoPdf: 24 },
            { titulo: 'Tarea', ancho: 34, anchoPdf: 150 },
            { titulo: 'Estado', ancho: 13, anchoPdf: 62 },
            { titulo: 'Prioridad', ancho: 11, anchoPdf: 52 },
            { titulo: 'Responsable', ancho: 22, anchoPdf: 92 },
            { titulo: 'Fecha', ancho: 12, anchoPdf: 58 },
            { titulo: 'Fotos', ancho: 8, anchoPdf: 36, derecha: true },
            { titulo: 'Completada', ancho: 24, anchoPdf: 96 },
          ],
          filas: tareas.map((t, n) => [
            n + 1,
            t.titulo,
            ETIQUETA_ESTADO_TAREA[t.estado] ?? t.estado,
            // §13 marca la prioridad OPCIONAL, así que aquí llega null a
            // menudo — HVC no la exige para el flujo básico.
            t.prioridad
              ? (ETIQUETA_PRIORIDAD[t.prioridad] ?? t.prioridad)
              : '—',
            guion(t.responsable?.nombre),
            diaCalendario(t.fecha),
            t._count.fotos,
            // Las tres columnas de `marcaDeCompletada` se llenan y se vacían
            // juntas, así que basta preguntar por una.
            t.completadaEn
              ? `${guion(t.completadaPor?.nombre)} · ${diaLima(t.completadaEn)}`
              : '—',
          ]),
        },
      ],
    };
  }

  /**
   * La bitácora del módulo entero (§23, §69).
   *
   * `consultar` exige ADMIN_GLOBAL, así que este método hereda ese mínimo
   * sin repetirlo.
   *
   * ⚠️ Exporta **una página**, no la bitácora completa: `consultar` pagina
   * por cursor y su tope duro son 200 filas. Es a propósito y el archivo lo
   * dice en su cabecera —«Eventos en este archivo»—: una bitácora solo crece
   * y un botón que intente volcarla entera acabaría fallando por tiempo el
   * día que HVC lleve un año usando el módulo. Quien necesite un periodo
   * concreto lo acota con los filtros de fecha, que es como se consulta una
   * auditoría de verdad.
   */
  async auditoriaDelModulo(
    usuario: UsuarioAutenticado,
    filtros: {
      usuarioId?: number;
      accion?: AccionFotos;
      entidad?: EntidadFotos;
      desde?: string;
      hasta?: string;
      cursor?: number;
      limite?: number;
    },
  ): Promise<Exportable> {
    const { eventos, siguiente } = await this.auditoria.consultar(usuario, {
      ...filtros,
      limite: filtros.limite ?? 200,
    });

    return {
      titulo: 'Auditoría de Fotos',
      nombreArchivo: 'auditoria-fotos',
      datos: [
        {
          etiqueta: 'Desde',
          valor: filtros.desde ? diaCalendario(filtros.desde) : '(sin límite)',
        },
        {
          etiqueta: 'Hasta',
          valor: filtros.hasta ? diaCalendario(filtros.hasta) : '(sin límite)',
        },
        {
          etiqueta: 'Acción',
          valor: filtros.accion ? ETIQUETA_ACCION[filtros.accion] : 'Todas',
        },
        {
          etiqueta: 'Entidad',
          valor: filtros.entidad ? ETIQUETA_ENTIDAD[filtros.entidad] : 'Todas',
        },
        { etiqueta: 'Eventos en este archivo', valor: String(eventos.length) },
        {
          etiqueta: 'Quedan más',
          valor: siguiente
            ? 'Sí — acota el rango de fechas para verlos'
            : 'No, es todo lo que hay',
        },
        { etiqueta: 'Generado', valor: instanteLima(new Date()) },
      ],
      bloques: [this.bloqueDeEventos(eventos, true)],
    };
  }

  /**
   * El hilo de UNA carpeta (§23, §69): «qué le ha pasado a esto».
   *
   * `deCarpeta` exige LECTURA sobre ella, así que —al revés que la anterior—
   * ésta la puede sacar el supervisor que trabaja dentro, no solo el
   * administrador. Son dos preguntas distintas y por eso son dos archivos.
   */
  async auditoriaDeCarpeta(
    usuario: UsuarioAutenticado,
    carpetaId: number,
  ): Promise<Exportable> {
    const eventos = await this.auditoria.deCarpeta(usuario, carpetaId);
    const carpeta = await this.acceso.carpetaPorId(carpetaId);

    return {
      titulo: `Historial · ${carpeta.nombre}`,
      nombreArchivo: `historial-${carpeta.nombre}`,
      datos: [
        { etiqueta: 'Carpeta', valor: carpeta.nombre },
        { etiqueta: 'Eventos', valor: String(eventos.length) },
        { etiqueta: 'Generado', valor: instanteLima(new Date()) },
      ],
      // Sin columna de carpeta: todas las filas son de ésta, y ya está en la
      // cabecera. Una columna con el mismo valor repetido es ancho gastado.
      bloques: [this.bloqueDeEventos(eventos, false)],
    };
  }

  /**
   * La tabla de eventos, que es la misma en los dos archivos salvo por la
   * columna de carpeta. Escribirla dos veces era garantizar que un día
   * dijeran cosas distintas.
   */
  private bloqueDeEventos(eventos: EventoExportable[], conCarpeta: boolean) {
    return {
      titulo: 'Eventos',
      vacio: 'No hay eventos registrados para estos filtros.',
      columnas: [
        { titulo: 'Fecha y hora', ancho: 17, anchoPdf: 78 },
        { titulo: 'Usuario', ancho: 22, anchoPdf: 84 },
        { titulo: 'Acción', ancho: 24, anchoPdf: 96 },
        { titulo: 'Entidad', ancho: 12, anchoPdf: 52 },
        ...(conCarpeta ? [{ titulo: 'Carpeta', ancho: 24, anchoPdf: 88 }] : []),
        { titulo: 'Detalle', ancho: 46, anchoPdf: 150 },
        { titulo: 'IP', ancho: 15, anchoPdf: 62 },
      ],
      filas: eventos.map((e) => [
        instanteLima(e.creadoEn),
        // `usuarioNombre` va en texto además de la FK justamente para esto:
        // dar de baja una cuenta no puede dejar la auditoría sin firma.
        guion(e.usuarioNombre),
        ETIQUETA_ACCION[e.accion] ?? e.accion,
        `${ETIQUETA_ENTIDAD[e.entidad] ?? e.entidad} #${e.entidadId}`,
        ...(conCarpeta ? [guion(e.carpeta?.nombre)] : []),
        this.detalle(e),
        guion(e.ip),
      ]),
    };
  }

  /**
   * Una sola columna de «qué pasó», y no tres.
   *
   * Un evento trae descripción O un cambio de campo, casi nunca los dos, así
   * que tres columnas (campo / antes / después) habrían salido vacías en la
   * mayoría de las filas mientras estrechaban las que sí se leen.
   */
  private detalle(e: EventoExportable): string {
    const cambio = e.campoAfectado
      ? `${e.campoAfectado}: ${e.valorAnterior ?? '(vacío)'} → ${e.valorNuevo ?? '(vacío)'}`
      : null;

    return [e.descripcion, cambio].filter(Boolean).join(' · ') || '—';
  }
}
