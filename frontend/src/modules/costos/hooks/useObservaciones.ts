import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  confirmarObservacion,
  crearObservacion,
  listarObservaciones,
} from '@/modules/costos/services/costosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';

/**
 * Las observaciones de un requerimiento (§27-29).
 *
 * Un archivo por recurso, con sus dos lados: el Gestor escribe (§27) y
 * el Solicitante confirma (§29). Están juntas porque son el mismo hilo
 * y refrescan la misma caché, no porque las use el mismo rol.
 */

export function useObservaciones(requerimientoId: number | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.observaciones(requerimientoId ?? 0),
    queryFn: () => listarObservaciones(requerimientoId as number),
    enabled:
      typeof requerimientoId === 'number' && !Number.isNaN(requerimientoId),
  });
}

/**
 * §27: el Gestor pide corregir y el requerimiento vuelve al Solicitante.
 *
 * Invalida el requerimiento además de la lista porque observar CAMBIA EL
 * ESTADO —pasa a OBSERVADO— y con él las acciones que la pantalla
 * ofrece. Sin eso, el Gestor seguiría viendo el botón de observar sobre
 * algo que ya devolvió.
 */
export function useCrearObservacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requerimientoId,
      texto,
    }: {
      requerimientoId: number;
      texto: string;
    }) => crearObservacion(requerimientoId, texto),
    onSuccess: (_obs, { requerimientoId }) => {
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.observaciones(requerimientoId),
      });
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.requerimiento(requerimientoId),
      });
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.historialRequerimiento(requerimientoId),
      });
      void qc.invalidateQueries({ queryKey: ['requerimientos'] });
      toast.success('Requerimiento observado', {
        description: 'Vuelve al solicitante para que lo corrija.',
      });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo observar')),
  });
}

/**
 * §29: deja constancia de que se leyó.
 *
 * Invalida también el requerimiento porque de esto depende poder
 * reemitir: sin refrescarlo, el botón «Devolver corregido» seguiría
 * deshabilitado con la observación ya confirmada.
 */
export function useConfirmarObservacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      observacionId,
      respuesta,
    }: {
      observacionId: number;
      requerimientoId: number;
      respuesta: string;
    }) => confirmarObservacion(observacionId, respuesta),
    onSuccess: (_obs, { requerimientoId }) => {
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.observaciones(requerimientoId),
      });
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.requerimiento(requerimientoId),
      });
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.historialRequerimiento(requerimientoId),
      });
      toast.success('Observación confirmada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo confirmar')),
  });
}
