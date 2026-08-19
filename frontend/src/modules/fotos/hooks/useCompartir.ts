import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { ETIQUETA_PERMISO } from '@/modules/fotos/lib/permisos';
import { useInvalidarFotos } from './useInvalidarFotos';
import type { PermisoCarpeta } from '@/modules/fotos/types';

// Compartir carpetas e invitar clientes externos.

export function useCarpetasCompartibles(habilitado = true) {
  return useQuery({
    queryKey: QUERY_KEYS.carpetasCompartibles,
    queryFn: fotos.carpetasCompartibles,
    enabled: habilitado,
  });
}

export function useCompartidos(carpetaId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.compartidos(carpetaId ?? 0),
    queryFn: () => fotos.verCompartidos(carpetaId as number),
    enabled: carpetaId !== null,
  });
}

export function useCompartir() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      email,
      carpetaIds,
      permiso,
      expiraEn,
      nombre,
    }: {
      email: string;
      carpetaIds: number[];
      permiso: PermisoCarpeta;
      /** Los dos opcionales de §9. Solo aplican si acaba en invitación. */
      expiraEn?: string;
      nombre?: string;
    }) => fotos.compartir(email, carpetaIds, permiso, { expiraEn, nombre }),
    onSuccess: (r) => {
      invalidar();
      const cuantas = `${r.carpetas.length} carpeta(s)`;
      // El aviso dice por qué camino fue: uno ya tiene acceso, el otro
      // todavía tiene que activar su cuenta.
      if (r.via === 'acceso-directo')
        toast.success(`${r.nombre ?? r.email} ya tiene acceso a ${cuantas}`);
      else toast.success(`Invitación creada para ${r.email} · ${cuantas}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo compartir')),
  });
}

export function useCambiarGrado() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      carpetaId,
      usuarioId,
      permiso,
    }: {
      carpetaId: number;
      usuarioId: number;
      permiso: PermisoCarpeta;
    }) => fotos.cambiarGrado(carpetaId, usuarioId, permiso),
    onSuccess: (r) => {
      invalidar();
      toast.success(
        r.permiso === 'SIN_ACCESO'
          ? 'Acceso restringido en esta carpeta'
          : `Permiso cambiado a ${ETIQUETA_PERMISO[r.permiso]}`,
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo cambiar el permiso')),
  });
}

export function useDejarDeCompartir() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      carpetaId,
      usuarioId,
    }: {
      carpetaId: number;
      usuarioId: number;
    }) => fotos.dejarDeCompartir(carpetaId, usuarioId),
    onSuccess: () => {
      invalidar();
      toast.success('Acceso retirado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo quitar el acceso')),
  });
}

export function useReenviarInvitacion() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (invitacionId: number) =>
      fotos.reenviarInvitacion(invitacionId),
    onSuccess: () => {
      invalidar();
      toast.success('Invitación reenviada. El enlace anterior ya no sirve.');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo reenviar')),
  });
}

export function useCancelarInvitacion() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (invitacionId: number) =>
      fotos.cancelarInvitacion(invitacionId),
    onSuccess: () => {
      invalidar();
      toast.success('Invitación cancelada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo cancelar')),
  });
}
