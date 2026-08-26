import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';
import type {
  DecisionImportacion,
  NodoPlantillaNuevo,
} from '@/modules/fotos/types';

// Auditoría (§23), plantillas (§20) e importación (§19). Un solo archivo:
// son las tres piezas de ADMINISTRAR el módulo, y ninguna es un recurso que
// se navegue.

export function useAuditoria(filtros: {
  usuarioId?: number | null;
  accion?: string;
  desde?: string;
  hasta?: string;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.auditoriaFotos(filtros),
    queryFn: () => fotos.verAuditoria(filtros),
  });
}

export function usePlantillas(soloActivas = false) {
  return useQuery({
    queryKey: QUERY_KEYS.plantillasFotos(soloActivas),
    queryFn: () => fotos.verPlantillas(soloActivas),
  });
}

export function usePlantilla(id: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.plantillaFotos(id ?? 0),
    queryFn: () => fotos.verPlantilla(id!),
    enabled: id !== null,
  });
}

export function useGuardarPlantilla() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      /** null = crear. Un solo hook para las dos: es el mismo formulario. */
      id: number | null;
      payload: {
        nombre: string;
        descripcion?: string | null;
        activa?: boolean;
        nodos?: NodoPlantillaNuevo[];
      };
    }) =>
      id === null
        ? fotos.crearPlantilla(payload)
        : fotos.editarPlantilla(id, payload),
    onSuccess: (p, { id }) => {
      invalidar();
      toast.success(
        id === null ? `Plantilla creada: ${p.nombre}` : 'Plantilla actualizada',
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo guardar la plantilla')),
  });
}

export function useEliminarPlantilla() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: (id: number) => fotos.eliminarPlantilla(id),
    onSuccess: () => {
      invalidar();
      toast.success('Plantilla eliminada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo eliminar la plantilla')),
  });
}

/**
 * «Crear desde plantilla» (§20).
 *
 * El aviso de las actividades omitidas se muestra como advertencia y no como
 * error: la operación SÍ ocurrió, pero parte de la plantilla no cabía —y
 * callarlo dejaría a alguien buscando cuatro actividades que nunca se crearon—.
 */
export function useAplicarPlantilla() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      plantillaId,
      carpetaId,
    }: {
      plantillaId: number;
      carpetaId: number;
    }) => fotos.aplicarPlantilla(plantillaId, carpetaId),
    onSuccess: (r) => {
      invalidar();
      toast.success(
        `"${r.plantilla}": ${r.carpetas} carpeta(s), ${r.actividades} actividad(s)`,
      );
      if (r.aviso) toast.warning(r.aviso);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo aplicar la plantilla')),
  });
}

export function usePreviaImportacion() {
  return useMutation({
    mutationFn: ({ carpetaId, archivo }: { carpetaId: number; archivo: File }) =>
      fotos.previaImportacion(carpetaId, archivo),
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo leer el archivo')),
  });
}

export function useConfirmarImportacion() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      carpetaId,
      archivo,
      decisiones,
    }: {
      carpetaId: number;
      archivo: File;
      decisiones: Record<number, DecisionImportacion>;
    }) => fotos.confirmarImportacion(carpetaId, archivo, decisiones),
    onSuccess: (r) => {
      invalidar();
      toast.success(
        `Importado: ${r.creado.carpetas} carpeta(s), ${r.creado.actividades} actividad(s)`,
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo importar')),
  });
}
