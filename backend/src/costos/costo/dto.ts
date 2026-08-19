// DTO plano, sin `class-validator`. Valida el service, en español.

/**
 * El costo de un ítem (§50).
 *
 * Solo dos campos: a qué ítem del requerimiento corresponde y cuánto
 * costó la unidad. Las otras cinco columnas de §49 NO viajan desde el
 * cliente — se copian del requerimiento en el servidor, que es lo que
 * las hace un snapshot fiable y no lo que la pantalla creyó recordar.
 */
export interface CostoItemDto {
  requerimientoItemId?: number | string | null;
  /** S/ POR UNIDAD DE MEDIDA, nunca el total de la línea. */
  costoUnitario?: number | string | null;
}

export interface RegistrarCostoDto {
  items?: unknown;
}
