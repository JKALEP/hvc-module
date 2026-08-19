import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  activarVersionPlantilla,
  crearVersionPlantilla,
  obtenerPlantilla,
  previsualizarPlantilla,
} from '@/modules/costos/services/adminService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type { CrearVersionPayload } from '@/modules/costos/types';

/**
 * La plantilla del correo de solicitud (§32, §68).
 *
 * Una sola consulta trae la plantilla, todas sus versiones, las
 * variables disponibles y qué se está usando ahora: son cuatro cosas
 * que solo tienen sentido juntas —no se puede decidir si publicar sin
 * ver qué hay— y pedirlas por separado serían cuatro viajes para pintar
 * una pantalla.
 */
export function usePlantilla() {
  return useQuery({
    queryKey: QUERY_KEYS.plantillaCorreo,
    queryFn: obtenerPlantilla,
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.plantillaCorreo });
  };
}

export function useCrearVersion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (payload: CrearVersionPayload) => crearVersionPlantilla(payload),
    onSuccess: (version) => {
      invalidar();
      toast.success(`Versión ${version.version} publicada`, {
        description: version.activa
          ? 'Las solicitudes que se manden desde ahora usarán este texto.'
          : 'Queda guardada sin activar: las solicitudes siguen usando la anterior.',
      });
    },
    onError: (error) =>
      // El backend rechaza los marcadores inventados y su mensaje ya
      // lista los que existen: mostrarlo entero es más útil que
      // resumirlo.
      toast.error(getErrorMessage(error, 'No se pudo publicar la versión'), {
        duration: 10000,
      }),
  });
}

export function useActivarVersion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (versionId: number) => activarVersionPlantilla(versionId),
    onSuccess: (version) => {
      invalidar();
      toast.success(`Ahora se usa la versión ${version.version}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo activar la versión')),
  });
}

/**
 * La vista previa (§32).
 *
 * Mutación y no consulta porque se pide sobre un borrador que solo
 * existe en el formulario: no hay clave estable que cachear, y
 * guardarla llenaría la caché de textos a medio escribir.
 */
export function usePrevisualizar() {
  return useMutation({
    mutationFn: (payload: { asunto: string; cuerpo: string }) =>
      previsualizarPlantilla(payload),
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo generar la vista previa')),
  });
}
