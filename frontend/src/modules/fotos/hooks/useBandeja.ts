import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';
import type { DestinoFotos } from '@/modules/fotos/types';

// La bandeja de §18 y la captura rápida de §17. Un archivo por recurso, con
// sus lecturas y sus escrituras dentro.

/**
 * Lo que subí y todavía no he clasificado.
 *
 * No recibe id de usuario: la bandeja es SIEMPRE la de quien pregunta —una
 * foto sin clasificar no está en el árbol de carpetas, así que no hay
 * permiso que pueda dar acceso a la de otro—.
 */
export function useBandeja(habilitado = true) {
  return useQuery({
    queryKey: QUERY_KEYS.bandeja,
    queryFn: fotos.verBandeja,
    enabled: habilitado,
  });
}

/**
 * Subir a cualquiera de los cuatro destinos (§15-§18).
 *
 * Un solo hook y no uno por destino: es la misma operación con distinto
 * sitio de aterrizaje, y el service ya traduce el destino a su ruta.
 */
export function useSubirA() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      destino,
      archivos,
      descripcion,
    }: {
      destino: DestinoFotos;
      archivos: File[];
      descripcion: string;
    }) => fotos.subirA(destino, archivos, descripcion),
    onSuccess: (r, { destino }) => {
      invalidar();
      const donde =
        destino.tipo === 'bandeja' ? ' a la bandeja' : '';
      toast.success(
        r.fallidas.length === 0
          ? `${r.subidas} foto(s) subida(s)${donde}`
          : `${r.subidas} subida(s)${donde}, ${r.fallidas.length} con error`,
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudieron subir las fotos')),
  });
}

/** Clasificar por lotes (§18): «20 fotos → Equipo ABC → Tarea Inspección». */
export function useClasificar() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      fotoIds,
      destino,
    }: {
      fotoIds: number[];
      destino: DestinoFotos;
    }) => fotos.clasificarFotos(fotoIds, destino),
    onSuccess: (r) => {
      invalidar();
      toast.success(`${r.clasificadas} foto(s) clasificada(s)`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudieron clasificar')),
  });
}

export function useCrearAlbum() {
  const invalidar = useInvalidarFotos();
  return useMutation({
    mutationFn: ({
      carpetaId,
      payload,
    }: {
      carpetaId: number;
      payload: { nombre: string; descripcion?: string; fecha?: string };
    }) => fotos.crearAlbum(carpetaId, payload),
    onSuccess: (a) => {
      invalidar();
      toast.success(`Álbum creado: ${a.nombre ?? 'sin título'}`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo crear el álbum')),
  });
}
