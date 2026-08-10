import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listarUsuarios,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
} from '@/services/authService';
import { getErrorMessage } from '@/services/api';
import type { GuardarUsuarioPayload } from '@/types/models';

const CLAVE = ['usuarios'] as const;

export function useUsuarios() {
  return useQuery({ queryKey: CLAVE, queryFn: listarUsuarios });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: CLAVE });
}

export function useCrearUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (payload: GuardarUsuarioPayload) => crearUsuario(payload),
    onSuccess: (u) => {
      invalidar();
      toast.success(`Cuenta creada: ${u.nombre}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo crear la cuenta')),
  });
}

export function useEditarUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: GuardarUsuarioPayload;
    }) => editarUsuario(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Cuenta actualizada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar la cuenta')),
  });
}

export function useEliminarUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => eliminarUsuario(id),
    onSuccess: () => {
      invalidar();
      toast.success('Cuenta eliminada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar la cuenta')),
  });
}
