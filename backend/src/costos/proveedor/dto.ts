// DTO plano, sin `class-validator`. Valida el service.

export interface GuardarProveedorDto {
  ruc?: string | null;
  razonSocial?: string | null;
  nombreComercial?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  estado?: string | null;
}
