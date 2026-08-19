// DTOs planos, sin `class-validator`. Valida el service, en español.
//
// Todo opcional aunque el negocio lo exija: lo que llega del cliente
// puede venir de cualquier forma, y declarar obligatorio un campo de un
// `body` que nadie ha comprobado es una falsa sensación de seguridad.

/** La cabecera del requerimiento: los cinco campos de §13. */
export interface GuardarRequerimientoDto {
  tipoMantenimientoId?: number | string | null;
  tipoRequerimientoId?: number | string | null;
  supervisorId?: number | string | null;
  clienteId?: number | string | null;
  lugarEntrega?: string | null;
  /** "YYYY-MM-DD". */
  fechaEntrega?: string | null;
  /**
   * "YYYY-MM-DD". §18: nace igual a la fecha de creación, pero se puede
   * mover. Si no llega, se usa hoy.
   */
  fechaEmision?: string | null;
}

/** Un ítem de la tabla de §19, tal como lo manda el modal de §21. */
export interface GuardarItemDto {
  descripcion?: string | null;
  unidad?: string | null;
  cantidad?: number | string | null;
  detalleObservacion?: string | null;
  referencias?: string | null;
}

/** Lo que acompaña a un cierre: §43 y §45 exigen motivo. */
export interface MotivoDto {
  motivo?: string | null;
}
