// Configuración compartida de los gráficos de recharts.
//
// Los colores salen de variables CSS declaradas en index.css bajo :root y
// .dark, así que el modo oscuro usa sus propios pasos en vez de un volteo
// automático. El SVG acepta var() directamente en fill/stroke.

export const SERIE = {
  /** Lo planificado. El color sigue a la entidad, no al orden de la serie. */
  programado: 'var(--serie-programado)',
  /** Lo realmente ejecutado / laborado. */
  ejecutado: 'var(--serie-ejecutado)',
} as const;

export const EJE = 'var(--muted-foreground)';
export const GRID = 'var(--border)';
export const SUPERFICIE = 'var(--card)';

/** Grosor de línea y tamaño de punto (marcas finas, puntos >= 8px). */
export const LINEA_GROSOR = 2;
export const PUNTO_RADIO = 4;

/** Props comunes de los ejes: recesivos, sin línea dura. */
export const propsEjeX = {
  dataKey: 'etiqueta',
  tick: { fill: EJE, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: GRID },
  interval: 'preserveStartEnd' as const,
};

export const propsEjeY = {
  tick: { fill: EJE, fontSize: 11 },
  tickLine: false,
  axisLine: false,
  width: 44,
};

/** Grid horizontal solamente: las verticales compiten con las barras. */
export const propsGrid = {
  stroke: GRID,
  strokeDasharray: '3 3',
  vertical: false,
};

/** Tooltip con las superficies y tipografía de la app. */
export const propsTooltip = {
  contentStyle: {
    background: SUPERFICIE,
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  },
  labelStyle: { color: 'var(--foreground)', fontWeight: 600 },
  itemStyle: { color: 'var(--muted-foreground)' },
  cursor: { fill: 'var(--muted)', fillOpacity: 0.4 },
};

/** Leyenda: obligatoria con 2 series, innecesaria con 1. */
export const propsLeyenda = {
  wrapperStyle: { fontSize: '0.8125rem', paddingTop: 8 },
  iconType: 'circle' as const,
  iconSize: 8,
};

/** Etiqueta corta de fecha para el eje X: "05/08". */
export function etiquetaDia(fechaISO: string): string {
  const [, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}`;
}

/** Etiqueta de semana ISO para el eje X del avance: "S32". */
export function etiquetaSemana(semana: number): string {
  return `S${semana}`;
}
