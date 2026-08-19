import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  listarCampos,
  crearCampo,
  editarCampo,
  eliminarCampo,
  agregarOpcion,
  eliminarOpcion,
  listarEquipos,
  obtenerEquipo,
  crearEquipo,
  editarEquipo,
  eliminarEquipo,
  historialEquipo,
} from '@/modules/equipos/services/equiposService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type { TipoCampo, ValoresEquipo } from '@/modules/equipos/types';

/**
 * Campos dinámicos e inventario.
 *
 * Aparte de `useEquipos`, que lleva organizaciones y estructura: aquello
 * cambia poco y esto se invalida en cada guardado.
 */

/** Tocar un campo cambia las columnas de la tabla, así que la invalida. */
function useInvalidarCampos(organizacionId: number) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({
      queryKey: QUERY_KEYS.camposEquipos(organizacionId),
    });
    void qc.invalidateQueries({ queryKey: ['inventario', organizacionId] });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.organizaciones });
  };
}

export function useCampos(organizacionId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.camposEquipos(organizacionId ?? 0),
    queryFn: () => listarCampos(organizacionId as number),
    enabled: organizacionId !== null,
  });
}

export function useCrearCampo(organizacionId: number) {
  const invalidar = useInvalidarCampos(organizacionId);
  return useMutation({
    mutationFn: (vars: {
      nombre: string;
      tipo: TipoCampo;
      obligatorio: boolean;
      opciones?: string[];
    }) => crearCampo({ organizacionId, ...vars }),
    onSuccess: () => {
      invalidar();
      toast.success('Campo creado');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo crear el campo')),
  });
}

export function useEditarCampo(organizacionId: number) {
  const invalidar = useInvalidarCampos(organizacionId);
  return useMutation({
    mutationFn: (vars: {
      id: number;
      cambios: {
        nombre?: string;
        obligatorio?: boolean;
        activo?: boolean;
        orden?: number;
      };
    }) => editarCampo(vars.id, vars.cambios),
    onSuccess: () => invalidar(),
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo guardar')),
  });
}

export function useEliminarCampo(organizacionId: number) {
  const invalidar = useInvalidarCampos(organizacionId);
  return useMutation({
    mutationFn: (id: number) => eliminarCampo(id),
    onSuccess: (r) => {
      invalidar();
      toast.success(`"${r.nombre}" eliminado`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo eliminar')),
  });
}

export function useAgregarOpcion(organizacionId: number) {
  const invalidar = useInvalidarCampos(organizacionId);
  return useMutation({
    mutationFn: (vars: { campoId: number; etiqueta: string }) =>
      agregarOpcion(vars.campoId, vars.etiqueta),
    onSuccess: () => invalidar(),
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo agregar')),
  });
}

export function useEliminarOpcion(organizacionId: number) {
  const invalidar = useInvalidarCampos(organizacionId);
  return useMutation({
    mutationFn: (id: number) => eliminarOpcion(id),
    onSuccess: () => invalidar(),
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo eliminar')),
  });
}

// ── Inventario ──

export function useEquipos(
  organizacionId: number | null,
  filtros: {
    nodoId?: number | null;
    q?: string;
    campos?: Record<string, string>;
  },
) {
  return useQuery({
    queryKey: [
      'inventario',
      organizacionId ?? 0,
      filtros.nodoId ?? null,
      filtros.q ?? '',
      JSON.stringify(filtros.campos ?? {}),
    ],
    queryFn: () => listarEquipos(organizacionId as number, filtros),
    enabled: organizacionId !== null,
  });
}

export function useEquipo(id: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.equipo(id ?? 0),
    queryFn: () => obtenerEquipo(id as number),
    enabled: id !== null,
  });
}

export function useHistorialEquipo(id: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.historialEquipo(id ?? 0),
    queryFn: () => historialEquipo(id as number),
    enabled: id !== null,
  });
}

/** Guardar un equipo invalida la tabla, su ficha y su bitácora. */
function useInvalidarEquipo(organizacionId: number) {
  const qc = useQueryClient();
  return (equipoId?: number) => {
    void qc.invalidateQueries({ queryKey: ['inventario', organizacionId] });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.organizaciones });
    void qc.invalidateQueries({
      queryKey: QUERY_KEYS.estructuraEquipos(organizacionId),
    });
    if (equipoId !== undefined) {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.equipo(equipoId) });
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.historialEquipo(equipoId),
      });
    }
  };
}

export function useCrearEquipo(organizacionId: number) {
  const invalidar = useInvalidarEquipo(organizacionId);
  return useMutation({
    mutationFn: (vars: {
      nodoId: number;
      codigoInterno: string | null;
      valores: ValoresEquipo;
    }) => crearEquipo({ organizacionId, ...vars }),
    onSuccess: () => {
      invalidar();
      toast.success('Equipo registrado');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo registrar')),
  });
}

export function useEditarEquipo(organizacionId: number) {
  const invalidar = useInvalidarEquipo(organizacionId);
  return useMutation({
    mutationFn: (vars: {
      id: number;
      cambios: {
        nodoId?: number;
        codigoInterno?: string | null;
        valores?: ValoresEquipo;
      };
    }) => editarEquipo(vars.id, vars.cambios),
    onSuccess: (_r, vars) => {
      invalidar(vars.id);
      toast.success('Equipo actualizado');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo guardar')),
  });
}

export function useEliminarEquipo(organizacionId: number) {
  const invalidar = useInvalidarEquipo(organizacionId);
  return useMutation({
    mutationFn: (id: number) => eliminarEquipo(id),
    onSuccess: (r) => {
      invalidar();
      toast.success(
        r.codigoInterno
          ? `Equipo ${r.codigoInterno} eliminado`
          : 'Equipo eliminado',
      );
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo eliminar')),
  });
}
