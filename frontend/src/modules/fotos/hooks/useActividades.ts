import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';
import type { EstadoActividad, NuevaActividad } from '@/modules/fotos/types';

// Las actividades de §13: lecturas Y escrituras en un solo archivo, nombrado por
// el recurso. Un `…Mutations` aparte sería partir el mismo recurso en dos.

/**
 * Las actividades de UNA INTERVENCIÓN.
 *
 * ⚠️ Van por `intervencionId` y no por carpeta desde la Fase 1 del rediseño: el
 * mismo equipo repite «Revisar filtros» en cada intervención, así que la carpeta
 * no identifica una lista. `habilitado` sigue haciendo falta porque solo hay
 * intervenciones dentro de un EQUIPO.
 */
export function useActividades(
  intervencionId: number | null,
  opciones: {
    estado?: EstadoActividad | '';
    habilitado?: boolean;
    /** El portal del cliente pega a otras rutas y no filtra por estado. */
    portal?: boolean;
  } = {},
) {
  const { estado = '', habilitado = true, portal = false } = opciones;
  return useQuery({
    queryKey: portal
      ? QUERY_KEYS.portalActividades(intervencionId ?? 0)
      : QUERY_KEYS.actividades(intervencionId ?? 0, estado),
    queryFn: () =>
      portal
        ? fotos.verActividadesPortal(intervencionId!)
        : fotos.verActividades(intervencionId!, estado || undefined),
    enabled: habilitado && intervencionId !== null,
  });
}

export function useCrearActividad() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      intervencionId,
      payload,
    }: {
      intervencionId: number;
      payload: NuevaActividad;
    }) => fotos.crearActividad(intervencionId, payload),
    onSuccess: (t) => {
      invalidar();
      toast.success(`Actividad creada: ${t.titulo}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo crear la actividad')),
  });
}

export function useEditarActividad() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<NuevaActividad>;
    }) => fotos.editarActividad(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Actividad actualizada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar la actividad')),
  });
}

/**
 * El check rápido de §13.
 *
 * Hook propio y no `useEditarActividad` con `{estado}`: el aviso es distinto
 * —nombra quién y cuándo, que es lo que §13 pide registrar— y se dispara
 * desde una casilla, no desde el formulario.
 */
export function useMarcarActividad() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({ id, completada }: { id: number; completada: boolean }) =>
      fotos.marcarActividad(id, completada),
    onSuccess: (t) => {
      invalidar();
      toast.success(
        t.completadaPor
          ? `"${t.titulo}" completada por ${t.completadaPor.nombre}`
          : `"${t.titulo}" vuelve a estar pendiente`,
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo cambiar la actividad')),
  });
}

export function useEliminarActividad() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (id: number) => fotos.eliminarActividad(id),
    onSuccess: () => {
      invalidar();
      toast.success('Actividad eliminada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar la actividad')),
  });
}

// ⚠️ Aquí estaba `useAsignables`, que servía el desplegable de «responsable».
// Se fue con el detalle de la actividad: sin responsable no hay a quién
// asignar, y la ruta del backend se retiró entera en vez de dejarla
// respondiendo una lista que nadie consume.

/** Las fotos que documentan una actividad (§15). */
export function useFotosDeActividad(
  actividadId: number | null,
  habilitado = true,
  portal = false,
) {
  return useQuery({
    queryKey: portal
      ? QUERY_KEYS.portalFotosDeActividad(actividadId ?? 0)
      : QUERY_KEYS.fotosDeActividad(actividadId ?? 0),
    queryFn: () =>
      portal
        ? fotos.verFotosDeActividadPortal(actividadId!)
        : fotos.verFotosDeActividad(actividadId!),
    enabled: habilitado && actividadId !== null,
  });
}
