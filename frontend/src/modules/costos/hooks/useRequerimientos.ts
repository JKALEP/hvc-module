import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  agregarItem,
  borrarBorrador,
  borrarItem,
  cancelarRequerimiento,
  crearRequerimiento,
  editarItem,
  editarRequerimiento,
  emitirRequerimiento,
  listarRequerimientos,
  obtenerHistorial,
  obtenerOpciones,
  obtenerRequerimiento,
} from '@/modules/costos/services/costosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type {
  GuardarItemPayload,
  GuardarRequerimientoPayload,
} from '@/modules/costos/types';

/**
 * Todo lo del requerimiento y sus ítems: lecturas Y escrituras.
 *
 * Un archivo por RECURSO, no un `…Mutations` aparte. Los ítems entran
 * aquí y no en un `useItems` propio porque no existen fuera de su
 * requerimiento: cambiar uno invalida la caché del mismo detalle.
 */

/** Invalida lo que un cambio deja obsoleto. */
function useInvalidadores() {
  const qc = useQueryClient();
  return (id?: number) => {
    void qc.invalidateQueries({ queryKey: ['requerimientos'] });
    if (id !== undefined) {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.requerimiento(id) });
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.historialRequerimiento(id),
      });
    }
  };
}

// ── Lecturas ──

/** Los cinco selectores de §13. Cambian poco: se cachean de largo. */
export function useOpcionesRequerimiento() {
  return useQuery({
    queryKey: QUERY_KEYS.opcionesRequerimiento,
    queryFn: obtenerOpciones,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRequerimientos(
  grupo: 'pendientes' | 'finalizados' | 'todos',
) {
  return useQuery({
    queryKey: QUERY_KEYS.requerimientos(grupo),
    queryFn: () => listarRequerimientos(grupo),
  });
}

export function useRequerimiento(id: number | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.requerimiento(id ?? 0),
    queryFn: () => obtenerRequerimiento(id as number),
    enabled: typeof id === 'number' && !Number.isNaN(id),
  });
}

/** La cadena de §64. */
export function useHistorial(id: number | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.historialRequerimiento(id ?? 0),
    queryFn: () => obtenerHistorial(id as number),
    enabled: typeof id === 'number' && !Number.isNaN(id),
  });
}

// ── Escrituras: la cabecera ──

export function useCrearRequerimiento() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: (payload: GuardarRequerimientoPayload) =>
      crearRequerimiento(payload),
    onSuccess: (req) => invalidar(req.id),
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo crear el requerimiento')),
  });
}

export function useEditarRequerimiento() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: GuardarRequerimientoPayload;
    }) => editarRequerimiento(id, payload),
    onSuccess: (req) => {
      invalidar(req.id);
      toast.success('Cambios guardados');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudieron guardar los cambios')),
  });
}

export function useEmitirRequerimiento() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: (id: number) => emitirRequerimiento(id),
    onSuccess: (req) => {
      invalidar(req.id);
      toast.success(`Requerimiento ${req.numero ?? ''} emitido`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo emitir')),
  });
}

export function useCancelarRequerimiento() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      cancelarRequerimiento(id, motivo),
    onSuccess: (req) => {
      invalidar(req.id);
      toast.success('Requerimiento cancelado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo cancelar')),
  });
}

/** Descarta un borrador que nunca salió (§15). */
export function useBorrarBorrador() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: (id: number) => borrarBorrador(id),
    onSuccess: () => invalidar(),
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo descartar el borrador')),
  });
}

// ── Escrituras: los ítems ──

export function useAgregarItem() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: ({
      requerimientoId,
      payload,
    }: {
      requerimientoId: number;
      payload: GuardarItemPayload;
    }) => agregarItem(requerimientoId, payload),
    onSuccess: (_item, { requerimientoId }) => {
      invalidar(requerimientoId);
      toast.success('Ítem agregado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo agregar el ítem')),
  });
}

/**
 * Edita un ítem y CUENTA lo que arrastró (§54).
 *
 * El aviso no es cosmético: si el cambio invalidó cotizaciones —o
 * deshizo el camino hasta una aprobación— quien editó tiene que
 * enterarse ahora, no descubrirlo al ver el estado cambiado.
 */
export function useEditarItem() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: ({
      requerimientoId,
      itemId,
      payload,
    }: {
      requerimientoId: number;
      itemId: number;
      payload: GuardarItemPayload;
    }) => editarItem(requerimientoId, itemId, payload),
    onSuccess: (item, { requerimientoId }) => {
      invalidar(requerimientoId);
      const { cotizacionesPendientesDeRevision, requerimientoReabierto } =
        item.efectos;

      if (requerimientoReabierto)
        toast.warning('El requerimiento volvió a cotización', {
          description:
            'El cambio afecta a la cotización aprobada: hay que volver a ' +
            'pedir precio y aprobar antes de registrar el costo.',
          duration: 10000,
        });
      else if (cotizacionesPendientesDeRevision > 0)
        toast.warning(
          `${cotizacionesPendientesDeRevision} cotización(es) quedaron pendientes de revisar`,
          {
            description: `Hay que volver a pedir precio a: ${item.efectos.proveedoresAConsultar.join(', ')}.`,
            duration: 8000,
          },
        );
      else toast.success('Ítem actualizado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar el ítem')),
  });
}

export function useBorrarItem() {
  const invalidar = useInvalidadores();
  return useMutation({
    mutationFn: ({
      requerimientoId,
      itemId,
    }: {
      requerimientoId: number;
      itemId: number;
    }) => borrarItem(requerimientoId, itemId),
    onSuccess: (resultado, { requerimientoId }) => {
      invalidar(requerimientoId);
      if (resultado.lineasHuerfanas > 0)
        toast.warning('Se quitó un ítem que ya estaba cotizado', {
          description:
            `Lo habían cotizado: ${resultado.proveedoresQueLoCotizaron.join(', ')}. ` +
            'Sus líneas quedan en las cotizaciones, ya sin ítem.',
          duration: 8000,
        });
      else toast.success('Ítem eliminado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar el ítem')),
  });
}
