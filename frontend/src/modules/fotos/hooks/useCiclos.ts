import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';

// Los ciclos (visitas) de un equipo: lecturas Y escrituras en un solo
// archivo, nombrado por el recurso, como el resto del módulo.

/**
 * El historial de visitas, del más reciente al más antiguo.
 *
 * `habilitado` porque solo se pide dentro de una carpeta de tipo EQUIPO: en
 * una corriente el backend contesta 400 —no tiene ciclos—, y pedirlo en cada
 * carpeta que se abre sería un error garantizado por pantalla.
 */
export function useCiclos(
  carpetaId: number | null,
  opciones: { habilitado?: boolean; portal?: boolean } = {},
) {
  const { habilitado = true, portal = false } = opciones;
  return useQuery({
    queryKey: portal
      ? QUERY_KEYS.portalCiclos(carpetaId ?? 0)
      : QUERY_KEYS.ciclos(carpetaId ?? 0),
    queryFn: () =>
      portal ? fotos.verCiclosPortal(carpetaId!) : fotos.verCiclos(carpetaId!),
    enabled: habilitado && carpetaId !== null,
  });
}

/**
 * Abre la visita siguiente.
 *
 * El aviso nombra cuántas actividades heredó: es lo que el usuario necesita
 * confirmar de un vistazo —que el checklist vino con el ciclo— sin tener que
 * contarlas en la lista.
 */
export function useAbrirCiclo() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (carpetaId: number) => fotos.abrirCiclo(carpetaId),
    onSuccess: (c) => {
      invalidar();
      toast.success(`Ciclo ${c.numero} abierto`);
    },
    // El backend dice cuál sigue abierto cuando lo rechaza; reescribirlo aquí
    // sería tener dos versiones de la misma regla.
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo abrir el ciclo')),
  });
}

export function useCerrarCiclo() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (cicloId: number) => fotos.cerrarCiclo(cicloId),
    onSuccess: (c) => {
      invalidar();
      toast.success(`Ciclo ${c.numero} cerrado`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo cerrar el ciclo')),
  });
}

/**
 * Reabre un ciclo cerrado. Excepcional, y el aviso lo dice.
 *
 * No es un `useCerrarCiclo` con un booleano: son dos decisiones distintas,
 * cada una deja su propia entrada en la bitácora y una de ellas hay que
 * pensársela. Mismo criterio que separa archivar de reabrir una carpeta.
 */
export function useReabrirCiclo() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (cicloId: number) => fotos.reabrirCiclo(cicloId),
    onSuccess: (c) => {
      invalidar();
      toast.success(`Ciclo ${c.numero} reabierto — queda registrado`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo reabrir el ciclo')),
  });
}

export function useCambiarEstadoCiclo() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      cicloId,
      estadoId,
    }: {
      cicloId: number;
      estadoId: number | null;
    }) => fotos.cambiarEstadoCiclo(cicloId, estadoId),
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
