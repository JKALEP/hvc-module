// DTOs planos (sin class-validator, igual que importacion/dto.ts).
// Toda la validación se hace manualmente en reporte-diario.service.ts.

export interface CrearReporteDiarioDto {
  fecha?: string | null;
  proyectoId?: number | string | null;
  supervisorId?: number | string | null;

  // Entrada manual del supervisor
  equiposProgramados?: number | string | null;
  equiposEjecutados?: number | string | null;
  tecnicosProgramados?: number | string | null;
  // Expectativa: cuántas contratistas se esperaba en obra ese día.
  // Es lo único de contratistas que se digita; el "trabajando" se calcula.
  numeroContratistasProgramados?: number | string | null;

  // Cualitativas, independientes de `produccion` y entre sí. Opcionales.
  calificacionProveedor?: number | string | null; // evalúa a la contratista
  calificacionSupervisor?: number | string | null; // evalúa al supervisor de HVC

  // Alimenta la tabla Participacion: un registro por cada id.
  // De aquí salen `tecnicosLaborando` y `numeroContratistasTrabajando`
  // (el usuario NUNCA los digita).
  trabajadoresIds?: (number | string)[] | null;
}

export type EditarReporteDiarioDto = CrearReporteDiarioDto;

// Filtros de la lista de reportes.
export interface FiltroReportesDto {
  proyectoId?: number;
  supervisorId?: number;
  desde?: string;
  hasta?: string;
}
