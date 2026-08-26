import type { PermisoCarpeta } from '@/modules/fotos/types';

/**
 * Los permisos de carpeta en lenguaje de usuario. ÚNICO sitio.
 *
 * Las etiquetas y el orden viven aquí y no repartidos por el diálogo de
 * Compartir, la lista de colaboradores y las tarjetas: son la misma escala
 * de §5 en tres pantallas, y en v2 «Solo ver / Ver y organizar» estaba
 * escrito a mano en el componente que lo pintaba.
 *
 * Lo que NO está aquí es la cascada de §25: qué permiso tiene alguien lo
 * decide el backend y llega resuelto en `permiso`. El frontend lo traduce,
 * no lo calcula.
 */

/** El orden de la escala, de menor a mayor. El índice ES la jerarquía. */
const ESCALA: readonly PermisoCarpeta[] = [
  'SIN_ACCESO',
  'LECTURA',
  'EDICION',
  'TOTAL',
] as const;

/** ¿`permiso` llega a `minimo`? Mismo criterio que `AccesoService.alcanza`. */
export function alcanza(
  permiso: PermisoCarpeta | null | undefined,
  minimo: PermisoCarpeta,
): boolean {
  if (!permiso) return false;
  return ESCALA.indexOf(permiso) >= ESCALA.indexOf(minimo);
}

export const ETIQUETA_PERMISO: Record<PermisoCarpeta, string> = {
  SIN_ACCESO: 'Sin acceso',
  LECTURA: 'Solo ver',
  EDICION: 'Ver y editar',
  TOTAL: 'Acceso total',
};

/** Qué significa cada grado, para el selector de §10. */
export const DESCRIPCION_PERMISO: Record<PermisoCarpeta, string> = {
  SIN_ACCESO: 'No puede entrar.',
  LECTURA: 'Ve carpetas, actividades y fotos, y las descarga. No modifica nada.',
  EDICION: 'Además sube fotos, crea carpetas y actividades, y comenta.',
  TOTAL: 'Además comparte la carpeta y administra a sus colaboradores.',
};

/**
 * Los grados que se pueden CONCEDER al compartir (§10).
 *
 * `SIN_ACCESO` queda fuera: no es un grado que se conceda sino la
 * restricción explícita de §7, que se pone sobre una subcarpeta de algo ya
 * compartido. Es la misma lista que valida el backend.
 */
export const GRADOS_OTORGABLES: readonly Exclude<
  PermisoCarpeta,
  'SIN_ACCESO'
>[] = ['LECTURA', 'EDICION', 'TOTAL'] as const;

/** Variante del badge según el grado. Sube de tono con el alcance. */
export function varianteDePermiso(
  permiso: PermisoCarpeta,
): 'secondary' | 'outline' | 'warning' {
  if (permiso === 'TOTAL') return 'warning';
  if (permiso === 'EDICION') return 'outline';
  return 'secondary';
}
