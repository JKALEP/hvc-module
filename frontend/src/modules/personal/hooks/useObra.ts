import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  navegar,
  listarCarpetas,
  crearCarpeta,
  renombrarCarpeta,
  eliminarCarpeta,
  crearProyecto,
  obtenerProyecto,
  editarProyecto,
  eliminarProyecto,
  empresasPara,
  personasPara,
} from '@/modules/personal/services/obraService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type { GuardarProyectoPayload } from '@/modules/personal/types';

/**
 * Explorador, carpetas y proyectos.
 *
 * Las jornadas y la analítica van aparte (`useJornadas`, `useAnaliticaObra`)
 * porque se invalidan con muchísima más frecuencia: editar una celda de
 * la grilla no debería recargar el árbol de carpetas.
 */

/** Todo lo que deja obsoleto crear, mover o borrar algo del explorador. */
function useInvalidarExplorador() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['obra-navegacion'] });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.obraCarpetas });
  };
}

// ── Explorador ──

export function useNavegacion(carpetaId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.obraNavegacion(carpetaId),
    queryFn: () => navegar(carpetaId),
  });
}

/** El árbol plano, para el selector de carpeta de un proyecto. */
export function useCarpetas() {
  return useQuery({
    queryKey: QUERY_KEYS.obraCarpetas,
    queryFn: listarCarpetas,
  });
}

export function useCrearCarpeta() {
  const invalidar = useInvalidarExplorador();
  return useMutation({
    mutationFn: (vars: { nombre: string; parentId: number | null }) =>
      crearCarpeta(vars),
    onSuccess: () => {
      invalidar();
      toast.success('Carpeta creada');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo crear la carpeta')),
  });
}

export function useRenombrarCarpeta() {
  const invalidar = useInvalidarExplorador();
  return useMutation({
    mutationFn: (vars: { id: number; nombre: string }) =>
      renombrarCarpeta(vars.id, vars.nombre),
    onSuccess: () => {
      invalidar();
      toast.success('Carpeta renombrada');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo renombrar')),
  });
}

export function useEliminarCarpeta() {
  const invalidar = useInvalidarExplorador();
  return useMutation({
    mutationFn: (id: number) => eliminarCarpeta(id),
    onSuccess: (r) => {
      invalidar();
      toast.success(`"${r.nombre}" eliminada`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo eliminar')),
  });
}

// ── Proyectos ──

export function useProyecto(id: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.obraProyecto(id ?? 0),
    queryFn: () => obtenerProyecto(id as number),
    enabled: id !== null,
  });
}

export function useCrearProyecto() {
  const invalidar = useInvalidarExplorador();
  return useMutation({
    mutationFn: (payload: GuardarProyectoPayload) => crearProyecto(payload),
    onSuccess: () => {
      invalidar();
      toast.success('Proyecto creado');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo crear el proyecto')),
  });
}

export function useEditarProyecto(id: number) {
  const qc = useQueryClient();
  const invalidar = useInvalidarExplorador();
  return useMutation({
    mutationFn: (cambios: Partial<GuardarProyectoPayload>) =>
      editarProyecto(id, cambios),
    onSuccess: () => {
      invalidar();
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.obraProyecto(id) });
      toast.success('Proyecto actualizado');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo guardar')),
  });
}

export function useEliminarProyecto() {
  const invalidar = useInvalidarExplorador();
  return useMutation({
    mutationFn: (id: number) => eliminarProyecto(id),
    onSuccess: (r) => {
      invalidar();
      toast.success(
        r.jornadasEliminadas > 0
          ? `"${r.nombre}" eliminado con ${r.jornadasEliminadas} jornada(s)`
          : `"${r.nombre}" eliminado`,
      );
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo eliminar')),
  });
}

// ── Catálogos de personal ──
// Van con una FECHA: el backend resuelve el periodo que la cubre.

export function useEmpresasPara(fecha: string, habilitado = true) {
  return useQuery({
    queryKey: QUERY_KEYS.obraPersonalPara(fecha, 'empresas', ''),
    queryFn: () => empresasPara(fecha),
    enabled: habilitado && Boolean(fecha),
  });
}

export function usePersonasPara(
  fecha: string,
  tipo: 'supervisores' | 'contratistas',
  q = '',
  habilitado = true,
) {
  return useQuery({
    queryKey: QUERY_KEYS.obraPersonalPara(fecha, tipo, q),
    queryFn: () => personasPara(fecha, tipo, q || undefined),
    enabled: habilitado && Boolean(fecha),
    // La lista de un periodo no cambia mientras se escribe una jornada.
    staleTime: 5 * 60 * 1000,
  });
}
