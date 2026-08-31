// DTOs planos, sin `class-validator`. Valida el service, en español.

/** A quiénes se les pide cotización (§30). */
export interface CompartirDto {
  /**
   * A quién se le pide, y a qué dirección.
   *
   * Antes era una lista de ids a secas. Lleva el correo porque el de la
   * ficha puede faltar —y eso dejaba al proveedor sin poder recibir nada—
   * o estar viejo. Lo que se elige sigue siendo el PROVEEDOR: la dirección
   * acompaña, no lo sustituye.
   */
  destinos?: unknown;
}

/** Un destinatario del selector de §30. */
export interface DestinoDto {
  proveedorId?: unknown;
  /** Vacío = se usa el de la ficha. */
  correo?: unknown;
}

/** Una línea de la cotización que llegó del proveedor. */
export interface ItemCotizacionDto {
  /** El ítem del requerimiento al que responde. Null = línea extra (§36). */
  requerimientoItemId?: number | string | null;
  descripcion?: string | null;
  unidad?: string | null;
  cantidad?: number | string | null;
  precioUnitario?: number | string | null;
}

/**
 * Lo que el Gestor teclea de una cotización recibida (§34-37).
 *
 * Todo lo de §37 que sirve para comparar. Nada de adjuntos: §36 dice que
 * hoy no se interpretan los documentos, y §6 que la fuente son los datos
 * estructurados, no el archivo.
 */
export interface GuardarCotizacionDto {
  proveedorId?: number | string | null;
  solicitudId?: number | string | null;
  /** "YYYY-MM-DD" — la del documento del proveedor, no la de registro. */
  fechaCotizacion?: string | null;
  validaHasta?: string | null;
  garantia?: string | null;
  plazoEntrega?: string | null;
  condicionesPago?: string | null;
  observaciones?: string | null;
  items?: unknown;
}

/** Al editar no se cambia el proveedor: eso sería otra cotización. */
export type EditarCotizacionDto = Omit<GuardarCotizacionDto, 'proveedorId'>;

/** La recomendación del Gestor (§38-39). */
export interface RecomendarDto {
  cotizacionId?: number | string | null;
  justificacion?: string | null;
}
