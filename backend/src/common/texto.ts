/**
 * Helpers de texto para validación manual en los services.
 *
 * Existen porque `limpiar` estaba copiado en NUEVE services y `describir`
 * en dos. No es una utilidad genérica de cajón: son exactamente las dos
 * operaciones que el proyecto repite al validar a mano, que es como se
 * valida aquí desde el principio (sin class-validator).
 */

/**
 * Texto útil o null. Recorta espacios y trata `""` como ausencia.
 *
 * null, undefined, números, objetos y arrays NO son texto válido: se
 * descartan en vez de convertirse en `"[object Object]"`.
 */
export function limpiar(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const s = valor.trim();
  return s === '' ? null : s;
}

/**
 * Representación segura de un valor para incluirlo en un mensaje de error.
 *
 * `String(objeto)` produce "[object Object]", que no le dice nada a quien
 * lee el error ni a quien lo depura.
 */
export function describir(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean')
    return String(valor);
  return JSON.stringify(valor) ?? 'null';
}
