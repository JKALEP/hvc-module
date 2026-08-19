import { useQuery, useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';
import type { FiltrosGaleria, ResultadoSubida } from '@/modules/fotos/types';

// Galería y fotos. Se pagina por LOTE: un lote son 10 fotos como
// máximo, así que acotar albumes acota las fotos solo.

/**
 * Galería paginada por lote.
 *
 * `useInfiniteQuery` con el cursor que devuelve el backend: se pide más
 * cuando el usuario lo pide, no todo de golpe.
 */
export function useGaleria(
  sedeId: number,
  filtros: FiltrosGaleria,
  portal = false,
) {
  return useInfiniteQuery({
    queryKey: portal
      ? QUERY_KEYS.portalGaleria(sedeId, filtros)
      : QUERY_KEYS.galeria(sedeId, filtros),
    queryFn: ({ pageParam }) =>
      portal
        ? fotos.verGaleriaPortal(sedeId, filtros, pageParam ?? undefined)
        : fotos.verGaleria(sedeId, filtros, pageParam ?? undefined),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) => ultima.siguiente,
    enabled: Number.isFinite(sedeId) && sedeId > 0,
  });
}

export function useAutores(sedeId: number, habilitado = true) {
  return useQuery({
    queryKey: QUERY_KEYS.autores(sedeId),
    queryFn: () => fotos.verAutores(sedeId),
    enabled: habilitado && Number.isFinite(sedeId) && sedeId > 0,
  });
}

// ── Fotos ──

/** Resume una subida parcial en un solo aviso. */
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
      sedeId,
      archivos,
      descripcion,
    }: {
      sedeId: number;
      archivos: File[];
      descripcion: string;
    }) => fotos.subirFotos(sedeId, archivos, descripcion),
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
    mutationFn: (fotoId: number) => fotos.eliminarFoto(fotoId),
    onSuccess: () => {
      invalidar();
      toast.success('Foto eliminada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar la foto')),
  });
}

/**
 * Crear un álbum vacío con nombre (§16).
 *
 * Existe además de subir fotos: §16 quiere el álbum como tipo de contenido,
 * no solo como efecto de arrastrar archivos.
 */
export function useCrearAlbum() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      carpetaId,
      payload,
    }: {
      carpetaId: number;
      payload: { nombre: string; descripcion?: string | null; fecha?: string | null };
    }) => fotos.crearAlbum(carpetaId, payload),
    onSuccess: (a) => {
      invalidar();
      toast.success(`Álbum creado: ${a.nombre ?? 'sin título'}`);
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
        nombre?: string | null;
        descripcion?: string | null;
        fecha?: string | null;
      };
    }) => fotos.editarAlbum(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Álbum actualizado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar el álbum')),
  });
}
