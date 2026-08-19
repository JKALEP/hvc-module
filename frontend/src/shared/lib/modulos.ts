import type {
  Modulo,
  NivelFotos,
  RolCostos,
  UsuarioSesion,
} from '@/modules/auth/types';

/**
 * Todo lo que la app sabe sobre módulos, en un solo sitio: etiquetas,
 * ruta de entrada y orden. El sidebar, el redirect de "/" y la pantalla
 * de usuarios leen de aquí, así que agregar un módulo es tocar este
 * archivo y no buscar cadenas por todo el proyecto.
 */
export const MODULOS: {
  id: Modulo;
  etiqueta: string;
  /** A dónde entra un usuario que solo tiene este módulo. */
  inicio: string;
}[] = [
  // El destino real dentro de Costos depende del sub-rol: ver
  // INICIO_ROL_COSTOS. Este `inicio` es el suelo —lo único que puede
  // mirar cualquiera— para quien no tiene rol (el SuperAdmin) o todavía
  // no tiene bandeja propia.
  { id: 'COSTOS', etiqueta: 'Costos', inicio: '/costos/base' },
  { id: 'PERSONAL_PROYECTOS', etiqueta: 'Personal y proyectos', inicio: '/proyectos' },
  { id: 'FOTOS', etiqueta: 'Fotos', inicio: '/fotos' },
  // EQUIPOS existe en el enum del backend pero NO se lista aquí a
  // propósito: sus rutas van con @SoloSuperAdmin(), así que conceder el
  // permiso todavía no haría nada. Ofrecerlo en la pantalla de usuarios
  // sería prometer un acceso que el guard ignora. Se añade el día que
  // las rutas pasen a @RequiereModulo(Modulo.EQUIPOS).
];

export const ETIQUETA_MODULO: Record<Modulo, string> = {
  COSTOS: 'Costos',
  PERSONAL_PROYECTOS: 'Personal y proyectos',
  FOTOS: 'Fotos',
  EQUIPOS: 'Gestión de equipos',
};

/**
 * Los tres niveles GLOBALES de Fotos (§3). Mismas etiquetas que usa el
 * backend en sus mensajes, para que la pantalla y el 403 hablen igual.
 *
 * No hay entrada para «sin nivel»: eso es `nivelFotos === null` y su
 * etiqueta está en `SIN_NIVEL_FOTOS`, aparte, porque no es un valor del
 * enum sino su ausencia.
 */
export const ETIQUETA_NIVEL_FOTOS = {
  LECTURA_GLOBAL: 'Lectura global',
  EDITOR_GLOBAL: 'Editor global',
  ADMIN_GLOBAL: 'Administrador global de Fotos',
} as const;

/** Qué se lee en pantalla cuando `nivelFotos` es null: el caso de §4. */
export const SIN_NIVEL_FOTOS = 'Solo lo compartido';

/**
 * Los roles DENTRO de Costos. Mismas etiquetas que usa el backend en sus
 * mensajes de error, para que la pantalla y el 403 hablen igual.
 *
 * No hay entrada para el administrador del módulo: los catálogos,
 * proveedores y plantillas los gestiona el SUPERADMIN, que ya entra a
 * todo por su rol global.
 */
export const ETIQUETA_ROL_COSTOS: Record<RolCostos, string> = {
  SOLICITANTE: 'Solicitante de requerimientos',
  GESTOR_COTIZACIONES: 'Gestor de cotizaciones',
  APROBADOR: 'Aprobador de cotizaciones',
};

/**
 * Qué papel juega el usuario dentro de Costos, o null si no tiene el
 * módulo.
 *
 * El SUPERADMIN devuelve null aunque entre a todo: no TIENE un rol, pasa
 * por encima de ellos. Quien pregunte "¿puede aprobar?" tiene que
 * comprobar el SuperAdmin aparte, igual que en el backend.
 */
export function rolCostosDe(usuario: UsuarioSesion | null): RolCostos | null {
  return (
    usuario?.permisos.find((p) => p.modulo === 'COSTOS')?.rolCostos ?? null
  );
}

/**
 * La casa de cada rol dentro de Costos.
 *
 * Costos es el único módulo donde la entrada depende del sub-rol: los
 * tres papeles de §59 no comparten pantalla de trabajo, y mandarlos a
 * todos al mismo sitio obliga a dos clics al que sabe perfectamente a
 * qué viene.
 *
 * `null` significa «este rol todavía no tiene bandeja propia» y cae al
 * `inicio` del módulo. Es un Record COMPLETO y no un Partial a
 * propósito: añadir un rol al enum no compila hasta decidir dónde
 * aterriza.
 */
const INICIO_ROL_COSTOS: Record<RolCostos, string | null> = {
  SOLICITANTE: '/costos/mis-requerimientos',
  GESTOR_COTIZACIONES: '/costos/bandeja',
  APROBADOR: '/costos/aprobaciones',
};

/** ¿El usuario puede entrar a este módulo? El SuperAdmin entra a todo. */
export function tieneModulo(
  usuario: UsuarioSesion | null,
  modulo: Modulo,
): boolean {
  if (!usuario) return false;
  if (usuario.rol === 'SUPERADMIN') return true;
  return usuario.permisos.some((p) => p.modulo === modulo);
}

/**
 * ¿Administra el módulo Fotos?
 *
 * Es el único módulo con niveles globales (§3). Se comprueba igual que en
 * el backend para que la UI no ofrezca puertas que después responden 403.
 */
export function esAdminFotos(usuario: UsuarioSesion | null): boolean {
  if (!usuario) return false;
  if (usuario.rol === 'SUPERADMIN') return true;
  return usuario.permisos.some(
    (p) => p.modulo === 'FOTOS' && p.nivelFotos === 'ADMIN_GLOBAL',
  );
}

/**
 * Su nivel global dentro de Fotos, o null si no tiene ninguno (§4).
 *
 * Hermano de `rolCostosDe`, y con la misma advertencia: el SUPERADMIN
 * devuelve null aunque alcance todo — no TIENE nivel, pasa por encima de
 * ellos. Quien pregunte «¿puede X?» tiene que comprobarlo aparte, igual que
 * en el backend.
 */
export function nivelFotosDe(
  usuario: UsuarioSesion | null,
): NivelFotos | null {
  return usuario?.permisos.find((p) => p.modulo === 'FOTOS')?.nivelFotos ?? null;
}

/**
 * A dónde entra este usuario dentro de un módulo.
 *
 * Para todos menos Costos es el `inicio` del módulo y ya está: ni Fotos
 * ni Personal cambian de pantalla según el papel que juegues —el nivel
 * de Fotos cambia lo que puedes HACER en `/fotos`, no por dónde
 * entras—. Costos sí, y por eso la excepción está aquí y no repartida
 * en cada sitio que quiera saberlo.
 */
export function inicioDeModulo(
  modulo: Modulo,
  usuario: UsuarioSesion | null,
): string {
  const base = MODULOS.find((m) => m.id === modulo)?.inicio ?? '/sin-acceso';
  if (modulo !== 'COSTOS') return base;
  const rol = rolCostosDe(usuario);
  // Sin rol (el SuperAdmin) o con un rol que aún no tiene bandeja, al
  // suelo del módulo.
  return (rol && INICIO_ROL_COSTOS[rol]) ?? base;
}

/**
 * Primera ruta a la que mandar al usuario tras entrar.
 *
 * Se recorre MODULOS en su orden fijo, no el orden en que le asignaron
 * los permisos: así el destino es estable entre sesiones.
 */
export function rutaInicial(usuario: UsuarioSesion | null): string {
  if (!usuario) return '/login';
  // Un cliente externo no tiene módulos: su casa es el portal.
  if (usuario.rol === 'CLIENTE') return '/portal';
  // El SuperAdmin aterriza en la gestión de cuentas: es lo suyo.
  if (usuario.rol === 'SUPERADMIN') return '/usuarios';
  const primero = MODULOS.find((m) =>
    usuario.permisos.some((p) => p.modulo === m.id),
  );
  return primero ? inicioDeModulo(primero.id, usuario) : '/sin-acceso';
}
