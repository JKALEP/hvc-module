// DTOs planos (sin class-validator para no depender de paquetes no instalados).
// La validación de campos requeridos se hace manualmente en el service/controller.

export interface EditarProductoDto {
  codigo?: string | null;
  descripcion?: string | null;
  unidadMedida?: string | null;
  cantidad?: number | string | null;
  detalles?: string | null;
  referencias?: string | null;
  precioUnitario?: number | string | null;
  proveedor?: string | null;
  ruc?: string | null;
}

// Campos que el usuario puede editar en una fila.
export const CAMPOS_EDITABLES: (keyof EditarProductoDto)[] = [
  'codigo',
  'descripcion',
  'unidadMedida',
  'cantidad',
  'detalles',
  'referencias',
  'precioUnitario',
  'proveedor',
  'ruc',
];
