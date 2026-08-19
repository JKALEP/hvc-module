import { api } from '@/shared/services/api';
import type {
  GuardarProveedorPayload,
  Proveedor,
  ResultadoEliminar,
} from '@/modules/costos/types';

// Los proveedores a los que se les pide cotización (§31).
//
// Archivo aparte de `costosService` por el mismo criterio que allí se
// declara: se parte por RECURSO. El proveedor no es una sección del
// requerimiento —vive fuera de él, se busca antes de que exista ninguno
// y §59 le da entrada propia en la navegación del Gestor—.

const RAIZ = '/costos/proveedor';

/**
 * El buscador de §30: nombre, nombre comercial, RUC o correo.
 *
 * `soloActivos` por defecto, porque esta lista existe para elegir a
 * quién pedirle precio y el backend rechaza a un proveedor desactivado.
 * Ofrecerlo sería enseñar una puerta que da 400.
 */
export async function listarProveedores(
  q: string,
  soloActivos = true,
): Promise<Proveedor[]> {
  const { data } = await api.get<Proveedor[]>(RAIZ, {
    params: { ...(q ? { q } : {}), ...(soloActivos ? { soloActivos: 'true' } : {}) },
  });
  return data;
}

/**
 * Alta y edición son del GESTOR, no del SuperAdmin (§30): el proveedor
 * no es solo un maestro que se configura una vez, es alguien a quien se
 * le pide precio y que puede aparecer en mitad del trabajo. Borrar sí es
 * administración, y por eso el backend lo deja en `@SoloSuperAdmin()`.
 */
export async function crearProveedor(
  payload: GuardarProveedorPayload,
): Promise<Proveedor> {
  const { data } = await api.post<Proveedor>(RAIZ, payload);
  return data;
}

export async function editarProveedor(
  id: number,
  payload: GuardarProveedorPayload,
): Promise<Proveedor> {
  const { data } = await api.patch<Proveedor>(`${RAIZ}/${id}`, payload);
  return data;
}

export async function eliminarProveedor(
  id: number,
): Promise<ResultadoEliminar> {
  const { data } = await api.delete<ResultadoEliminar>(`${RAIZ}/${id}`);
  return data;
}
