import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';

// Las intervenciones de un equipo: lecturas Y escrituras en un solo
// archivo, nombrado por el recurso, como el resto del módulo.

/**
 * El historial de intervenciónes, del más reciente al más antiguo.
 *
 * `habilitado` porque solo se pide dentro de una carpeta de tipo EQUIPO: en
 * una corriente el backend contesta 400 —no tiene intervenciones—, y pedirlo en cada
 * carpeta que se abre sería un error garantizado por pantalla.
 */
export function useIntervenciones(
  carpetaId: number | null,
  opciones: { habilitado?: boolean; portal?: boolean } = {},
) {
  const { habilitado = true, portal = false } = opciones;
  return useQuery({
    queryKey: portal
      ? QUERY_KEYS.portalIntervenciones(carpetaId ?? 0)
      : QUERY_KEYS.intervenciones(carpetaId ?? 0),
    queryFn: () =>
      portal ? fotos.verIntervencionesPortal(carpetaId!) : fotos.verIntervenciones(carpetaId!),
    enabled: habilitado && carpetaId !== null,
  });
}

/**
 * Abre la intervención siguiente.
 *
 * El aviso nombra cuántas actividades heredó: es lo que el usuario necesita
 * confirmar de un vistazo —que el checklist vino con la intervención— sin tener que
 * contarlas en la lista.
 */
export function useAbrirIntervencion() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (carpetaId: number) => fotos.abrirIntervencion(carpetaId),
    onSuccess: (c) => {
      invalidar();
      toast.success(`Intervención ${c.numero} abierta`);
    },
    // El backend dice cuál sigue abierto cuando lo rechaza; reescribirlo aquí
    // sería tener dos versiones de la misma regla.
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo abrir la intervención')),
  });
}

export function useCerrarIntervencion() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (intervencionId: number) => fotos.cerrarIntervencion(intervencionId),
    onSuccess: (c) => {
      invalidar();
      toast.success(`Intervención ${c.numero} cerrada`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo cerrar la intervención')),
  });
}

/**
 * Reabre una intervención cerrada. Excepcional, y el aviso lo dice.
 *
 * No es un `useCerrarIntervencion` con un booleano: son dos decisiones distintas,
 * cada una deja su propia entrada en la bitácora y una de ellas hay que
 * pensársela. Mismo criterio que separa archivar de reabrir una carpeta.
 */
export function useReabrirIntervencion() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (intervencionId: number) => fotos.reabrirIntervencion(intervencionId),
    onSuccess: (c) => {
      invalidar();
      toast.success(`Intervencion ${c.numero} reabierto — queda registrado`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo reabrir la intervención')),
  });
}

export function useCambiarEstadoIntervencion() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      intervencionId,
      estadoId,
    }: {
      intervencionId: number;
      estadoId: number | null;
    }) => fotos.cambiarEstadoIntervencion(intervencionId, estadoId),
    onSuccess: (c) => {
      invalidar();
      toast.success(
        c.estado
          ? `Estado del equipo: ${c.estado.nombre}`
          : 'Estado del equipo sin definir',
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo cambiar el estado')),
  });
}
