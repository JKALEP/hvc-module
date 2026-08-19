import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  listarDocumentos,
  obtenerDocumento,
  crearDocumento,
  editarDocumento,
  eliminarDocumento,
  ordenDesdeCotizacion,
  exportarDocumento,
} from '@/modules/equipos/services/equiposService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type {
  TipoDocumento,
  GuardarDocumentoPayload,
} from '@/modules/equipos/types';

/**
 * Cotizaciones y órdenes de compra.
 *
 * Un solo archivo para los dos: el `tipo` decide la ruta y las claves de
 * caché. Duplicarlo habría dado dos hooks idénticos salvo por una
 * cadena.
 */
function useInvalidar(organizacionId: number) {
  const qc = useQueryClient();
  return (tipo?: TipoDocumento, id?: number) => {
    // Se invalidan LOS DOS tipos: crear una orden desde una cotización
    // cambia el contador de esa cotización.
    void qc.invalidateQueries({ queryKey: ['documentos', organizacionId] });
    if (tipo && id !== undefined)
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.documento(tipo, id) });
    // La bitácora del equipo y de la incidencia recogen el movimiento.
    void qc.invalidateQueries({ queryKey: ['historial-equipo'] });
    void qc.invalidateQueries({ queryKey: ['historial-incidencia'] });
  };
}

export function useDocumentos(
  organizacionId: number | null,
  tipo: TipoDocumento,
  filtros: { estado?: string; q?: string } = {},
) {
  return useQuery({
    queryKey: [
      'documentos',
      organizacionId ?? 0,
      tipo,
      filtros.estado ?? '',
      filtros.q ?? '',
    ],
    queryFn: () => listarDocumentos(organizacionId as number, tipo, filtros),
    enabled: organizacionId !== null,
  });
}

export function useDocumento(tipo: TipoDocumento, id: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.documento(tipo, id ?? 0),
    queryFn: () => obtenerDocumento(tipo, id as number),
    enabled: id !== null,
  });
}

export function useCrearDocumento(organizacionId: number, tipo: TipoDocumento) {
  const invalidar = useInvalidar(organizacionId);
  return useMutation({
    mutationFn: (payload: GuardarDocumentoPayload) =>
      crearDocumento(tipo, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Documento creado');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo crear')),
  });
}

/** Sin toast: se guarda al salir de cada celda y llenaría la pantalla. */
export function useEditarDocumento(
  organizacionId: number,
  tipo: TipoDocumento,
) {
  const invalidar = useInvalidar(organizacionId);
  return useMutation({
    mutationFn: (vars: {
      id: number;
      cambios: Partial<GuardarDocumentoPayload> & { estado?: string };
    }) => editarDocumento(tipo, vars.id, vars.cambios),
    onSuccess: (_r, vars) => invalidar(tipo, vars.id),
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo guardar')),
  });
}

export function useEliminarDocumento(
  organizacionId: number,
  tipo: TipoDocumento,
) {
  const invalidar = useInvalidar(organizacionId);
  return useMutation({
    mutationFn: (id: number) => eliminarDocumento(tipo, id),
    onSuccess: (r) => {
      invalidar();
      toast.success(`${r.codigo} eliminada`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo eliminar')),
  });
}

export function useOrdenDesdeCotizacion(organizacionId: number) {
  const invalidar = useInvalidar(organizacionId);
  return useMutation({
    mutationFn: (cotizacionId: number) => ordenDesdeCotizacion(cotizacionId),
    onSuccess: () => {
      invalidar();
      toast.success('Orden de compra creada desde la cotización');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo crear la orden')),
  });
}

/** Genera y descarga. Nada se guarda en el sistema. */
export function useExportar() {
  return useMutation({
    mutationFn: (vars: {
      tipo: TipoDocumento;
      id: number;
      formato: 'excel' | 'pdf';
    }) => exportarDocumento(vars.tipo, vars.id, vars.formato),
    onSuccess: (nombre) => toast.success(`Descargado: ${nombre}`),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'No se pudo generar'),
  });
}
