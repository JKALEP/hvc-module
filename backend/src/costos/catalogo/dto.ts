// DTOs planos: interfaces, sin `class-validator`. La validación se hace a
// mano en el service, con mensajes en español.
//
// Todos los campos son opcionales aunque el negocio los exija: lo que
// llega del cliente puede venir de cualquier forma, y es el service quien
// decide si falta algo. Declararlos obligatorios en el tipo daría una
// falsa sensación de seguridad sobre un `body` que nadie ha comprobado.

export interface GuardarOpcionDto {
  tipo?: string | null;
  valor?: string | null;
  orden?: number | string | null;
  estado?: string | null;
}

/** Al editar no se puede cambiar el tipo: sería mover la opción de catálogo. */
export type EditarOpcionDto = Omit<GuardarOpcionDto, 'tipo'>;

export interface GuardarClienteDto {
  nombre?: string | null;
  ruc?: string | null;
  contacto?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  estado?: string | null;
}

export interface GuardarSupervisorDto {
  nombre?: string | null;
  documento?: string | null;
  cargo?: string | null;
  correo?: string | null;
  telefono?: string | null;
  estado?: string | null;
}
