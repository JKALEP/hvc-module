import type { Modulo, UsuarioSesion } from '@/types/models';

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
  { id: 'COSTOS', etiqueta: 'Costos', inicio: '/importar' },
  { id: 'PERSONAL_PROYECTOS', etiqueta: 'Personal y proyectos', inicio: '/proyectos' },
  { id: 'FOTOS', etiqueta: 'Fotos', inicio: '/fotos' },
];

export const ETIQUETA_MODULO: Record<Modulo, string> = {
  COSTOS: 'Costos',
  PERSONAL_PROYECTOS: 'Personal y proyectos',
  FOTOS: 'Fotos',
};

export const ETIQUETA_NIVEL_FOTOS = {
  ADMIN_FOTOS: 'Administrador de Fotos',
  COLABORADOR: 'Colaborador',
} as const;

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
 * Es el único módulo con niveles: un COLABORADOR entra a /fotos pero no a
 * /fotos/admin. Se comprueba igual que en el backend para que la UI no
 * ofrezca puertas que después responden 403.
 */
export function esAdminFotos(usuario: UsuarioSesion | null): boolean {
  if (!usuario) return false;
  if (usuario.rol === 'SUPERADMIN') return true;
  return usuario.permisos.some(
    (p) => p.modulo === 'FOTOS' && p.nivelFotos === 'ADMIN_FOTOS',
  );
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
  return primero?.inicio ?? '/sin-acceso';
}
