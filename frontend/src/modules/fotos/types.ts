import type { RolGlobal } from '@/modules/auth/types';

// ─────────────────────────────────────────────────────────────
// MÓDULO FOTOS (v3)
// Carpetas, álbumes, actividades y fotos. El único estado de una carpeta es
// `cerrada` (archivada): el par ACTIVA/INACTIVA de v2 se retiró, porque
// nadie lo hacía cumplir y se pisaba visualmente con el archivado.
// ─────────────────────────────────────────────────────────────

/**
 * Lo que alguien puede hacer DENTRO de una carpeta (§5).
 *
 * Lo calcula el backend con la cascada de §25 y llega ya resuelto: el
 * frontend NUNCA lo deduce del rol ni del nivel. Repetir aquí esa cascada
 * sería tener dos versiones de la misma regla, y la que manda es la del
 * servidor.
 */
export type PermisoCarpeta = 'SIN_ACCESO' | 'LECTURA' | 'EDICION' | 'TOTAL';

/** Una carpeta tal como sale en el explorador. */
export interface CarpetaListada {
  id: number;
  nombre: string;
  /** Archivada: la rama entera es de solo lectura. */
  cerrada: boolean;
  subcarpetas: number;
  /** Contadores de TODO el subárbol, no solo de lo que cuelga directo. */
  /**
   * Cuántas fotos hay en todo el subárbol que este usuario ve.
   *
   * ⚠️ Aquí iba también `albumes`. Se fue con ellos en la Fase 4: el otro
   * agrupador sería «visitas», que es un dato del equipo y no del subárbol.
   */
  fotos: number;
  /** Se propaga hacia arriba cuando algo cambia dentro. */
  actualizadoEn: string;
  /** Lo que este usuario puede hacer aquí. Decide qué acciones se pintan. */
  permiso: PermisoCarpeta;
  /**
   * ⚠️ Aquí acompañaba un `equipo` con el código del catálogo de Gestión de
   * Equipos. Se retiró en la Fase 1a de «Gestión de contenido»: Fotos ya no
   * referencia ese módulo. Los campos propios del equipo llegan en la Fase
   * 1b, y a la carpeta que se abre — no a cada tarjeta del listado.
   */
  tipo: 'CARPETA' | 'EQUIPO';
  /**
   * El estado del equipo en su ciclo MÁS RECIENTE (§7), para verlo sin entrar.
   *
   * `null` en una carpeta corriente —no tiene ciclos— y en un equipo cuya
   * visita en curso todavía no se ha revisado.
   *
   * ⚠️ Se llama `estadoEquipo` y no `estado` porque la tarjeta YA tuvo un
   * `estado` que significaba otra cosa: el `EstadoSede` ACTIVA/INACTIVA que
   * v3 retiró.
   */
  estadoEquipo: EstadoEquipo | null;
}

/**
 * Un escalón del camino ancestral.
 * `navegable: false` = contexto informativo, sin enlace: quien lo ve no
 * tiene acceso a su contenido.
 */
export interface Ancestro {
  id: number;
  nombre: string;
  navegable: boolean;
}

/**
 * Un grupo de carpetas con su rótulo (§8, §21).
 *
 * Siempre vienen secciones, también dentro de una carpeta —donde hay una
 * sola, «Carpetas»—, para recorrer una única forma. Las vacías no llegan.
 */
export interface SeccionCarpetas {
  clave: 'todas' | 'propias' | 'compartidas' | 'contenido' | 'busqueda';
  etiqueta: string;
  carpetas: CarpetaListada[];
}

/** Cómo ordenar un listado (§11). */
export type Orden = 'nombre' | 'nombre-desc' | 'reciente' | 'antiguo';

export interface ContenidoCarpeta {
  ancestros: Ancestro[];
  carpetaActual: {
    id: number;
    nombre: string;
    cerrada: boolean;
    actualizadoEn: string;
    /** Desde la Fase 5: si es EQUIPO, la pantalla ofrece las actividades de §13. */
    tipo: 'CARPETA' | 'EQUIPO';
    /**
     * Qué clase de sistema es (Fase 2). `null` en una carpeta corriente y en
     * un equipo al que nadie se lo ha puesto — es opcional como todo lo del
     * equipo, para no trabar el alta en obra.
     */
    tipoSistema: TipoSistema | null;
  } | null;
  /** Si puede subir fotos y crear carpetas aquí. */
  puedeEscribir: boolean;
  /** Su permiso sobre la carpeta actual. `null` en la raíz, que no es una. */
  permiso: PermisoCarpeta | null;
  /** La carpeta o alguna por encima está archivada. */
  ramaCerrada: boolean;
  /** El texto buscado, o null si esto es un listado normal. */
  busqueda: string | null;
  secciones: SeccionCarpetas[];
}

export interface FotoDeGaleria {
  id: number;
  anchoPx: number;
  altoPx: number;
  bytes: number;
  /** Fecha EXIF de captura, "YYYY-MM-DD". Puede no venir. */
  tomadaEn: string | null;
  creadoEn: string;
  /**
   * La suya propia. Nace siendo la del LOTE —`subir` la copia a todas— y
   * desde la Fase 2b se puede corregir foto a foto.
   */
  descripcion: string | null;
  /** null para un cliente externo: no se le enseña quién subió qué. */
  subidaPor: { id: number; nombre: string } | null;
  url: string;
  urlMiniatura: string;
  /** Cuántos comentarios tiene. Solo en la galería del ciclo. */
  comentarios?: number;
}

/**
 * La galería de una VISITA: una lista plana de fotos, paginada por cursor.
 *
 * ⚠️ Tenía un nivel de ÁLBUM en medio (`AlbumDeGaleria`), con las fotos
 * anidadas dentro. Se retiró en la Fase 4: el agrupador es el ciclo, y ese
 * ya lo elige la pantalla antes de pedir esto. Se gana lo que costaba el
 * nivel de más — una foto se busca por su fecha o por quién la subió, no
 * por en qué tanda entró.
 */
export interface Galeria {
  fotos: FotoDeGaleria[];
  /** Cursor de la página siguiente; null cuando ya no queda nada. */
  siguiente: number | null;
  totalFotos: number;
}

/** Quién ha subido fotos a una visita. Para el filtro de la galería. */
export interface AutorDeCarpeta {
  usuarioId: number;
  nombre: string;
  fotos: number;
}

export interface FiltrosGaleria {
  subidaPorId: number | null;
  desde: string;
  hasta: string;
}

export interface ResultadoSubida {
  /** A qué visita fueron. `null` en la bandeja y en las de actividad. */
  cicloId: number | null;
  subidas: number;
  fallidas: { archivo: string; motivo: string }[];
  bytesGuardados: number;
  bytesOriginales: number;
}

// ── Compartir ──

/** Carpeta ofrecida en el selector, con su ruta para armar el árbol. */
export interface CarpetaCompartible {
  id: number;
  nombre: string;
  parentId: number | null;
  ruta: string;
}

export interface AccesoCompartido {
  id: number;
  creadoEn: string;
  usuario: { id: number; nombre: string; email: string; rol: RolGlobal };
  otorgadoPor: { id: number; nombre: string };
  permiso: PermisoCarpeta;
}

export interface InvitacionPendiente {
  id: number;
  email: string;
  expiraEn: string;
  creadoEn: string;
  invitadoPor: { id: number; nombre: string };
  /** El grado que concederá al aceptarse, sobre la carpeta consultada. */
  permiso: PermisoCarpeta | null;
  vencida: boolean;
}

export interface ListaCompartidos {
  accesos: AccesoCompartido[];
  invitaciones: InvitacionPendiente[];
}

export interface ResultadoCompartir {
  via: 'acceso-directo' | 'invitacion';
  email: string;
  nombre?: string;
  rol?: RolGlobal;
  /** Solo cuando fue invitación. */
  enlace?: string;
  expiraEn?: string;
  /** Las que quedaron compartidas ahora. */
  carpetas: { id: number; nombre: string }[];
  /** Las que ya tenía y se dejaron como estaban. */
  yaTenia: { id: number; nombre: string }[];
}

/** Lo que hay detrás de un enlace de invitación, antes de activar. */
export interface InvitacionAbierta {
  email: string;
  recurso: string;
  invitadoPor: string;
  expiraEn: string;
}

// ── Catálogo de equipos — RETIRADO ──
//
// Aquí vivían `OrganizacionDeCatalogo`, `EquipoDeCatalogo`,
// `UbicacionDeCatalogo`, `ColumnaDeCatalogo` y `BusquedaDeEquipos`: las
// formas que devolvía `/fotos/catalogo-equipos`, la puerta de Fotos al
// catálogo de Gestión de Equipos (§12). Se retiraron enteras en la Fase 1a
// de «Gestión de contenido» junto con el selector de tres pasos.
//
// Si buscas los tipos del catálogo de equipos, están donde siempre
// estuvieron los de ese módulo: `modules/equipos/types.ts`.

// ── Color por tipo de carpeta (Fase 1c) ──

export type ColorCarpeta = 'AMARILLO' | 'CELESTE';

/**
 * Qué color usa cada tipo de carpeta en el explorador.
 *
 * Es un dato CONFIGURABLE que llega del servidor, no una constante: un
 * administrador puede cambiarlo sin tocar código. Lo que sí es cerrado es la
 * paleta —`ColorCarpeta`—, porque Tailwind solo genera las clases que ve
 * escritas y `bg-${loQueDiga}` no existiría en el CSS compilado.
 */
export type ColoresDeCarpeta = Record<'CARPETA' | 'EQUIPO', ColorCarpeta>;

// ── Campos configurables del EQUIPO (Fase 1b) ──
//
// Sustituyen al enlace con el catálogo de Gestión de Equipos: la
// información del equipo la define un ADMIN_GLOBAL, sin tocar código.

export type TipoCampoFotos =
  | 'TEXTO'
  | 'TEXTO_LARGO'
  | 'NUMERO'
  | 'FECHA'
  | 'BOOLEANO'
  | 'LISTA'
  | 'FOTO';

export interface OpcionCampo {
  id: number;
  etiqueta: string;
  orden?: number;
  /** `false` = ya no se ofrece, pero quien la eligió la conserva. */
  activo: boolean;
}

/** Una definición, tal como la devuelve la administración del módulo. */
export interface CampoEquipo {
  id: number;
  nombre: string;
  /** Slug estable. Es la clave con la que se mandan los valores. */
  clave: string;
  tipo: TipoCampoFotos;
  orden: number;
  activo: boolean;
  opciones: OpcionCampo[];
  /** Cuántos equipos lo tienen rellenado: con >0 no se puede borrar. */
  _count?: { valores: number };
}

/**
 * Un campo CON lo que esta carpeta tenga rellenado.
 *
 * `valor` viene ya con la forma de su tipo —el backend decide en qué
 * columna del EAV vive cada uno, y aquí no hay que saberlo—: texto,
 * número, `"AAAA-MM-DD"`, booleano, el id de la opción elegida, o
 * `true`/`false` en un FOTO según tenga imagen.
 *
 * ⚠️ Tipo PROPIO y no `CampoEquipo` reutilizado, aunque compartan casi
 * todo: son dos proyecciones distintas del mismo recurso y TypeScript
 * FUSIONA dos interfaces con el mismo nombre en vez de rechazarlas —fue
 * exactamente lo que pasó con las dos `interface Album` de la Fase 9a, que
 * compilaba prometiendo campos que el endpoint nunca devolvió—.
 */
export interface CampoDeCarpeta {
  id: number;
  nombre: string;
  clave: string;
  tipo: TipoCampoFotos;
  activo: boolean;
  opciones: OpcionCampo[];
  valor: string | number | boolean | null;
  /** Solo en un campo FOTO con imagen. Las URLs son firmadas y caducan. */
  imagen: { url: string; urlMiniatura: string | null } | null;
}

// ── Actividades (§13) y comentarios (§14) ──

// ── Ciclos y estado del equipo (Fase 1 del rediseño) ──

/**
 * La paleta de los estados de equipo. Cerrada, como la de las carpetas.
 *
 * ⚠️ Pero se pinta de otra manera, y la diferencia importa. El color de una
 * CARPETA se mapea a tokens de matiz (`--amarillo`, `--celeste`) porque ahí
 * el significado ES el color: amarillo no quiere decir nada más que
 * «carpeta». Aquí sí hay significado detrás —operativo, con observaciones,
 * inoperativo— y el sistema ya tiene la familia semántica que lo dice:
 * `success` / `warning` / `destructive`. Inventar tokens de matiz habría
 * dejado dos maneras de pintar «esto va mal».
 */
export type ColorEstado = 'VERDE' | 'NARANJA' | 'ROJO';

/** Un estado del catálogo configurable (§7). Lo administra un ADMIN_GLOBAL. */
export interface EstadoEquipo {
  id: number;
  nombre: string;
  color: ColorEstado;
  orden: number;
  activo: boolean;
  /** Cuántos ciclos lo usan. Solo llega en la pantalla de administración. */
  _count?: { ciclos: number };
}

/**
 * Una visita al equipo.
 *
 * ⚠️ `cerradoEn` no es un detalle de auditoría: es el candado. Un ciclo
 * cerrado no admite cambios de NADIE —tampoco de un ADMIN_GLOBAL— y de ahí
 * sale el `deshabilitado` de la pantalla de actividades.
 */
export interface Ciclo {
  id: number;
  numero: number;
  abiertoEn: string;
  cerradoEn: string | null;
  estado: EstadoEquipo | null;
  abiertoPor: Persona | null;
  cerradoPor: Persona | null;
  /** Solo en el listado, no en el detalle. */
  _count?: { actividades: number };
}

// ── Tipo de sistema y catálogo de actividades (Fase 2 del rediseño) ──

/** «Aire Acondicionado», «Ventilación», y lo que HVC añada. */
export interface FamiliaSistema {
  id: number;
  nombre: string;
  orden: number;
  activo: boolean;
  /** Solo en el listado completo, que es como se pinta el desplegable. */
  tipos?: TipoSistema[];
}

export interface TipoSistema {
  id: number;
  nombre: string;
  orden: number;
  activo: boolean;
  familiaId?: number;
  /** Viaja con el tipo cuando se lee desde un equipo o desde el catálogo. */
  familia?: { id: number; nombre: string };
  _count?: { carpetas: number; actividades: number };
}

/**
 * Una actividad del catálogo estándar.
 *
 * ⚠️ NO es una actividad de una visita. Ésta es la PROPUESTA; lo que se
 * recorre en un ciclo es una `Actividad`, que copió el nombre y vive por su
 * cuenta — por eso renombrar aquí no cambia una inspección ya hecha.
 */
export interface DefinicionActividad {
  id: number;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  /** Qué evidencia propone pedir (Fase 3). Se copia a la actividad. */
  evidencia: TipoEvidencia;
  /** Para qué tipos de sistema se propone. */
  tipos: TipoSistema[];
}

// ── Evidencia fotográfica por actividad (Fase 3 del rediseño) ──

/**
 * Qué se espera fotografiar en una actividad.
 *
 * ⚠️ Es una EXPECTATIVA, no un candado: una actividad se completa aunque le
 * falte la foto. Lo que hace el sistema es DECIRLO —en la tarjeta y en la
 * exportación—; trabar el check por esto sería el fallo que el módulo evita
 * en todas partes.
 */
export type TipoEvidencia = 'NINGUNA' | 'UNA' | 'ANTES_DESPUES';

/** En qué mitad del antes/después cae una foto. `null` en todo lo demás. */
export type MomentoEvidencia = 'ANTES' | 'DESPUES';

export type EstadoActividad = 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA';
export type PrioridadActividad = 'BAJA' | 'MEDIA' | 'ALTA';

/** Quién hizo algo. Se repite en actividad y comentario, y es la misma forma. */
export interface Persona {
  id: number;
  nombre: string;
}

export interface Actividad {
  id: number;
  /** De qué visita es. Sustituye a `carpetaId` desde la Fase 1. */
  cicloId: number;
  titulo: string;
  descripcion: string | null;
  estado: EstadoActividad;
  prioridad: PrioridadActividad | null;
  /** El día del trabajo, "YYYY-MM-DD". No es el de creación. */
  fecha: string | null;
  /**
   * Fecha/hora y autor de la finalización (§13). Van SIEMPRE juntos: o los
   * dos con valor, o los dos en null. Reabrir una actividad los vacía.
   */
  completadaEn: string | null;
  completadaPor: Persona | null;
  responsable: Persona | null;
  creadoPor: Persona;
  creadoEn: string;
  actualizadoEn: string;
  _count: { fotos: number; comentarios: number };
  /** Qué evidencia se le pide (Fase 3). Se hereda entre ciclos. */
  evidencia: TipoEvidencia;
  /**
   * Los tres las CALCULA el servidor a partir de las fotos; no se guardan.
   * `faltaEvidencia` es la señal que se pinta, y no impide completar nada.
   */
  tieneAntes: boolean;
  tieneDespues: boolean;
  faltaEvidencia: boolean;
}

export interface NuevaActividad {
  titulo: string;
  descripcion?: string | null;
  estado?: EstadoActividad;
  prioridad?: PrioridadActividad | null;
  fecha?: string | null;
  responsableId?: number | null;
  evidencia?: TipoEvidencia;
}

/**
 * Dónde se puede comentar (§14).
 *
 * §14 nombra cuatro —carpeta, equipo, actividad, álbum— y aquí hay `carpeta`
 * cubriendo dos: un equipo ES una carpeta de tipo EQUIPO (§12), así que
 * comentar un equipo y comentar una carpeta son la misma llamada. `foto` es
 * el opcional de §14, con ruta desde la Fase 6 y pantalla desde la 9a.
 */
export type EntidadComentable = 'carpeta' | 'actividad' | 'album' | 'foto';

export interface Comentario {
  id: number;
  texto: string;
  /** Se guarda ADEMÁS del autor: dar de baja una cuenta no borra la firma. */
  autorNombre: string;
  autor: Persona | null;
  creadoEn: string;
  /** null = nunca editado. §14 pide distinguirlo de «editado al crearse». */
  editadoEn: string | null;
}

// ── Bandeja (§17-§18) ──
//
// ⚠️ Aquí vivía `Album`, el de §16. Los álbumes se retiraron en la Fase 4 del
// rediseño: una foto cuelga de un CICLO o de una ACTIVIDAD, y no hay ningún
// endpoint que devuelva un álbum. La tabla sobrevive en la base solo para que
// los comentarios que se escribieron sobre uno no se pierdan.

/** Una foto de la bandeja de §18: sin ciclo y sin actividad todavía. */
export interface FotoPendiente {
  id: number;
  descripcion: string | null;
  anchoPx: number;
  altoPx: number;
  bytes: number;
  tomadaEn: string | null;
  creadoEn: string;
  url: string;
  urlMiniatura: string;
}

export interface Bandeja {
  total: number;
  fotos: FotoPendiente[];
}

/**
 * A dónde van unas fotos.
 *
 * Los TRES sitios donde puede estar una foto desde la Fase 4: suelta en la
 * visita, como evidencia de una actividad, o sin clasificar en la bandeja.
 *
 * Unión, no opcionales sueltos: con `cicloId?` y `actividadId?` existirían
 * combinaciones imposibles —dos destinos, ninguno— y el compilador no
 * ayudaría. Misma forma que `DestinoSubida` en el backend.
 */
export type DestinoFotos =
  | { tipo: 'ciclo'; cicloId: number }
  | { tipo: 'actividad'; actividadId: number }
  | { tipo: 'bandeja' };

// ── Auditoría (§23), plantillas (§20) e importación (§19) ──

export interface EventoFotos {
  id: number;
  carpetaId: number | null;
  carpeta: { id: number; nombre: string } | null;
  entidad: string;
  entidadId: number;
  accion: string;
  usuarioId: number | null;
  /** Se guarda además de la FK: dar de baja una cuenta no vacía la bitácora. */
  usuarioNombre: string | null;
  campoAfectado: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  descripcion: string | null;
  /** §23 la pide «si corresponde»: solo en las acciones sensibles. */
  ip: string | null;
  creadoEn: string;
}

export type TipoNodoPlantilla = 'CARPETA' | 'ACTIVIDAD' | 'ALBUM';

export interface NodoPlantilla {
  id: number;
  parentId: number | null;
  tipo: TipoNodoPlantilla;
  nombre: string;
  descripcion: string | null;
  orden: number;
  hijos: NodoPlantilla[];
}

export interface PlantillaResumen {
  id: number;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  creadoEn: string;
  creadoPor: Persona | null;
  _count: { nodos: number };
}

export interface Plantilla extends Omit<PlantillaResumen, '_count'> {
  nodos: NodoPlantilla[];
}

/** Un nodo tal como se manda al guardar: sin ids, con hijos anidados. */
export interface NodoPlantillaNuevo {
  tipo: TipoNodoPlantilla;
  nombre: string;
  descripcion?: string | null;
  hijos?: NodoPlantillaNuevo[];
}

/** Qué hacer con una hoja del Excel que ya existe (§19). */
export type DecisionImportacion = 'CREAR' | 'OMITIR' | 'ACTUALIZAR';

export interface PreviaImportacion {
  destino: { id: number; nombre: string };
  resumen: {
    filas: number;
    carpetasNuevas: number;
    carpetasExistentes: number;
    hojasNuevas: number;
    conflictos: number;
    problemas: number;
  };
  carpetas: { camino: string; nivel: number; estado: 'nueva' | 'existente' }[];
  hojas: {
    fila: number;
    camino: string;
    tipo: 'ACTIVIDAD' | 'ALBUM';
    nombre: string;
    descripcion: string | null;
  }[];
  conflictos: {
    fila: number;
    camino: string;
    tipo: 'ACTIVIDAD' | 'ALBUM';
    nombre: string;
    motivo: string;
  }[];
  problemas: { fila: number; motivo: string }[];
}

/**
 * Una foto tal como la devuelve `GET /fotos/actividad/:id/foto` (§15).
 *
 * Extiende la de galería con `descripcion`, que ese endpoint sí manda: la
 * galería la muestra por álbum —es de la subida entera— y aquí es de la foto.
 * Tipo propio y no reutilizar `FotoDeGaleria` a secas por lo aprendido con
 * `AlbumDeGaleria`: dos proyecciones distintas con el mismo nombre acaban
 * fusionándose en silencio.
 */
/**
 * Igual que `FotoDeGaleria` desde la Fase 2b, cuando la galería empezó a
 * devolver también la descripción por foto.
 *
 * Se conserva el nombre en vez de fundirlos: son dos endpoints distintos y
 * el día que uno añada un campo, tenerlos separados evita que el otro
 * prometa algo que no manda. Es el mismo cuidado que obligó a partir
 * `Album` y `AlbumDeGaleria` en 9a.
 */
/**
 * Una foto de actividad.
 *
 * ⚠️ Ya NO es un alias de `FotoDeGaleria`: desde la Fase 3 lleva `momento`, que
 * una foto de álbum no tiene ni puede tener —lo impide un CHECK—. Es
 * exactamente el caso que la nota de 9b anticipaba al no reutilizar el tipo.
 */
export type FotoDeActividad = FotoDeGaleria & {
  momento: MomentoEvidencia | null;
};
