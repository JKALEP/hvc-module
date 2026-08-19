/**
 * Correlativo legible POR AÑO: `COT-2026-001`, `OC-2026-001`.
 *
 * Es la política de numeración del módulo de Equipos, y solo de él. Era
 * un método de `DocumentoService`, pero no toca la base ni guarda
 * estado: es una función de dos entradas a una salida, y como clase solo
 * obligaba a inyectar algo para llamarla.
 *
 * ⚠️ NO usar esto para el número de pedido de Costos. Aquí el contador
 * se reinicia cada año y se calcula leyendo el último código, así que
 * dos altas simultáneas piden el mismo número y la segunda choca contra
 * el `@unique` de la columna. Para Equipos es aceptable —los documentos
 * los crea una persona a la vez—; para el requerimiento de Costos no,
 * porque la especificación exige numeración perpetua y segura ante
 * concurrencia. Eso lo resuelve `NumeracionService` con una SEQUENCE.
 */
export function siguienteCodigo(
  prefijo: string,
  ultimo: string | null,
): string {
  const anio = new Date().getFullYear();
  const base = `${prefijo}-${anio}-`;
  const n =
    ultimo && ultimo.startsWith(base)
      ? Number(ultimo.slice(base.length)) + 1
      : 1;
  return `${base}${String(n).padStart(3, '0')}`;
}
