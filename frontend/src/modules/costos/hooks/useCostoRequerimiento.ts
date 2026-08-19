import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  corregirCosto,
  obtenerCosto,
  obtenerPlantillaCosto,
  registrarCosto,
} from '@/modules/costos/services/costosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type { RegistrarCostoPayload } from '@/modules/costos/types';

/**
 * El costo de UN requerimiento (§47-51).
 *
 * Distinto de `useBaseCostos`, que responde otra pregunta —el histórico
 * de §52— sobre otra ruta. Mismo criterio que en el backend, donde son
 * dos services.
 */

/** §48-49: proveedor y ítems ya cargados. Solo cuando toca registrar. */
export function usePlantillaCosto(
  requerimientoId: number | undefined,
  activo: boolean,
) {
  return useQuery({
    queryKey: QUERY_KEYS.plantillaCosto(requerimientoId ?? 0),
    queryFn: () => obtenerPlantillaCosto(requerimientoId as number),
    enabled:
      activo &&
      typeof requerimientoId === 'number' &&
      !Number.isNaN(requerimientoId),
  });
}

/**
 * El costo ya registrado.
 *
 * `activo` evita pedirlo cuando todavía no existe: el backend responde
 * 404 con un mensaje correcto, pero pedir algo que sabemos que no está
 * es ruido en la consola y un reintento inútil.
 */
export function useCosto(requerimientoId: number | undefined, activo: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.costo(requerimientoId ?? 0),
    queryFn: () => obtenerCosto(requerimientoId as number),
    enabled:
      activo &&
      typeof requerimientoId === 'number' &&
      !Number.isNaN(requerimientoId),
  });
}

/** Invalida el costo y el requerimiento, que cambia de estado al registrar. */
function useInvalidar() {
  const qc = useQueryClient();
  return (requerimientoId: number) => {
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.costo(requerimientoId) });
    void qc.invalidateQueries({
      queryKey: QUERY_KEYS.requerimiento(requerimientoId),
    });
    void qc.invalidateQueries({ queryKey: ['requerimientos'] });
    void qc.invalidateQueries({
      queryKey: QUERY_KEYS.historialRequerimiento(requerimientoId),
    });
    // El histórico de §52 se alimenta de esto.
    void qc.invalidateQueries({ queryKey: ['base-costos'] });
  };
}

export function useRegistrarCosto() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      requerimientoId,
      payload,
    }: {
      requerimientoId: number;
      payload: RegistrarCostoPayload;
    }) => registrarCosto(requerimientoId, payload),
    onSuccess: (_costo, { requerimientoId }) => {
      invalidar(requerimientoId);
      toast.success('Costo registrado', {
        description: 'El requerimiento quedó finalizado.',
      });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo registrar el costo')),
  });
}

export function useCorregirCosto() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      requerimientoId,
      payload,
    }: {
      requerimientoId: number;
      payload: RegistrarCostoPayload;
    }) => corregirCosto(requerimientoId, payload),
    onSuccess: (_costo, { requerimientoId }) => {
      invalidar(requerimientoId);
      toast.success('Costo corregido');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo corregir el costo')),
  });
}
