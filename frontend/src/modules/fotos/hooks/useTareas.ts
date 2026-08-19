import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';
import type { EstadoTarea, NuevaTarea } from '@/modules/fotos/types';

// Las tareas de §13: lecturas Y escrituras en un solo archivo, nombrado por
// el recurso. Un `…Mutations` aparte sería partir el mismo recurso en dos.

/**
 * Las tareas de un equipo.
 *
 * `habilitado` porque la lista solo se pide dentro de una carpeta de tipo
 * EQUIPO: en una carpeta corriente el backend contestaría 200 con `[]`, pero
 * pedirlo sería una consulta por cada carpeta que se abre para nada.
 */
export function useTareas(
  carpetaId: number | null,
  opciones: { estado?: EstadoTarea | ''; habilitado?: boolean } = {},
) {
  const { estado = '', habilitado = true } = opciones;
  return useQuery({
    queryKey: QUERY_KEYS.tareas(carpetaId ?? 0, estado),
    queryFn: () => fotos.verTareas(carpetaId!, estado || undefined),
    enabled: habilitado && carpetaId !== null,
  });
}

export function useCrearTarea() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      carpetaId,
      payload,
    }: {
      carpetaId: number;
      payload: NuevaTarea;
    }) => fotos.crearTarea(carpetaId, payload),
    onSuccess: (t) => {
      invalidar();
      toast.success(`Tarea creada: ${t.titulo}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo crear la tarea')),
  });
}

export function useEditarTarea() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<NuevaTarea>;
    }) => fotos.editarTarea(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Tarea actualizada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar la tarea')),
  });
}

/**
 * El check rápido de §13.
 *
 * Hook propio y no `useEditarTarea` con `{estado}`: el aviso es distinto
 * —nombra quién y cuándo, que es lo que §13 pide registrar— y se dispara
 * desde una casilla, no desde el formulario.
 */
export function useMarcarTarea() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({ id, completada }: { id: number; completada: boolean }) =>
      fotos.marcarTarea(id, completada),
    onSuccess: (t) => {
      invalidar();
      toast.success(
        t.completadaPor
          ? `"${t.titulo}" completada por ${t.completadaPor.nombre}`
          : `"${t.titulo}" vuelve a estar pendiente`,
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo cambiar la tarea')),
  });
}

export function useEliminarTarea() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (id: number) => fotos.eliminarTarea(id),
    onSuccess: () => {
      invalidar();
      toast.success('Tarea eliminada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar la tarea')),
  });
}
