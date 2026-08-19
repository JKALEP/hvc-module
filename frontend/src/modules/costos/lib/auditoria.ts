import type { AccionCostos, EntidadCostos } from '@/modules/costos/types';

/**
 * El vocabulario de la bitácora en lenguaje de persona (§64).
 *
 * En un solo sitio por lo mismo que `lib/estados.ts`: son dos enums de
 * la base que aparecen en pantalla, y traducirlos donde toque garantiza
 * que dos vistas acaben llamando distinto a lo mismo. Aquí no hay
 * `switch` de entidad ni de acción fuera de este archivo.
 *
 * Records COMPLETOS: añadir un valor al enum del backend no compilará
 * hasta que alguien decida cómo se dice en castellano, que es
 * exactamente cuándo hay que decidirlo.
 */

export const ETIQUETA_ENTIDAD: Record<EntidadCostos, string> = {
  REQUERIMIENTO: 'Requerimiento',
  REQUERIMIENTO_ITEM: 'Ítem de requerimiento',
  OBSERVACION: 'Observación',
  SOLICITUD_COTIZACION: 'Solicitud de cotización',
  COTIZACION: 'Cotización',
  EVALUACION: 'Recomendación',
  APROBACION: 'Decisión',
  COSTO: 'Costo',
  PROVEEDOR: 'Proveedor',
  CLIENTE: 'Cliente',
  SUPERVISOR: 'Supervisor',
  CATALOGO: 'Catálogo',
  PLANTILLA: 'Plantilla de correo',
};

export const ETIQUETA_ACCION: Record<AccionCostos, string> = {
  CREACION: 'Creación',
  EDICION: 'Edición',
  CAMBIO_ESTADO: 'Cambio de estado',
  ELIMINACION: 'Eliminación',
  EMISION: 'Emisión',
  OBSERVACION_EMITIDA: 'Observación emitida',
  OBSERVACION_CONFIRMADA: 'Observación confirmada',
  ENVIO_CORREO: 'Envío de correo',
  RECOMENDACION: 'Recomendación',
  DECISION: 'Decisión',
  REGISTRO_COSTO: 'Registro de costo',
};

/**
 * Las entidades que se pueden consultar sueltas, para el selector.
 *
 * Es un subconjunto a propósito. Las demás —ítems, observaciones,
 * evaluaciones— solo tienen sentido dentro de su requerimiento, y ahí se
 * leen enteras con el historial; ofrecerlas aquí obligaría a conocer de
 * memoria el id de una fila intermedia para no ver nada útil.
 */
export const ENTIDADES_CONSULTABLES: EntidadCostos[] = [
  'REQUERIMIENTO',
  'COTIZACION',
  'PROVEEDOR',
  'CLIENTE',
  'SUPERVISOR',
  'CATALOGO',
  'COSTO',
];

/** El tono con que se pinta cada acción. Solo se destacan las que cierran algo. */
export function tonoDeAccion(
  accion: AccionCostos,
): 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' {
  if (accion === 'ELIMINACION') return 'destructive';
  if (accion === 'DECISION' || accion === 'REGISTRO_COSTO') return 'success';
  if (accion === 'OBSERVACION_EMITIDA') return 'warning';
  return 'secondary';
}
