import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  decidir,
  listarAprobaciones,
} from '@/modules/costos/services/aprobacionService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type { DecidirPayload } from '@/modules/costos/types';

/** Las decisiones del Aprobador (§41-45): el historial y el acto. */

export function useAprobaciones(requerimientoId: number | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.aprobaciones(requerimientoId ?? 0),
    queryFn: () => listarAprobaciones(requerimientoId as number),
    enabled:
      typeof requerimientoId === 'number' && !Number.isNaN(requerimientoId),
  });
}

/**
 * Decidir mueve medio expediente, así que se invalida medio expediente.
 *
 * No solo el requerimiento: aceptar deja la cotización recomendada
 * APROBADA y rechazar la deja RECHAZADA, y esos dos cambios se ven en
 * la lista de cotizaciones y en la comparación. Refrescar solo el
 * estado dejaría la pantalla enseñando una cotización «recomendada»
 * sobre la que ya se decidió.
 */
export function useDecidir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requerimientoId,
      payload,
    }: {
      requerimientoId: number;
      payload: DecidirPayload;
    }) => decidir(requerimientoId, payload),
    onSuccess: (_req, { requerimientoId, payload }) => {
      for (const key of [
        QUERY_KEYS.requerimiento(requerimientoId),
        QUERY_KEYS.aprobaciones(requerimientoId),
        QUERY_KEYS.evaluaciones(requerimientoId),
        QUERY_KEYS.cotizaciones(requerimientoId),
        QUERY_KEYS.comparacion(requerimientoId),
        QUERY_KEYS.historialRequerimiento(requerimientoId),
      ])
        void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ['requerimientos'] });

      if (payload.decision === 'ACEPTADA')
        toast.success('Requerimiento aprobado', {
          description: 'Pasa al solicitante para que registre el costo.',
        });
      else if (payload.decision === 'RECHAZADA')
        toast.success('Recomendación rechazada', {
          description: 'Vuelve al gestor, que puede evaluar otra vez.',
        });
      else
        toast.success('Cerrado sin acuerdo', {
          description: 'El requerimiento queda cerrado sin compra.',
        });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo registrar la decisión')),
  });
}
