import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  listarSupervisores,
  listarEmpresas,
  buscarTrabajadores,
} from '@/services/personalService';
import { listarProyectos } from '@/services/proyectoService';
import { QUERY_KEYS } from '@/lib/constants';

// Catálogos del módulo Personal. Cambian poco, así que se cachean más
// tiempo que el default de 10s definido en main.tsx.
const STALE_CATALOGO = 60_000;

/** Proyectos con su último avance vigente. */
export function useProyectos() {
  return useQuery({
    queryKey: QUERY_KEYS.proyectos,
    queryFn: listarProyectos,
    staleTime: STALE_CATALOGO,
  });
}

/** Supervisores activos. */
export function useSupervisores() {
  return useQuery({
    queryKey: QUERY_KEYS.supervisores,
    queryFn: listarSupervisores,
    staleTime: STALE_CATALOGO,
  });
}

/** Empresas contratistas activas. */
export function useEmpresas() {
  return useQuery({
    queryKey: QUERY_KEYS.empresas,
    queryFn: listarEmpresas,
    staleTime: STALE_CATALOGO,
  });
}

/**
 * Autocompletado de trabajadores. `q` ya debe venir con debounce.
 * Solo consulta cuando hay término o empresa: sin filtro no tiene
 * sentido traer los primeros 50 de la nómina completa.
 */
export function useTrabajadores(q: string, empresaId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.trabajadores(q, empresaId),
    queryFn: () => buscarTrabajadores(q, empresaId),
    enabled: q.trim().length > 0 || empresaId !== null,
    placeholderData: keepPreviousData, // evita parpadeo mientras se teclea
  });
}
