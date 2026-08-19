// DTOs planos, sin `class-validator`. Valida el service, en español.

/** Lo que escribe el Gestor al observar (§27). */
export interface CrearObservacionDto {
  texto?: string | null;
}

/** Lo que deja el Solicitante al dar constancia (§29). La respuesta es opcional. */
export interface ConfirmarObservacionDto {
  respuesta?: string | null;
}
