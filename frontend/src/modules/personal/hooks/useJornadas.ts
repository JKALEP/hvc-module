import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  listarJornadas,
  guardarJornada,
  eliminarJornada,
  empresasParticipantes,
  participacion,
  calendarioDePersona,
} from '@/modules/personal/services/obraService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type { GuardarJornadaPayload } from '@/modules/personal/types';

/**
 * El registro diario y todo lo que se deduce de él.
 *
 * Guardar una jornada invalida cuatro cosas a la vez —la grilla, la
 * cabecera del proyecto (avance y estado), las empresas participantes y
 * la participación del personal— porque las cuatro se calculan de la
 * misma asistencia.
 */
function useInvalidarObra(proyectoId: number) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.obraJornadas(proyectoId) });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.obraProyecto(proyectoId) });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.obraEmpresas(proyectoId) });
    void qc.invalidateQueries({
      queryKey: QUERY_KEYS.obraParticipacion(proyectoId),
    });
    // El avance cambió, así que la tarjeta del explorador también.
    void qc.invalidateQueries({ queryKey: ['obra-navegacion'] });
  };
}

export function useJornadas(proyectoId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.obraJornadas(proyectoId ?? 0),
    queryFn: () => listarJornadas(proyectoId as number),
    enabled: proyectoId !== null,
  });
}

/**
 * Crea o reemplaza el día. Sin toast en el camino feliz: en la grilla se
 * guarda celda a celda y un aviso por cada una taparía la pantalla.
 */
export function useGuardarJornada(proyectoId: number) {
  const invalidar = useInvalidarObra(proyectoId);
  return useMutation({
    mutationFn: (payload: GuardarJornadaPayload) =>
      guardarJornada(proyectoId, payload),
    onSuccess: () => invalidar(),
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo guardar la jornada')),
  });
}

export function useEliminarJornada(proyectoId: number) {
  const invalidar = useInvalidarObra(proyectoId);
  return useMutation({
    mutationFn: (id: number) => eliminarJornada(id),
    onSuccess: (r) => {
      invalidar();
      toast.success(`Jornada del ${r.fecha} eliminada`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo eliminar')),
  });
}

// ── Analítica, toda calculada de la asistencia ──

export function useEmpresasParticipantes(proyectoId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.obraEmpresas(proyectoId ?? 0),
    queryFn: () => empresasParticipantes(proyectoId as number),
    enabled: proyectoId !== null,
  });
}

export function useParticipacion(proyectoId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.obraParticipacion(proyectoId ?? 0),
    queryFn: () => participacion(proyectoId as number),
    enabled: proyectoId !== null,
  });
}

/** El calendario ✓/✗ de una persona. Solo se pide al abrir su modal. */
export function useCalendarioPersona(
  proyectoId: number,
  documento: string | null,
) {
  return useQuery({
    queryKey: QUERY_KEYS.obraPersona(proyectoId, documento ?? ''),
    queryFn: () => calendarioDePersona(proyectoId, documento as string),
    enabled: documento !== null,
  });
}
