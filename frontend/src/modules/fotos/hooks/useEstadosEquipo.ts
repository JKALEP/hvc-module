import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';
import type { ColorEstado } from '@/modules/fotos/types';

// El catálogo de estados de equipo (§7). Archivo propio y no dentro de
// `useAdminFotos` porque no es solo de administración: LEERLO hace falta en
// cada equipo para elegir el estado de la visita, y solo escribir es de
// ADMIN_GLOBAL. Es la misma frontera que separa definir un campo de
// rellenarlo.

/**
 * Los estados.
 *
 * `soloActivos` para el formulario —un estado retirado ya no se ofrece— y
 * todos para la pantalla de administración, donde hay que poder reactivarlo.
 *
 * `staleTime` largo: el catálogo lo cambia un administrador de higos a
 * brevas, no dentro de una sesión de trabajo en obra.
 */
export function useEstadosEquipo(soloActivos = false) {
  return useQuery({
    queryKey: QUERY_KEYS.estadosEquipo(soloActivos),
    queryFn: () => fotos.verEstadosEquipo(soloActivos),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCrearEstadoEquipo() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (payload: {
      nombre: string;
      color: ColorEstado;
      orden?: number;
    }) => fotos.crearEstadoEquipo(payload),
    onSuccess: (e) => {
      invalidar();
      toast.success(`Estado creado: ${e.nombre}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo crear el estado')),
  });
}

export function useEditarEstadoEquipo() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: {
        nombre?: string;
        color?: ColorEstado;
        orden?: number;
        activo?: boolean;
      };
    }) => fotos.editarEstadoEquipo(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Estado actualizado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar el estado')),
  });
}

/**
 * Borrado real, y el backend lo rechaza si algún ciclo lo usa.
 *
 * El mensaje sale TAL CUAL del servidor: ya dice cuántos ciclos lo sostienen
 * y ofrece retirarlo en su lugar. Mismo criterio que la administración de
 * Costos.
 */
export function useEliminarEstadoEquipo() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (id: number) => fotos.eliminarEstadoEquipo(id),
    onSuccess: () => {
      invalidar();
      toast.success('Estado eliminado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar el estado')),
  });
}
