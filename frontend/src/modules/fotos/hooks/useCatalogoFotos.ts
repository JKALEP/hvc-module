import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';
import type { TipoEvidencia } from '@/modules/fotos/types';

// El vocabulario de la Fase 2: familias y tipos de sistema, y el catálogo de
// actividades. Un solo archivo para los dos porque son UNA cosa desde fuera
// —«qué se propone para qué clase de equipo»— y siempre se leen juntos: el
// formulario de alta pide los tipos para elegir y el catálogo para
// preseleccionar, en la misma pantalla.

/**
 * Las familias con sus tipos dentro.
 *
 * `soloActivos` para los formularios —lo retirado ya no se ofrece— y todos
 * para administración, donde hay que poder reactivarlo.
 *
 * `staleTime` largo: es vocabulario, lo cambia un administrador de vez en
 * cuando, no dentro de una sesión de trabajo en obra.
 */
export function useSistemas(soloActivos = false) {
  return useQuery({
    queryKey: QUERY_KEYS.sistemas(soloActivos),
    queryFn: () => fotos.verSistemas(soloActivos),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCrearFamiliaSistema() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (payload: { nombre: string; orden?: number }) =>
      fotos.crearFamiliaSistema(payload),
    onSuccess: (f) => {
      invalidar();
      toast.success(`Familia creada: ${f.nombre}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo crear la familia')),
  });
}

export function useEditarFamiliaSistema() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: { nombre?: string; orden?: number; activo?: boolean };
    }) => fotos.editarFamiliaSistema(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Familia actualizada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar la familia')),
  });
}

export function useEliminarFamiliaSistema() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (id: number) => fotos.eliminarFamiliaSistema(id),
    onSuccess: () => {
      invalidar();
      toast.success('Familia eliminada');
    },
    // El backend ya dice cuántos tipos lo impiden y ofrece retirarla.
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar la familia')),
  });
}

export function useCrearTipoSistema() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (payload: {
      familiaId: number;
      nombre: string;
      orden?: number;
    }) => fotos.crearTipoSistema(payload),
    onSuccess: (t) => {
      invalidar();
      toast.success(`Tipo creado: ${t.nombre}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo crear el tipo')),
  });
}

export function useEditarTipoSistema() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: {
        familiaId?: number;
        nombre?: string;
        orden?: number;
        activo?: boolean;
      };
    }) => fotos.editarTipoSistema(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Tipo actualizado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar el tipo')),
  });
}

export function useEliminarTipoSistema() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (id: number) => fotos.eliminarTipoSistema(id),
    onSuccess: () => {
      invalidar();
      toast.success('Tipo eliminado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar el tipo')),
  });
}

// ── El catálogo de actividades ──

/**
 * Las actividades del catálogo.
 *
 * Con `tipoSistemaId` devuelve LA PRESELECCIÓN de ese tipo, que es lo que el
 * formulario de alta marca por defecto. Sin él, el catálogo entero.
 */
export function useCatalogoActividades(
  opciones: {
    tipoSistemaId?: number | null;
    soloActivas?: boolean;
    habilitado?: boolean;
  } = {},
) {
  const {
    tipoSistemaId = null,
    soloActivas = false,
    habilitado = true,
  } = opciones;
  return useQuery({
    queryKey: QUERY_KEYS.catalogoActividades(tipoSistemaId, soloActivas),
    queryFn: () => fotos.verCatalogoActividades({ tipoSistemaId, soloActivas }),
    enabled: habilitado,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCrearDefinicionActividad() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (payload: {
      nombre: string;
      descripcion?: string | null;
      orden?: number;
      evidencia?: TipoEvidencia;
      tiposSistema?: number[];
    }) => fotos.crearDefinicionActividad(payload),
    onSuccess: (d) => {
      invalidar();
      toast.success(`Actividad añadida al catálogo: ${d.nombre}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo añadir la actividad')),
  });
}

export function useEditarDefinicionActividad() {
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
        orden?: number;
        activo?: boolean;
        evidencia?: TipoEvidencia;
        tiposSistema?: number[];
      };
    }) => fotos.editarDefinicionActividad(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Catálogo actualizado');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar el catálogo')),
  });
}

/**
 * Borrar del catálogo.
 *
 * ⚠️ El aviso dice explícitamente que las visitas no se tocan, porque es la
 * pregunta que se hace quien pulsa: la actividad de un ciclo copió el nombre
 * y vive por su cuenta.
 */
export function useEliminarDefinicionActividad() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (id: number) => fotos.eliminarDefinicionActividad(id),
    onSuccess: () => {
      invalidar();
      toast.success('Retirada del catálogo — las visitas ya hechas no cambian');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo retirar del catálogo')),
  });
}

/** Trae actividades del catálogo a un ciclo abierto. */
export function useAnadirDesdeCatalogo() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      cicloId,
      definiciones,
    }: {
      cicloId: number;
      definiciones: number[];
    }) => fotos.anadirDesdeCatalogo(cicloId, definiciones),
    onSuccess: (r) => {
      invalidar();
      // Las omitidas se nombran: si alguien marca cinco y entran dos, el
      // silencio parecería un fallo cuando en realidad ya estaban.
      toast.success(
        r.anadidas === 0
          ? 'Todas estaban ya en esta visita'
          : `${r.anadidas} actividad(es) añadida(s)` +
              (r.omitidas > 0 ? ` · ${r.omitidas} ya estaban` : ''),
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudieron añadir')),
  });
}
