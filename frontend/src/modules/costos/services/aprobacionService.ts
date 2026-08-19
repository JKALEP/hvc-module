import { api } from '@/shared/services/api';
import type {
  Aprobacion,
  DecidirPayload,
  Requerimiento,
} from '@/modules/costos/types';

// Las decisiones del Aprobador (§41-45).
//
// Solo dos llamadas: lo que §40 le pide VER antes de decidir
// —requerimiento, ítems, todas las cotizaciones y la recomendación— ya
// lo dan los endpoints que usan las otras dos bandejas, y la pantalla
// los pide a la vez. No hay un endpoint «panel del aprobador» que
// devuelva la unión: sería otra definición de lo mismo.

const RAIZ = '/costos';

/** El historial de decisiones, incluidas las vueltas de §44. */
export async function listarAprobaciones(
  requerimientoId: number,
): Promise<Aprobacion[]> {
  const { data } = await api.get<Aprobacion[]>(
    `${RAIZ}/requerimiento/${requerimientoId}/aprobacion`,
  );
  return data;
}

/**
 * Un solo endpoint para las tres decisiones.
 *
 * Es UN acto —pronunciarse sobre lo que el Gestor recomendó— con tres
 * desenlaces. Devuelve el requerimiento ya movido de estado.
 */
export async function decidir(
  requerimientoId: number,
  payload: DecidirPayload,
): Promise<Requerimiento> {
  const { data } = await api.post<Requerimiento>(
    `${RAIZ}/requerimiento/${requerimientoId}/decision`,
    payload,
  );
  return data;
}
