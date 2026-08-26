import { useQuery, useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';
import type { DestinoFotos } from '@/modules/fotos/types';
import type { FiltrosGaleria, ResultadoSubida } from '@/modules/fotos/types';

// Las fotos de una VISITA: lecturas y escrituras en un solo archivo,
// nombrado por el recurso.
//
// ⚠️ Se llamaba `useAlbumes` y paginaba por álbum. Los álbumes se retiraron
// en la Fase 4 del rediseño: el agrupador es el ciclo, que la pantalla ya
// eligió antes de pedir esto, así que la galería es una lista plana.

/**
 * Galería de un ciclo, paginada por cursor.
 *
 * `useInfiniteQuery` con el cursor que devuelve el backend: se pide más
 * cuando el usuario lo pide, no todo de golpe.
 */
export function useGaleria(
  cicloId: number,
  filtros: FiltrosGaleria,
  portal = false,
) {
  return useInfiniteQuery({
    queryKey: portal
      ? QUERY_KEYS.portalGaleria(cicloId, filtros)
      : QUERY_KEYS.galeria(cicloId, filtros),
    queryFn: ({ pageParam }) =>
      portal
        ? fotos.verGaleriaPortal(cicloId, filtros, pageParam ?? undefined)
        : fotos.verGaleria(cicloId, filtros, pageParam ?? undefined),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) => ultima.siguiente,
    enabled: Number.isFinite(cicloId) && cicloId > 0,
  });
}

export function useAutores(cicloId: number, habilitado = true) {
  return useQuery({
    queryKey: QUERY_KEYS.autores(cicloId),
    queryFn: () => fotos.verAutores(cicloId),
    enabled: habilitado && Number.isFinite(cicloId) && cicloId > 0,
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
      cicloId,
      archivos,
      descripcion,
    }: {
      cicloId: number;
      archivos: File[];
      descripcion: string;
    }) => fotos.subirFotos(cicloId, archivos, descripcion),
    onSuccess: (r) => {
      invalidar();
      avisarSubida(r);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudieron subir las fotos')),
  });
}

/**
 * Corregir la descripción de una foto.
 *
 * Invalida todo lo de Fotos: la descripción se ve en la galería y en las
 * fotos de una actividad, que son dos consultas distintas sobre el mismo dato.
 */
export function useEditarDescripcionFoto() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (vars: { fotoId: number; descripcion: string | null }) =>
      fotos.editarDescripcionFoto(vars.fotoId, vars.descripcion),
    onSuccess: () => {
      invalidar();
      toast.success('Descripción actualizada');
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'No se pudo cambiar la descripción'),
      ),
  });
}

/**
 * Mover una foto de sitio.
 *
 * Invalida todo lo de Fotos: la foto sale de una galería y entra en otra, y
 * los contadores de las dos carpetas cambian.
 */
export function useMoverFoto() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (vars: { fotoId: number; destino: DestinoFotos }) =>
      fotos.moverFoto(vars.fotoId, vars.destino),
    onSuccess: (r) => {
      invalidar();
      toast.success(r.sinCambios ? 'La foto ya estaba ahí' : 'Foto movida');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo mover la foto')),
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

// ⚠️ Aquí vivían `useCrearAlbum`, `useEditarAlbum` y `useEliminarAlbum`.
// Se fueron con los álbumes en la Fase 4: no queda ninguna ruta detrás, y el
// agrupador que hacía falta —la visita— existe sin que nadie lo cree.
