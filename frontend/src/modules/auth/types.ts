// Tipos de autenticación, permisos y cuentas.

// ── Autenticación y permisos ──

/** CLIENTE es una cuenta externa: sin módulos, solo lo compartido. */
export type RolGlobal = 'SUPERADMIN' | 'ADMIN' | 'CLIENTE';
export type Modulo = 'COSTOS' | 'PERSONAL_PROYECTOS' | 'FOTOS' | 'EQUIPOS';
/**
 * Nivel GLOBAL dentro de Fotos: qué alcanza alguien sin que nadie le haya
 * compartido nada (§3). `null` es un valor legítimo y el más común — el
 * supervisor de §4, que entra al módulo y solo ve lo compartido—, no un
 * "todavía sin asignar".
 */
export type NivelFotos = 'LECTURA_GLOBAL' | 'EDITOR_GLOBAL' | 'ADMIN_GLOBAL';
/** Rol DENTRO del módulo Costos. El administrador del módulo es el SUPERADMIN. */
export type RolCostos = 'SOLICITANTE' | 'GESTOR_COTIZACIONES' | 'APROBADOR';
export type EstadoUsuario = 'ACTIVO' | 'INACTIVO';

export interface Permiso {
  id?: number;
  modulo: Modulo;
  /** Solo tiene valor cuando modulo === 'FOTOS'. */
  nivelFotos: NivelFotos | null;
  /** Solo tiene valor cuando modulo === 'COSTOS'. */
  rolCostos: RolCostos | null;
}

/** Sesión vigente: lo que devuelve /auth/login y /auth/yo. */
export interface UsuarioSesion {
  id: number;
  email: string;
  nombre: string;
  rol: RolGlobal;
  permisos: Permiso[];
}

export interface RespuestaLogin {
  token: string;
  usuario: UsuarioSesion;
}

/** Fila de la gestión de cuentas (solo SuperAdmin). */
export interface UsuarioAdmin {
  id: number;
  email: string;
  nombre: string;
  rol: RolGlobal;
  estado: EstadoUsuario;
  ultimoAcceso: string | null;
  creadoEn: string;
  permisos: Permiso[];
}

export interface GuardarUsuarioPayload {
  email?: string;
  nombre?: string;
  password?: string;
  estado?: EstadoUsuario;
  permisos?: {
    modulo: Modulo;
    nivelFotos?: NivelFotos | null;
    rolCostos?: RolCostos | null;
  }[];
}
