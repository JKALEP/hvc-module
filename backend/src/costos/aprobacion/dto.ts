// DTO plano, sin `class-validator`. Valida el service, en español.

/**
 * La decisión del Aprobador (§41-45).
 *
 * Un solo endpoint con tres decisiones y no tres endpoints: es UN acto
 * —pronunciarse sobre lo que el Gestor recomendó— con tres desenlaces, y
 * qué estados admiten cada uno ya lo dice la máquina de estados.
 *
 * `comentario` es obligatorio al RECHAZAR y al cerrar SIN_ACUERDO (§43,
 * §45): las dos devuelven o cierran el requerimiento, y nadie puede
 * quedarse sin saber por qué. Al aceptar es opcional.
 */
export interface DecidirDto {
  decision?: string | null;
  comentario?: string | null;
}
