/**
 * Cómo se LEE un valor de campo dinámico.
 *
 * `ValorCampoService` sabe escribirlo —a qué columna va cada tipo—; esto
 * sabe leerlo. Vive en un módulo suelto y no en un service porque es una
 * función pura sin dependencias, y porque lo necesitan tres consumidores
 * que no deberían depender unos de otros: la tabla del inventario, la
 * ficha del equipo y los reportes.
 *
 * Una sola columna está llena por fila; el orden de este `??` ES la
 * regla de lectura, y tenerla en un solo sitio evita que la tabla
 * muestre una cosa y el Excel otra.
 */

/** La forma mínima que hace falta para leer un valor. */
export interface ValorLegible {
  valorTexto: string | null;
  valorNumero: { toString(): string } | null;
  valorEntero: number | null;
  valorFecha: Date | null;
  valorBooleano: boolean | null;
  claveArchivo: string | null;
  opcion: { etiqueta: string } | null;
  opcionesElegidas: { opcion: { etiqueta: string } }[];
}

export function textoDeValor(v: ValorLegible): string {
  return (
    v.opcion?.etiqueta ??
    (v.opcionesElegidas.length > 0
      ? v.opcionesElegidas.map((o) => o.opcion.etiqueta).join(', ')
      : (v.valorTexto ??
        (v.valorEntero !== null ? String(v.valorEntero) : null) ??
        (v.valorNumero !== null ? v.valorNumero.toString() : null) ??
        (v.valorFecha ? v.valorFecha.toISOString().slice(0, 10) : null) ??
        (v.valorBooleano !== null ? (v.valorBooleano ? 'Sí' : 'No') : null) ??
        v.claveArchivo ??
        ''))
  );
}

/** Los valores de un equipo como `{ clave: texto }`. */
export function aplanarValores<
  T extends ValorLegible & { definicionCampo: { clave: string } },
>(valores: T[]): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const v of valores) salida[v.definicionCampo.clave] = textoDeValor(v);
  return salida;
}
