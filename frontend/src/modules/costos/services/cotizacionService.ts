import { api } from '@/shared/services/api';
import type {
  Comparacion,
  CotizacionProveedor,
  EvaluacionCotizacion,
  GuardarCotizacionPayload,
  RecomendarPayload,
  Requerimiento,
  ResultadoCompartir,
  SolicitudCotizacion,
} from '@/modules/costos/types';

// El trabajo del Gestor de cotizaciones (§30-39).
//
// Cubre exactamente lo que expone `CotizacionController` en el backend:
// pedir precio, registrar lo que llegó, comparar y recomendar. Se agrupa
// igual que allí —cuatro services detrás de un controller— porque son
// cuatro momentos de UNA cosa: la cotización de un requerimiento.
//
// Fuera de aquí quedan los proveedores (`proveedorService`, viven sin
// requerimiento) y el requerimiento mismo (`costosService`).

const RAIZ = '/costos';

// ── Compartir con proveedores (§30-33) ──

export async function listarSolicitudes(
  requerimientoId: number,
): Promise<SolicitudCotizacion[]> {
  const { data } = await api.get<SolicitudCotizacion[]>(
    `${RAIZ}/requerimiento/${requerimientoId}/solicitud`,
  );
  return data;
}

/**
 * Pide cotización a los proveedores elegidos (§30).
 *
 * Todo o nada: el backend comprueba que existan, estén activos y tengan
 * correo ANTES de mandar nada, para que no haya media tanda enviada.
 */
export async function compartirRequerimiento(
  requerimientoId: number,
  proveedorIds: number[],
): Promise<ResultadoCompartir> {
  const { data } = await api.post<ResultadoCompartir>(
    `${RAIZ}/requerimiento/${requerimientoId}/solicitud`,
    { proveedorIds },
  );
  return data;
}

// ── Cotizaciones recibidas (§34-36) ──

export async function listarCotizaciones(
  requerimientoId: number,
): Promise<CotizacionProveedor[]> {
  const { data } = await api.get<CotizacionProveedor[]>(
    `${RAIZ}/requerimiento/${requerimientoId}/cotizacion`,
  );
  return data;
}

export async function registrarCotizacion(
  requerimientoId: number,
  payload: GuardarCotizacionPayload,
): Promise<CotizacionProveedor> {
  const { data } = await api.post<CotizacionProveedor>(
    `${RAIZ}/requerimiento/${requerimientoId}/cotizacion`,
    payload,
  );
  return data;
}

/** Al editar no viaja el proveedor: cambiarlo sería otra cotización. */
export async function editarCotizacion(
  cotizacionId: number,
  payload: Omit<GuardarCotizacionPayload, 'proveedorId'>,
): Promise<CotizacionProveedor> {
  const { data } = await api.patch<CotizacionProveedor>(
    `${RAIZ}/cotizacion/${cotizacionId}`,
    payload,
  );
  return data;
}

/** La saca de la comparación SIN borrarla: el Aprobador sigue viéndola (§40). */
export async function descartarCotizacion(
  cotizacionId: number,
  motivo: string,
): Promise<CotizacionProveedor> {
  const { data } = await api.post<CotizacionProveedor>(
    `${RAIZ}/cotizacion/${cotizacionId}/descartar`,
    { motivo },
  );
  return data;
}

// ── Comparar (§37) ──

export async function obtenerComparacion(
  requerimientoId: number,
): Promise<Comparacion> {
  const { data } = await api.get<Comparacion>(
    `${RAIZ}/requerimiento/${requerimientoId}/comparacion`,
  );
  return data;
}

// ── Evaluar y recomendar (§38-39) ──

export async function listarEvaluaciones(
  requerimientoId: number,
): Promise<EvaluacionCotizacion[]> {
  const { data } = await api.get<EvaluacionCotizacion[]>(
    `${RAIZ}/requerimiento/${requerimientoId}/evaluacion`,
  );
  return data;
}

/** §37: marcar que se está comparando. Devuelve el requerimiento movido. */
export async function evaluarRequerimiento(
  requerimientoId: number,
): Promise<Requerimiento> {
  const { data } = await api.post<Requerimiento>(
    `${RAIZ}/requerimiento/${requerimientoId}/evaluar`,
  );
  return data;
}

/** §44: volver a evaluar tras un rechazo, sin destruir lo anterior. */
export async function reevaluarRequerimiento(
  requerimientoId: number,
): Promise<Requerimiento> {
  const { data } = await api.post<Requerimiento>(
    `${RAIZ}/requerimiento/${requerimientoId}/reevaluar`,
  );
  return data;
}

/** §38-39. Queda RECOMENDADA, nunca aprobada: eso es del Aprobador. */
export async function recomendarCotizacion(
  requerimientoId: number,
  payload: RecomendarPayload,
): Promise<Requerimiento> {
  const { data } = await api.post<Requerimiento>(
    `${RAIZ}/requerimiento/${requerimientoId}/recomendacion`,
    payload,
  );
  return data;
}
