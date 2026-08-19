/**
 * Colores de relleno de Excel, resueltos a hex.
 *
 * Hace falta porque `exceljs` NO resuelve los colores de tema: la fila de
 * grupo de la hoja OPERATIVO llega como `{argb:"FFFFC000"}`, pero la de
 * SUPERVISORES llega como `{theme:9, tint:-0.25}` y hay que ir a buscar
 * la paleta del libro para saber que eso es un verde `3B7D23`.
 *
 * Sin esto el importador no puede enseñar el color detectado ni
 * devolverlo al exportar, y las listas de supervisores saldrían de otro
 * color del que se viene presentando a SCTR.
 *
 * Contrastado contra lo que reporta `xlsx` para el mismo archivo.
 */

/**
 * Orden de los colores del tema tal y como los indexa el atributo
 * `theme` de una celda. No es el orden en que aparecen en el XML:
 * claro y oscuro van cruzados en los dos primeros pares.
 */
const ORDEN_TEMA = [
  'lt1',
  'dk1',
  'lt2',
  'dk2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink',
] as const;

export type PaletaTema = (string | null)[];

/** Extrae la paleta del `theme1.xml` del libro. */
export function leerPaletaTema(xml: string | undefined): PaletaTema {
  if (!xml) return [];
  const bloque = xml.match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/);
  if (!bloque) return [];
  const scheme = bloque[0];

  return ORDEN_TEMA.map((nombre) => {
    const m = scheme.match(
      new RegExp(`<a:${nombre}>([\\s\\S]*?)</a:${nombre}>`),
    );
    if (!m) return null;
    const srgb = m[1].match(/srgbClr val="([0-9A-Fa-f]{6})"/);
    if (srgb) return srgb[1].toUpperCase();
    // dk1/lt1 suelen ser colores de sistema con su equivalente al lado.
    const sistema = m[1].match(/lastClr="([0-9A-Fa-f]{6})"/);
    return sistema ? sistema[1].toUpperCase() : null;
  });
}

/**
 * Aclara u oscurece un hex, con la fórmula de OOXML: un tinte negativo
 * multiplica hacia el negro y uno positivo interpola hacia el blanco.
 */
function aplicarTinte(hex: string, tint: number | undefined): string {
  if (!tint) return hex;
  const canal = (par: string) => {
    const v = parseInt(par, 16);
    const n = tint < 0 ? v * (1 + tint) : v + (255 - v) * tint;
    return Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  };
  return (
    canal(hex.slice(0, 2)) + canal(hex.slice(2, 4)) + canal(hex.slice(4, 6))
  );
}

/** Lo que `exceljs` entrega como color de un relleno. */
interface ColorExcel {
  argb?: string;
  theme?: number;
  tint?: number;
  indexed?: number;
}

interface RellenoExcel {
  type?: string;
  pattern?: string;
  fgColor?: ColorExcel;
}

/**
 * Hex del relleno de una celda, o null si no tiene relleno sólido.
 *
 * Devuelve null también para el blanco por tema (`theme:0`), que es lo
 * que llevan las filas de trabajador: si contara como relleno, cada
 * persona parecería una cabecera de grupo.
 */
export function colorDeRelleno(
  relleno: unknown,
  paleta: PaletaTema,
): string | null {
  const f = relleno as RellenoExcel | undefined;
  if (!f || f.type !== 'pattern' || f.pattern !== 'solid') return null;
  const c = f.fgColor;
  if (!c) return null;

  if (c.argb) {
    // Excel guarda ARGB; el alfa de un relleno de celda siempre es opaco.
    const hex = c.argb.length === 8 ? c.argb.slice(2) : c.argb;
    return /^[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : null;
  }

  if (typeof c.theme === 'number') {
    const base = paleta[c.theme];
    if (!base) return null;
    return aplicarTinte(base, c.tint);
  }

  // `indexed` es la paleta heredada de Excel 97; no aparece en los
  // archivos de HVC y resolverla a ciegas daría un color equivocado.
  return null;
}

/** Blanco y casi-blanco: el fondo normal de una fila de datos. */
export function esFondoNeutro(hex: string | null): boolean {
  if (!hex) return true;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return r >= 250 && g >= 250 && b >= 250;
}
