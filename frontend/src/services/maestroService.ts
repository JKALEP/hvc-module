import { api } from './api';
import type { Producto } from '@/types/models';

// Llamadas al módulo /maestro del backend.

/** Busca productos por coincidencia parcial en descripción, proveedor o ruc. */
export async function buscarMaestro(q: string): Promise<Producto[]> {
  const { data } = await api.get<Producto[]>('/maestro', {
    params: q ? { q } : {},
  });
  return data;
}
