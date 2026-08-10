import { api } from './api';
import type {
  Importacion,
  ImportacionConProductos,
  Producto,
  EditarProductoPayload,
} from '@/types/models';

// Todas las llamadas al módulo /importacion del backend.

/** Sube un archivo Excel y crea la importación con sus filas (estado INCOMPLETO). */
export async function subirExcel(file: File): Promise<ImportacionConProductos> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ImportacionConProductos>(
    '/importacion/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

/** Lista todas las importaciones (con estado y conteo). */
export async function listarImportaciones(): Promise<Importacion[]> {
  const { data } = await api.get<Importacion[]>('/importacion');
  return data;
}

/** Obtiene el detalle de una importación con todas sus filas. */
export async function obtenerImportacion(
  id: number,
): Promise<ImportacionConProductos> {
  const { data } = await api.get<ImportacionConProductos>(`/importacion/${id}`);
  return data;
}

/** Edita una fila de una importación. */
export async function editarProducto(
  importacionId: number,
  productoId: number,
  payload: EditarProductoPayload,
): Promise<Producto> {
  const { data } = await api.put<Producto>(
    `/importacion/${importacionId}/producto/${productoId}`,
    payload,
  );
  return data;
}

/** Duplica una fila (sin precio/proveedor/ruc). */
export async function duplicarProducto(
  importacionId: number,
  productoId: number,
): Promise<Producto> {
  const { data } = await api.post<Producto>(
    `/importacion/${importacionId}/producto/${productoId}/duplicar`,
  );
  return data;
}

/** Elimina una fila. */
export async function eliminarProducto(
  importacionId: number,
  productoId: number,
): Promise<{ ok: boolean; id: number }> {
  const { data } = await api.delete(
    `/importacion/${importacionId}/producto/${productoId}`,
  );
  return data;
}

/** Elimina una importación completa (para "Cancelar"). */
export async function eliminarImportacion(
  id: number,
): Promise<{ ok: boolean; id: number }> {
  const { data } = await api.delete(`/importacion/${id}`);
  return data;
}
