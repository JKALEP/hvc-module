import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  subirExcel,
  editarProducto,
  duplicarProducto,
  eliminarProducto,
  eliminarImportacion,
} from '@/services/importacionService';
import { getErrorMessage } from '@/services/api';
import { QUERY_KEYS } from '@/lib/constants';
import type { EditarProductoPayload } from '@/types/models';

// Hooks de mutación. Cada uno invalida las queries afectadas y muestra toasts.

/** Invalida las listas dependientes tras cambiar una fila. */
function useInvalidadores() {
  const qc = useQueryClient();
  return (importacionId?: number) => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.importaciones });
    qc.invalidateQueries({ queryKey: ['maestro'] });
    if (importacionId !== undefined) {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.importacion(importacionId) });
    }
  };
}

/** Sube un Excel. */
export function useSubirExcel() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: (file: File) => subirExcel(file),
    onSuccess: (data) => {
      invalidar();
      toast.success(
        `Excel importado: ${data.totalFilas} fila(s) de "${data.nombreArchivo}"`,
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo importar el Excel')),
  });
}

interface EditarVars {
  importacionId: number;
  productoId: number;
  payload: EditarProductoPayload;
}

/** Edita una fila. */
export function useEditarProducto() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: ({ importacionId, productoId, payload }: EditarVars) =>
      editarProducto(importacionId, productoId, payload),
    onSuccess: (_data, vars) => {
      invalidar(vars.importacionId);
      toast.success('Fila guardada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo guardar la fila')),
  });
}

interface FilaVars {
  importacionId: number;
  productoId: number;
}

/** Duplica una fila. */
export function useDuplicarProducto() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: ({ importacionId, productoId }: FilaVars) =>
      duplicarProducto(importacionId, productoId),
    onSuccess: (_data, vars) => {
      invalidar(vars.importacionId);
      toast.success('Fila duplicada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo duplicar la fila')),
  });
}

/** Elimina una fila. */
export function useEliminarProducto() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: ({ importacionId, productoId }: FilaVars) =>
      eliminarProducto(importacionId, productoId),
    onSuccess: (_data, vars) => {
      invalidar(vars.importacionId);
      toast.success('Fila eliminada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar la fila')),
  });
}

/** Elimina una importación completa. */
export function useEliminarImportacion() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: (id: number) => eliminarImportacion(id),
    onSuccess: () => {
      invalidar();
      toast.success('Importación descartada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo descartar la importación')),
  });
}
