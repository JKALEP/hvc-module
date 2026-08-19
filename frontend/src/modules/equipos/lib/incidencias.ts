import type { EstadoIncidencia } from '@/modules/equipos/types';

/**
 * Las reglas visibles del flujo de incidencias, en un solo sitio.
 *
 * El orden lo conoce también el backend (`ORDEN_ESTADO` en
 * `incidencia.service.ts`); aquí solo vive cómo se ve y cuál es el
 * siguiente paso, para que el botón de avanzar no tenga que adivinarlo.
 */

export const ETIQUETA_ESTADO_INCIDENCIA: Record<EstadoIncidencia, string> = {
  ABIERTA: 'Abierta',
  EN_ATENCION: 'En atención',
  CERRADA: 'Cerrada',
};

export const VARIANTE_ESTADO_INCIDENCIA: Record<
  EstadoIncidencia,
  'destructive' | 'warning' | 'success'
> = {
  ABIERTA: 'destructive',
  EN_ATENCION: 'warning',
  CERRADA: 'success',
};

/** A dónde avanza cada estado. `null` = ya está al final del flujo. */
export const SIGUIENTE_ESTADO: Record<
  EstadoIncidencia,
  EstadoIncidencia | null
> = {
  ABIERTA: 'EN_ATENCION',
  EN_ATENCION: 'CERRADA',
  CERRADA: null,
};
