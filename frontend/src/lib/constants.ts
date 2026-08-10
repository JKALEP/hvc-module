// Punto único de configuración de la API y de las query keys de TanStack Query.

import type { FiltrosFeed, FiltrosPersonal, Periodo } from '@/types/models';

export const API_URL = 'http://localhost:3000';

export const QUERY_KEYS = {
  importaciones: ['importaciones'] as const,
  importacion: (id: number) => ['importacion', id] as const,
  maestro: (q: string) => ['maestro', q] as const,

  // Módulo Personal y Proyectos
  proyectos: ['proyectos'] as const,
  supervisores: ['supervisores'] as const,
  empresas: ['empresas'] as const,
  trabajadores: (q: string, empresaId: number | null) =>
    ['trabajadores', q, empresaId] as const,
  reportesDiarios: (proyectoId: number | null, periodo?: Periodo) =>
    [
      'reportes-diarios',
      proyectoId,
      periodo?.desde ?? null,
      periodo?.hasta ?? null,
    ] as const,
  reporteDiario: (id: number) => ['reporte-diario', id] as const,
  indicadoresPersonal: (f: FiltrosPersonal) =>
    ['indicadores-personal', f.desde, f.hasta, f.empresaId, f.proyectoId] as const,

  // Avance de proyectos (Fase 3)
  resumenProyecto: (id: number, p: Periodo) =>
    ['proyecto-resumen', id, p.desde, p.hasta] as const,
  produccionDiaria: (id: number, p: Periodo) =>
    ['proyecto-produccion', id, p.desde, p.hasta] as const,
  equiposProyecto: (id: number, p: Periodo) =>
    ['proyecto-equipos', id, p.desde, p.hasta] as const,
  tecnicosProyecto: (id: number, p: Periodo) =>
    ['proyecto-tecnicos', id, p.desde, p.hasta] as const,
  cumplimientoAcumulado: (id: number, p: Periodo) =>
    ['proyecto-cumplimiento', id, p.desde, p.hasta] as const,
  ajustesAvance: (id: number) => ['proyecto-ajustes', id] as const,
  comparacionProyectos: (p: Periodo) =>
    ['proyecto-comparacion', p.desde, p.hasta] as const,

  // Modo Meses de /personal y supervisores
  indicadoresMensual: (f: unknown) => ['indicadores-mensual', f] as const,
  empresaMensual: (id: number, f: unknown) =>
    ['empresa-mensual', id, f] as const,
  supervisoresComparacion: (p: Periodo) =>
    ['supervisores-comparacion', p.desde, p.hasta] as const,
  supervisorResumen: (id: number, p: Periodo) =>
    ['supervisor-resumen', id, p.desde, p.hasta] as const,

  // Módulo Fotos
  navegacion: (sedeId: number | null) =>
    ['fotos', 'navegacion', sedeId] as const,
  albumes: (sedeId: number | null) => ['fotos', 'albumes', sedeId] as const,
  album: (id: number) => ['fotos', 'album', id] as const,
  feedAlbum: (id: number, f: FiltrosFeed) =>
    ['fotos', 'feed', id, f.subidaPorId, f.desde, f.hasta] as const,
  autoresAlbum: (id: number) => ['fotos', 'autores', id] as const,
  compartidos: (tipo: string, id: number) =>
    ['fotos', 'compartidos', tipo, id] as const,

  // Portal del cliente externo
  portalNavegacion: (sedeId: number | null) =>
    ['portal', 'navegacion', sedeId] as const,
  portalFeed: (id: number, f: FiltrosFeed) =>
    ['portal', 'feed', id, f.desde, f.hasta] as const,
};

// Etiquetas legibles de los tipos de alerta.
export const ETIQUETAS_ALERTA = {
  SIN_PARTICIPACION: 'Personal sin participación',
  POCA_PARTICIPACION: 'Personal con baja participación',
  UTILIZACION_EMPRESA: 'Utilización de contratista',
  BRECHA_TECNICOS: 'Falta de personal en obra',
  EXCEDENTE_TECNICOS: 'Excedente de personal en obra',
  PRODUCCION_PROYECTO: 'Producción bajo objetivo',
} as const;

export const ETIQUETAS_SEVERIDAD = {
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
} as const;

// Debounce del buscador de la tabla maestra (ms).
export const SEARCH_DEBOUNCE_MS = 300;

// Etiquetas legibles de los estados de proyecto.
export const ETIQUETAS_ESTADO_PROYECTO = {
  EN_EJECUCION: 'En ejecución',
  FINALIZADO: 'Finalizado',
  PAUSADO: 'Pausado',
} as const;
