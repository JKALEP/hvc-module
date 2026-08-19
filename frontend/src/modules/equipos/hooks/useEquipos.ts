import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  listarOrganizaciones,
  crearOrganizacion,
  editarOrganizacion,
  eliminarOrganizacion,
  obtenerArbol,
  crearNodo,
  renombrarNodo,
  eliminarNodo,
} from '@/modules/equipos/services/equiposService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';

/**
 * Organizaciones y su árbol de ubicaciones.
 *
 * Las fases siguientes —campos, equipos, incidencias— traerán sus
 * propios archivos de hooks; éste se queda con la estructura, que es lo
 * que cambia poco y lo consultan todas las demás pantallas.
 */

export function useOrganizaciones() {
  return useQuery({
    queryKey: QUERY_KEYS.organizaciones,
    queryFn: listarOrganizaciones,
  });
}

export function useCrearOrganizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nombre: string) => crearOrganizacion(nombre),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.organizaciones });
      toast.success('Organización creada');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo crear')),
  });
}

export function useEditarOrganizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      cambios: { nombre?: string; activo?: boolean };
    }) => editarOrganizacion(vars.id, vars.cambios),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.organizaciones });
      toast.success('Organización actualizada');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo guardar')),
  });
}

export function useEliminarOrganizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => eliminarOrganizacion(id),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.organizaciones });
      toast.success(`"${r.nombre}" eliminada`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo eliminar')),
  });
}

// ── Estructura ──

export function useArbol(organizacionId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.estructuraEquipos(organizacionId ?? 0),
    queryFn: () => obtenerArbol(organizacionId as number),
    enabled: organizacionId !== null,
  });
}

/** Cualquier cambio del árbol lo invalida entero: es una sola consulta. */
function useInvalidarArbol(organizacionId: number) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({
      queryKey: QUERY_KEYS.estructuraEquipos(organizacionId),
    });
    // El contador de ubicaciones de la organización también cambió.
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.organizaciones });
  };
}

export function useCrearNodo(organizacionId: number) {
  const invalidar = useInvalidarArbol(organizacionId);
  return useMutation({
    mutationFn: (vars: { nombre: string; padreId: number | null }) =>
      crearNodo({ organizacionId, ...vars }),
    onSuccess: () => {
      invalidar();
      toast.success('Ubicación creada');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo crear')),
  });
}

export function useRenombrarNodo(organizacionId: number) {
  const invalidar = useInvalidarArbol(organizacionId);
  return useMutation({
    mutationFn: (vars: { id: number; nombre: string }) =>
      renombrarNodo(vars.id, vars.nombre),
    onSuccess: () => {
      invalidar();
      toast.success('Ubicación renombrada');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo renombrar')),
  });
}

export function useEliminarNodo(organizacionId: number) {
  const invalidar = useInvalidarArbol(organizacionId);
  return useMutation({
    mutationFn: (id: number) => eliminarNodo(id),
    onSuccess: (r) => {
      invalidar();
      toast.success(`"${r.nombre}" eliminada`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo eliminar')),
  });
}
