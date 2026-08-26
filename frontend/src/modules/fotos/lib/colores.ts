import type { ColorCarpeta, ColorEstado } from '@/modules/fotos/types';

/**
 * De un color de la paleta a sus clases. ÚNICO sitio.
 *
 * ⚠️ Las clases van escritas ENTERAS y literales, y no se pueden componer.
 * Tailwind genera solo lo que ve en el código fuente, así que
 * `` `bg-${color}-soft` `` no existiría en el CSS compilado y el icono
 * saldría sin fondo. Es la restricción que obliga a que la paleta sea un
 * conjunto cerrado aunque *qué* color usa cada tipo sí sea configurable.
 *
 * `Record` completo a propósito: añadir un valor a `ColorCarpeta` no compila
 * hasta escribir aquí sus clases —que es la mitad que se olvida, porque el
 * enum de la base y los tokens de `index.css` se notan antes—.
 *
 * Variante `soft` porque es la normal del sistema: fondo tenue y texto
 * oscuro del mismo matiz. La sólida es excepcional y aquí sería una mancha.
 */
export const COLOR_A_CLASES: Record<ColorCarpeta, string> = {
  AMARILLO: 'bg-amarillo-soft text-amarillo-soft-foreground',
  CELESTE: 'bg-celeste-soft text-celeste-soft-foreground',
};

/** Cómo se lee cada color en la pantalla de administración. */
export const ETIQUETA_COLOR: Record<ColorCarpeta, string> = {
  AMARILLO: 'Amarillo',
  CELESTE: 'Celeste',
};

/**
 * El color de fábrica de cada tipo.
 *
 * Es solo el respaldo de mientras la configuración carga: el valor de verdad
 * llega del servidor, que lo lee de la base. Sin esto, el explorador
 * parpadearía sin color en cada primera carga.
 */
export const COLOR_POR_DEFECTO: Record<'CARPETA' | 'EQUIPO', ColorCarpeta> = {
  CARPETA: 'AMARILLO',
  EQUIPO: 'CELESTE',
};

// ── Estados de equipo (§7, Fase 1 del rediseño) ──

/**
 * De un color de estado a una VARIANTE del `Badge`, no a clases.
 *
 * ⚠️ Es a propósito distinto de `COLOR_A_CLASES`, y la diferencia es la que
 * el sistema de diseño ya hace en Personal: el dominio dice *qué* pasa y la
 * presentación decide *cómo* se ve. Aquí el color SÍ significa algo
 * —operativo, con observaciones, inoperativo— y el sistema ya tiene la
 * familia semántica que lo dice. Escribir tokens `--verde` / `--rojo` habría
 * dejado dos maneras de pintar «esto va mal», que es exactamente lo que la
 * paleta semántica existe para evitar.
 *
 * El de las CARPETAS no puede hacer esto porque allí el significado ES el
 * color: amarillo no quiere decir nada más que «carpeta».
 *
 * `Record` completo: añadir un valor a `ColorEstado` no compila hasta
 * decidir su variante.
 */
export const ESTADO_A_VARIANTE: Record<
  ColorEstado,
  'success' | 'warning' | 'destructive'
> = {
  VERDE: 'success',
  NARANJA: 'warning',
  ROJO: 'destructive',
};

/** Cómo se lee cada color en la pantalla de administración. */
export const ETIQUETA_COLOR_ESTADO: Record<ColorEstado, string> = {
  VERDE: 'Verde — operativo',
  NARANJA: 'Naranja — con observaciones',
  ROJO: 'Rojo — inoperativo',
};
