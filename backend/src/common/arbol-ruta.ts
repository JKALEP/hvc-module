/**
 * Ruta materializada de un árbol.
 *
 * Un nodo guarda en `ruta` los ids de todos sus ancestros y el suyo,
 * separados por barra: `"1/4/9"`. Con eso, listar un subárbol entero es
 * un `LIKE '1/4/%'` en vez de una consulta recursiva o N viajes a la
 * base, y saber si A desciende de B es comparar dos textos.
 *
 * Son funciones PURAS: no tocan Prisma. `Sede` (Fotos) y `Carpeta`
 * (Obra) tienen la misma forma de árbol pero viven en tablas distintas
 * y con reglas distintas —una se archiva y se comparte, la otra no—,
 * así que comparten estas cuatro operaciones de texto y nada más. Un
 * "TreeService" genérico sobre dos modelos de Prisma habría sido peor
 * que dos services claros usando el mismo puñado de helpers.
 */

/** Separador de la ruta. Un solo sitio lo conoce. */
const SEP = '/';

/**
 * Ruta de un nodo a partir de la de su madre.
 * Sin madre, la ruta es su propio id: está en la raíz.
 */
export function rutaDe(id: number, rutaPadre: string | null): string {
  return rutaPadre ? `${rutaPadre}${SEP}${id}` : String(id);
}

/** Los ids del camino, de la raíz al propio nodo. */
export function idsDeRuta(ruta: string): number[] {
  return ruta
    .split(SEP)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * ¿`ruta` cuelga de `rutaAncestro`?
 *
 * El separador final NO es opcional: sin él, "12" daría positivo dentro
 * de "123" y una carpeta se creería descendiente de otra que no lo es.
 * Un nodo no es descendiente de sí mismo.
 */
export function esDescendiente(ruta: string, rutaAncestro: string): boolean {
  return ruta.startsWith(`${rutaAncestro}${SEP}`);
}

/** ¿Es el mismo nodo o cuelga de él? Lo que hace falta para detectar ciclos. */
export function estaEnRama(ruta: string, rutaAncestro: string): boolean {
  return ruta === rutaAncestro || esDescendiente(ruta, rutaAncestro);
}

/**
 * Reescribe la ruta de un descendiente cuando su ancestro se mueve.
 *
 * Se cambia solo el prefijo y se conserva el resto del camino: los
 * nietos siguen colgando de sus padres, que es lo que un movimiento no
 * debe alterar.
 */
export function reprefijar(
  rutaDescendiente: string,
  rutaVieja: string,
  rutaNueva: string,
): string {
  return rutaNueva + rutaDescendiente.slice(rutaVieja.length);
}
