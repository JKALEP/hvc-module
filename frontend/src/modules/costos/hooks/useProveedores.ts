import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  crearProveedor,
  editarProveedor,
  eliminarProveedor,
  listarProveedores,
} from '@/modules/costos/services/proveedorService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type { GuardarProveedorPayload } from '@/modules/costos/types';

/**
 * El buscador de proveedores de §30.
 *
 * `placeholderData` conserva la lista anterior mientras llega la nueva:
 * sin eso, cada letra tecleada vacía la lista y el selector parpadea
 * entre «no hay resultados» y los que sí hay. El que llama se encarga
 * de retrasar la búsqueda (`useDebounce`), que es una decisión de la
 * pantalla y no de la caché.
 */
export function useProveedores(q: string, soloActivos = true) {
  return useQuery({
    queryKey: QUERY_KEYS.proveedores(`${q}|${String(soloActivos)}`),
    queryFn: () => listarProveedores(q, soloActivos),
    placeholderData: (anterior) => anterior,
    staleTime: 60 * 1000,
  });
}

/** Invalida todas las búsquedas: un alta o un cambio puede entrar en cualquiera. */
function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['proveedores'] });
  };
}

/** El texto del error viene del backend, que es donde está la regla. */
const alFallar = (porDefecto: string) => (error: unknown) =>
  toast.error(getErrorMessage(error, porDefecto), { duration: 8000 });

export function useCrearProveedor() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (payload: GuardarProveedorPayload) => crearProveedor(payload),
    onSuccess: (proveedor) => {
      invalidar();
      toast.success(`Se dio de alta a "${proveedor.razonSocial}"`);
    },
    onError: alFallar('No se pudo crear el proveedor'),
  });
}

export function useEditarProveedor() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: GuardarProveedorPayload;
    }) => editarProveedor(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Cambios guardados');
    },
    onError: alFallar('No se pudieron guardar los cambios'),
  });
}

export function useEliminarProveedor() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => eliminarProveedor(id),
    onSuccess: () => {
      invalidar();
      toast.success('Proveedor eliminado');
    },
    onError: alFallar('No se pudo eliminar'),
  });
}
