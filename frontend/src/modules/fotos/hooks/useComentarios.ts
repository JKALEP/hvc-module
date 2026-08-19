import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';
import type { EntidadComentable } from '@/modules/fotos/types';

// Los comentarios de §14. Un solo archivo para las tres entidades, porque
// es el mismo recurso con distinto dueño — igual que en el backend.

export function useComentarios(
  entidad: EntidadComentable,
  entidadId: number | null,
  habilitado = true,
) {
  return useQuery({
    queryKey: QUERY_KEYS.comentarios(entidad, entidadId ?? 0),
    queryFn: () => fotos.verComentarios(entidad, entidadId!),
    enabled: habilitado && entidadId !== null,
  });
}

export function useComentar() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      entidad,
      entidadId,
      texto,
    }: {
      entidad: EntidadComentable;
      entidadId: number;
      texto: string;
    }) => fotos.comentar(entidad, entidadId, texto),
    onSuccess: () => invalidar(),
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo publicar el comentario')),
  });
}

export function useEditarComentario() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({ id, texto }: { id: number; texto: string }) =>
      fotos.editarComentario(id, texto),
    onSuccess: () => {
      invalidar();
      toast.success('Comentario editado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo editar el comentario')),
  });
}

export function useEliminarComentario() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (id: number) => fotos.eliminarComentario(id),
    onSuccess: () => {
      invalidar();
      toast.success('Comentario eliminado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar el comentario')),
  });
}
