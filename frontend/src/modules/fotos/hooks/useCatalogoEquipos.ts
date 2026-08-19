import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';

/**
 * El catálogo de equipos, visto desde Fotos (§12).
 *
 * Un archivo de hooks por recurso, con sus lecturas Y su escritura dentro:
 * el «recurso» aquí es el catálogo, aunque no sea de este módulo. Fotos solo
 * lo lee —y lo escribe por el atajo—, nunca lo administra.
 */

export function useOrganizacionesDeCatalogo(habilitado = true) {
  return useQuery({
    queryKey: QUERY_KEYS.catalogoOrganizaciones,
    queryFn: fotos.organizacionesDeCatalogo,
    enabled: habilitado,
  });
}

/**
 * Busca equipos dentro de una organización.
 *
 * `q` entra en la query key porque buscar es pedir otra cosa, no filtrar lo
 * ya pedido. Deshabilitado sin organización: no hay catálogo que consultar
 * hasta que se elige una.
 */
export function useEquiposDeCatalogo(
  organizacionId: number | null,
  q: string,
) {
  return useQuery({
    queryKey: QUERY_KEYS.catalogoEquipos(organizacionId ?? 0, q),
    queryFn: () => fotos.buscarEquipos(organizacionId as number, q),
    enabled: organizacionId !== null,
    // Al teclear en el buscador se conserva lo anterior: sin esto la tabla
    // parpadea en blanco entre pulsaciones.
    placeholderData: (previo) => previo,
  });
}

/**
 * Las ubicaciones de la organización, para el atajo de registro.
 *
 * Solo se pide cuando el atajo está a la vista: quien únicamente elige un
 * equipo existente no necesita el árbol de ubicaciones.
 */
export function useUbicacionesDeCatalogo(organizacionId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.catalogoUbicaciones(organizacionId ?? 0),
    queryFn: () => fotos.ubicacionesDeCatalogo(organizacionId as number),
    enabled: organizacionId !== null,
  });
}

/**
 * El atajo: registra un equipo sin salir de Fotos.
 *
 * Invalida la búsqueda del catálogo para que el equipo recién creado
 * aparezca en la lista y se pueda elegir sin recargar.
 */
export function useCrearEquipoDesdeFotos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fotos.crearEquipoDesdeFotos,
    onSuccess: () => {
      // Sin esto el equipo recién creado no sale en la lista de la que hay
      // que elegirlo, y el usuario lo registra dos veces.
      void queryClient.invalidateQueries({
        queryKey: ['fotos', 'catalogo-equipos'],
      });
      toast.success('Equipo registrado en el catálogo');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo registrar el equipo')),
  });
}
