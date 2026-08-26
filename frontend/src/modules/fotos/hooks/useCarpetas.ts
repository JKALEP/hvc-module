import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';
import type { Orden } from '@/modules/fotos/types';

// Navegar por carpetas y administrarlas.

/**
 * Contenido de una carpeta. `null` es la raíz.
 *
 * `q` y `orden` entran en la query key: son parte de QUÉ se está pidiendo,
 * no un filtro que se aplique después. Dejarlos fuera haría que buscar
 * devolviera de caché el listado sin buscar.
 */
export function useCarpeta(
  carpetaId: number | null,
  opciones: { q?: string; orden?: Orden; portal?: boolean } = {},
) {
  const { q = '', orden = 'nombre', portal = false } = opciones;
  return useQuery({
    queryKey: portal
      ? QUERY_KEYS.portalCarpeta(carpetaId)
      : QUERY_KEYS.carpeta(carpetaId, q, orden),
    queryFn: () =>
      portal
        ? fotos.verCarpetaPortal(carpetaId)
        : fotos.verCarpeta(carpetaId, { q, orden }),
    // Al bajar y subir de carpeta se conserva lo anterior: sin esto el
    // explorador parpadea en blanco en cada click.
    placeholderData: (previo) => previo,
  });
}

/** Lo que cambió hace menos (§21). Solo se pide cuando se mira esa vista. */
export function useRecientes(habilitado = true) {
  return useQuery({
    queryKey: QUERY_KEYS.carpetasRecientes,
    queryFn: fotos.verRecientes,
    enabled: habilitado,
  });
}

// ── Administrar ──

export function useCrearCarpeta() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (payload: {
      nombre: string;
      parentId: number | null;
      /** Desde la Fase 1a, `EQUIPO` ya no lleva `equipoId`. */
      tipo?: 'CARPETA' | 'EQUIPO';
      /** Los campos configurables del equipo (Fase 1b). */
      valores?: Record<string, unknown>;
      /** El tipo de sistema y el checklist inicial (Fase 2). */
      tipoSistemaId?: number | null;
      actividades?: number[];
    }) => fotos.crearCarpeta(payload),
    onSuccess: (c, variables) => {
      invalidar();
      toast.success(
        variables.tipo === 'EQUIPO'
          ? `Equipo añadido: ${c.nombre}`
          : `Carpeta creada: ${c.nombre}`,
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo crear la carpeta')),
  });
}

/** Renombrar y/o mover. Archivar es otro hook: otra regla y otro aviso. */
export function useEditarCarpeta() {
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
        /** Corregir el tipo de sistema de un equipo (Fase 2). */
        tipoSistemaId?: number | null;
      };
    }) => fotos.editarCarpeta(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Carpeta actualizada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar la carpeta')),
  });
}

export function useArchivarCarpeta() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({ id, cerrada }: { id: number; cerrada: boolean }) =>
      fotos.archivarCarpeta(id, cerrada),
    onSuccess: (c) => {
      invalidar();
      toast.success(
        c.cerrada
          ? `"${c.nombre}" quedó archivada: ella y todo lo que tiene dentro son de solo lectura`
          : `"${c.nombre}" vuelve a estar activa`,
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo archivar la carpeta')),
  });
}

export function useEliminarCarpeta() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (id: number) => fotos.eliminarCarpeta(id),
    onSuccess: () => {
      invalidar();
      toast.success('Carpeta eliminada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar la carpeta')),
  });
}
