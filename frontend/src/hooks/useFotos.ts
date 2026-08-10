import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/services/fotosService';
import { getErrorMessage } from '@/services/api';
import { QUERY_KEYS } from '@/lib/constants';
import type {
  EstadoAlbum,
  EstadoSede,
  FiltrosFeed,
  ResultadoSubida,
  TipoCompartible,
} from '@/types/models';

/**
 * Todo el módulo Fotos cuelga de la clave ['fotos', …], así que tras una
 * mutación basta invalidar la raíz: son pocas consultas y evita la lista
 * de 16 claves que hizo falta en el módulo de proyectos.
 */
function useInvalidarFotos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['fotos'] });
}

// ── Navegación por carpetas ──

export function useNavegacion(sedeId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.navegacion(sedeId),
    queryFn: () => fotos.navegar(sedeId),
    // Al bajar y subir de carpeta se conserva lo anterior: sin esto el
    // explorador parpadea en blanco en cada click.
    placeholderData: (previo) => previo,
  });
}

// ── Sedes ──

export function useCrearSede() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (payload: { nombre: string; parentId: number | null }) =>
      fotos.crearSede(payload),
    onSuccess: (s) => {
      invalidar();
      toast.success(`Carpeta creada: ${s.nombre}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo crear la carpeta')),
  });
}

export function useEditarSede() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: {
        nombre?: string;
        parentId?: number | null;
        estado?: EstadoSede;
      };
    }) => fotos.editarSede(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Carpeta actualizada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar la carpeta')),
  });
}

export function useEliminarSede() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (id: number) => fotos.eliminarSede(id),
    onSuccess: () => {
      invalidar();
      toast.success('Carpeta eliminada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar la carpeta')),
  });
}

// ── Álbumes ──

export function useAlbumes(sedeId: number | null = null) {
  return useQuery({
    queryKey: QUERY_KEYS.albumes(sedeId),
    queryFn: () => fotos.listarAlbumes(sedeId),
  });
}

export function useAlbum(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.album(id),
    queryFn: () => fotos.obtenerAlbum(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useCrearAlbum() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (payload: {
      sedeId: number;
      nombre: string;
      descripcion?: string | null;
    }) => fotos.crearAlbum(payload),
    onSuccess: (a) => {
      invalidar();
      toast.success(`Álbum creado: ${a.nombre}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo crear el álbum')),
  });
}

export function useEditarAlbum() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: {
        nombre?: string;
        descripcion?: string | null;
        sedeId?: number;
        estado?: EstadoAlbum;
      };
    }) => fotos.editarAlbum(id, payload),
    onSuccess: (a) => {
      invalidar();
      toast.success(
        a.estado === 'CERRADO'
          ? `"${a.nombre}" quedó cerrado: nadie puede subir fotos`
          : 'Álbum actualizado',
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar el álbum')),
  });
}

// ── Compartir ──

export function useCompartidos(tipo: TipoCompartible, id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.compartidos(tipo, id),
    queryFn: () => fotos.listarCompartidos(tipo, id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useCompartir() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      tipo,
      id,
      email,
    }: {
      tipo: TipoCompartible;
      id: number;
      email: string;
    }) => fotos.compartirCon(tipo, id, email),
    onSuccess: (r) => {
      invalidar();
      // El aviso dice por qué camino fue, porque el resultado es distinto:
      // uno ya tiene acceso, el otro tiene que activar su cuenta.
      if (r.via === 'acceso-directo')
        toast.success(`${r.nombre} ya tiene acceso`);
      else toast.success(`Invitación enviada a ${r.email}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo compartir')),
  });
}

export function useDejarDeCompartir() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      tipo,
      id,
      usuarioId,
    }: {
      tipo: TipoCompartible;
      id: number;
      usuarioId: number;
    }) => fotos.dejarDeCompartir(tipo, id, usuarioId),
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

// ── Portal del cliente externo ──

export function usePortalNavegacion(sedeId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.portalNavegacion(sedeId),
    queryFn: () => fotos.navegarPortal(sedeId),
    placeholderData: (previo) => previo,
  });
}

export function usePortalFeed(albumId: number, filtros: FiltrosFeed) {
  return useQuery({
    queryKey: QUERY_KEYS.portalFeed(albumId, filtros),
    queryFn: () => fotos.feedPortal(albumId, filtros),
    enabled: Number.isFinite(albumId) && albumId > 0,
    placeholderData: (previo) => previo,
  });
}

// ── Feed ──

export function useFeedAlbum(albumId: number, filtros: FiltrosFeed) {
  return useQuery({
    queryKey: QUERY_KEYS.feedAlbum(albumId, filtros),
    queryFn: () => fotos.obtenerFeed(albumId, filtros),
    enabled: Number.isFinite(albumId) && albumId > 0,
    // Al cambiar un filtro se conserva lo anterior: sin esto la galería
    // parpadea en blanco en cada tecleo de fecha.
    placeholderData: (previo) => previo,
  });
}

export function useAutoresAlbum(albumId: number) {
  return useQuery({
    queryKey: QUERY_KEYS.autoresAlbum(albumId),
    queryFn: () => fotos.listarAutores(albumId),
    enabled: Number.isFinite(albumId) && albumId > 0,
  });
}

/** Resume el resultado de una subida parcial en un solo aviso. */
function avisarSubida(r: ResultadoSubida) {
  if (r.fallidas.length === 0) {
    toast.success(`${r.subidas} foto(s) subida(s)`);
    return;
  }
  // Las que sí entraron se guardaron: el aviso lo dice para que nadie
  // reintente la tanda entera.
  toast.warning(
    `${r.subidas} subida(s), ${r.fallidas.length} con problemas: ` +
      r.fallidas.map((f) => `${f.archivo} (${f.motivo})`).join(' · '),
  );
}

export function useSubirFotos() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      albumId,
      archivos,
      descripcion,
    }: {
      albumId: number;
      archivos: File[];
      descripcion: string;
    }) => fotos.subirFotos(albumId, archivos, descripcion),
    onSuccess: (r) => {
      invalidar();
      avisarSubida(r);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudieron subir las fotos')),
  });
}

export function useEliminarFoto() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({ albumId, fotoId }: { albumId: number; fotoId: number }) =>
      fotos.eliminarFoto(albumId, fotoId),
    onSuccess: () => {
      invalidar();
      toast.success('Foto eliminada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar la foto')),
  });
}
