import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';

// Las observaciones de §8: lecturas Y escrituras en un solo archivo,
// nombrado por el recurso, como el resto del módulo.

/**
 * Lo que hay que atender en esta intervención: las suyas más las arrastradas.
 *
 * La clave es la INTERVENCIÓN porque la respuesta depende de él —qué se arrastra y
 * cuántas intervenciones lleva abierta cada una salen de comparar con esta intervención—,
 * así que dos intervenciones no pueden compartir caché aunque las filas sean las
 * mismas.
 */
export function useObservaciones(intervencionId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.observacionesFotos(intervencionId ?? 0),
    queryFn: () => fotos.verObservaciones(intervencionId!),
    enabled: intervencionId !== null,
  });
}

/** Las de UNA actividad. Se leen dentro de ella, no en el panel general. */
export function useObservacionesDeActividad(actividadId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.observacionesDeActividad(actividadId ?? 0),
    queryFn: () => fotos.verObservacionesDeActividad(actividadId!),
    enabled: actividadId !== null,
  });
}

export function useCrearObservacionEnActividad() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      actividadId,
      texto,
    }: {
      actividadId: number;
      texto: string;
    }) => fotos.crearObservacionEnActividad(actividadId, texto),
    onSuccess: () => {
      invalidar();
      toast.success('Observación registrada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo registrar la observación')),
  });
}

export function useCrearObservacion() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({ intervencionId, texto }: { intervencionId: number; texto: string }) =>
      fotos.crearObservacion(intervencionId, texto),
    onSuccess: () => {
      invalidar();
      toast.success('Observación registrada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo registrar la observación')),
  });
}

export function useEditarObservacion() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({ id, texto }: { id: number; texto: string }) =>
      fotos.editarObservacion(id, texto),
    onSuccess: () => {
      invalidar();
      toast.success('Observación actualizada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar')),
  });
}

/**
 * Dar por resuelta, o volver a abrir.
 *
 * Hook propio y no `useEditarObservacion` con `{estado}`: el aviso es otro
 * —nombra quién y cuándo, que es lo que §8 quiere poder auditar— y se
 * dispara desde una casilla, no desde el formulario. Mismo criterio que
 * completar una actividad.
 */
export function useResolverObservacion() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({ id, resuelta }: { id: number; resuelta: boolean }) =>
      fotos.resolverObservacion(id, resuelta),
    onSuccess: (o) => {
      invalidar();
      toast.success(
        o.estado === 'RESUELTA'
          ? `Resuelta por ${o.resueltaPor?.nombre ?? 'ti'}`
          : 'Vuelve a estar pendiente',
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo cambiar la observación')),
  });
}

export function useEliminarObservacion() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (id: number) => fotos.eliminarObservacion(id),
    onSuccess: () => {
      invalidar();
      toast.success('Observación eliminada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar')),
  });
}
