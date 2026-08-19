import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  compartirRequerimiento,
  descartarCotizacion,
  editarCotizacion,
  evaluarRequerimiento,
  listarCotizaciones,
  listarEvaluaciones,
  listarSolicitudes,
  obtenerComparacion,
  recomendarCotizacion,
  reevaluarRequerimiento,
  registrarCotizacion,
} from '@/modules/costos/services/cotizacionService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type {
  GuardarCotizacionPayload,
  RecomendarPayload,
} from '@/modules/costos/types';

/**
 * Todo el trabajo del Gestor sobre UN requerimiento (§30-39): lecturas
 * Y escrituras.
 *
 * Un archivo por recurso, y aquí el recurso es «la cotización de este
 * requerimiento»: pedirla, registrarla, compararla y recomendarla son
 * cuatro momentos de lo mismo y todos ensucian las mismas cachés.
 * Partirlo en cuatro obligaría a que cada uno invalidara los otros tres.
 */

/**
 * Lo que cualquier movimiento del Gestor deja obsoleto.
 *
 * Se invalida SIEMPRE el requerimiento además de lo tocado: casi todas
 * estas acciones mueven el estado —y con él las `acciones` que la
 * pantalla usa para decidir qué botones pintar—. Refrescar solo la
 * lista de cotizaciones dejaría la pantalla ofreciendo el paso que
 * acaba de darse.
 */
function useInvalidar() {
  const qc = useQueryClient();
  return (requerimientoId: number) => {
    for (const key of [
      QUERY_KEYS.requerimiento(requerimientoId),
      QUERY_KEYS.historialRequerimiento(requerimientoId),
      QUERY_KEYS.solicitudes(requerimientoId),
      QUERY_KEYS.cotizaciones(requerimientoId),
      QUERY_KEYS.comparacion(requerimientoId),
      QUERY_KEYS.evaluaciones(requerimientoId),
    ])
      void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['requerimientos'] });
  };
}

const habilitado = (id: number | undefined) =>
  typeof id === 'number' && !Number.isNaN(id);

// ── Lecturas ──

export function useSolicitudes(requerimientoId: number | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.solicitudes(requerimientoId ?? 0),
    queryFn: () => listarSolicitudes(requerimientoId as number),
    enabled: habilitado(requerimientoId),
  });
}

export function useCotizaciones(requerimientoId: number | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.cotizaciones(requerimientoId ?? 0),
    queryFn: () => listarCotizaciones(requerimientoId as number),
    enabled: habilitado(requerimientoId),
  });
}

/**
 * La comparación de §37.
 *
 * `activo` la apaga mientras no haya nada que comparar: pedirla con
 * cero cotizaciones devuelve una respuesta vacía correcta, pero es una
 * llamada que ya sabemos que no dice nada.
 */
export function useComparacion(
  requerimientoId: number | undefined,
  activo: boolean,
) {
  return useQuery({
    queryKey: QUERY_KEYS.comparacion(requerimientoId ?? 0),
    queryFn: () => obtenerComparacion(requerimientoId as number),
    enabled: activo && habilitado(requerimientoId),
  });
}

/** Las recomendaciones, la de ronda más alta primero: esa es la vigente. */
export function useEvaluaciones(requerimientoId: number | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.evaluaciones(requerimientoId ?? 0),
    queryFn: () => listarEvaluaciones(requerimientoId as number),
    enabled: habilitado(requerimientoId),
  });
}

// ── Escrituras: pedir precio (§30-33) ──

/**
 * Pide cotización a los proveedores elegidos.
 *
 * El aviso de que el correo NO está configurado sale de la respuesta y
 * no de una suposición de la pantalla: en desarrollo el enlace se
 * imprime en la consola del backend y nadie recibe nada. Callarlo haría
 * que el Gestor esperara respuestas que no van a llegar.
 */
export function useCompartir() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      requerimientoId,
      proveedorIds,
    }: {
      requerimientoId: number;
      proveedorIds: number[];
    }) => compartirRequerimiento(requerimientoId, proveedorIds),
    onSuccess: (resultado, { requerimientoId }) => {
      invalidar(requerimientoId);
      const fallidos = resultado.solicitudes.filter((s) => !s.enviado);

      if (!resultado.correoConfigurado)
        toast.warning(
          `Solicitud registrada para ${resultado.solicitudes.length} proveedor(es)`,
          {
            description:
              'El correo está en modo desarrollo: no salió ningún mensaje. ' +
              'El contenido se imprimió en la consola del backend.',
            duration: 9000,
          },
        );
      else if (fallidos.length > 0)
        toast.warning(`No se pudo enviar a ${fallidos.length} proveedor(es)`, {
          description: `Falló con: ${fallidos.map((f) => f.proveedor).join(', ')}. Queda registrado el intento.`,
          duration: 9000,
        });
      else
        toast.success(
          `Se pidió cotización a ${resultado.solicitudes.length} proveedor(es)`,
        );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo pedir la cotización')),
  });
}

// ── Escrituras: las cotizaciones recibidas (§34-36) ──

export function useRegistrarCotizacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      requerimientoId,
      payload,
    }: {
      requerimientoId: number;
      payload: GuardarCotizacionPayload;
    }) => registrarCotizacion(requerimientoId, payload),
    onSuccess: (cotizacion, { requerimientoId }) => {
      invalidar(requerimientoId);
      toast.success(`Cotización de ${cotizacion.proveedor.razonSocial} registrada`);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo registrar la cotización')),
  });
}

/**
 * Corrige una cotización mal tecleada.
 *
 * Guardar apaga la marca de §54 en el backend: volver a registrar lo
 * que el proveedor respondió ES la respuesta a «esto ya no cotiza lo
 * que se pide». Por eso se avisa cuando la que se acaba de arreglar
 * venía marcada.
 */
export function useEditarCotizacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      cotizacionId,
      payload,
    }: {
      requerimientoId: number;
      cotizacionId: number;
      veniaARevisar?: boolean;
      payload: Omit<GuardarCotizacionPayload, 'proveedorId'>;
    }) => editarCotizacion(cotizacionId, payload),
    onSuccess: (_cotizacion, { requerimientoId, veniaARevisar }) => {
      invalidar(requerimientoId);
      if (veniaARevisar)
        toast.success('Cotización actualizada', {
          description: 'Ya no está pendiente de revisar: vuelve a competir.',
        });
      else toast.success('Cotización actualizada');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo actualizar la cotización')),
  });
}

export function useDescartarCotizacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      cotizacionId,
      motivo,
    }: {
      requerimientoId: number;
      cotizacionId: number;
      motivo: string;
    }) => descartarCotizacion(cotizacionId, motivo),
    onSuccess: (cotizacion, { requerimientoId }) => {
      invalidar(requerimientoId);
      toast.success(`Se descartó la cotización de ${cotizacion.proveedor.razonSocial}`, {
        description: 'Deja de competir, pero sigue visible para el aprobador.',
      });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo descartar')),
  });
}

// ── Escrituras: evaluar y recomendar (§37-39) ──

/** §37: marca que el Gestor empezó a comparar. */
export function useEvaluar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (requerimientoId: number) =>
      evaluarRequerimiento(requerimientoId),
    onSuccess: (_req, requerimientoId) => {
      invalidar(requerimientoId);
      toast.success('En evaluación');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo pasar a evaluación')),
  });
}

/** §44: tras un rechazo, se vuelve a evaluar sin borrar la vuelta anterior. */
export function useReevaluar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (requerimientoId: number) =>
      reevaluarRequerimiento(requerimientoId),
    onSuccess: (_req, requerimientoId) => {
      invalidar(requerimientoId);
      toast.success('Vuelta nueva abierta', {
        description: 'La recomendación anterior y su rechazo siguen en el expediente.',
      });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo volver a evaluar')),
  });
}

/**
 * Recomienda una cotización (§38-39).
 *
 * `corrige` solo cambia el texto del aviso: si es una corrección o una
 * vuelta nueva lo decide el BACKEND mirando si la evaluación vigente ya
 * tiene una aprobación. La pantalla no lo deduce, lo refleja.
 */
export function useRecomendar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      requerimientoId,
      payload,
    }: {
      requerimientoId: number;
      corrige?: boolean;
      payload: RecomendarPayload;
    }) => recomendarCotizacion(requerimientoId, payload),
    onSuccess: (_req, { requerimientoId, corrige }) => {
      invalidar(requerimientoId);
      toast.success(
        corrige ? 'Recomendación corregida' : 'Recomendación enviada',
        {
          description: corrige
            ? 'El aprobador todavía no se había pronunciado: se sustituyó la anterior.'
            : 'El requerimiento pasa a la mesa del aprobador.',
        },
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo recomendar')),
  });
}
