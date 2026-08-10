import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { ChartCard } from './ChartCard';
import {
  SERIE,
  EJE,
  propsEjeX,
  propsEjeY,
  propsGrid,
  propsTooltip,
  propsLeyenda,
  etiquetaDia,
  LINEA_GROSOR,
  PUNTO_RADIO,
} from '@/lib/chartTheme';
import type { SerieCumplimiento } from '@/types/models';

/**
 * Cumplimiento acumulado del proyecto, día a día.
 *
 * Cada punto es Σejecutados / Σprogramados de todos los reportes hasta esa
 * fecha. Se llama "cumplimiento" y no "avance" por una razón concreta:
 * es una razón corriente y PUEDE BAJAR — una jornada mala arrastra el
 * acumulado hacia abajo. Un "avance" que retrocede confundiría a
 * cualquiera; un cumplimiento que baja se entiende solo.
 *
 * Encima se dibujan los ajustes manuales en otro color, para que se vea de
 * un vistazo cuándo alguien sobrescribió el cálculo y cuánto se apartó.
 */
export function GraficoCumplimientoAcumulado({
  datos,
}: {
  datos: SerieCumplimiento;
}) {
  // Ambas series comparten el eje X: se combinan por etiqueta de día.
  const porDia = new Map<
    string,
    { etiqueta: string; fecha: string; calculado?: number | null; ajuste?: number | null }
  >();

  for (const p of datos.serie) {
    porDia.set(p.fecha, {
      etiqueta: etiquetaDia(p.fecha),
      fecha: p.fecha,
      calculado: p.cumplimientoAcumulado,
    });
  }
  for (const a of datos.ajustes) {
    const actual = porDia.get(a.fecha);
    if (actual) actual.ajuste = a.porcentaje;
    else
      porDia.set(a.fecha, {
        etiqueta: etiquetaDia(a.fecha),
        fecha: a.fecha,
        ajuste: a.porcentaje,
      });
  }

  const puntos = [...porDia.values()].sort((a, b) =>
    a.fecha.localeCompare(b.fecha),
  );

  return (
    <ChartCard
      title="Cumplimiento acumulado"
      description={`Σ equipos ejecutados / Σ programados desde el inicio de la obra. Puede bajar: una jornada mala arrastra el acumulado. Total histórico: ${
        datos.totalHistorico === null ? '—' : `${datos.totalHistorico}%`
      }.${
        datos.ajustesFueraDePeriodo > 0
          ? ` Hay ${datos.ajustesFueraDePeriodo} ajuste(s) manual(es) fuera del rango: amplía el período para verlos.`
          : ''
      }`}
      vacio={puntos.length === 0}
      mensajeVacio="Este proyecto todavía no tiene reportes diarios cargados."
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={puntos}
            margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid {...propsGrid} />
            <XAxis {...propsEjeX} />
            <YAxis
              {...propsEjeY}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              {...propsTooltip}
              cursor={{ stroke: EJE, strokeDasharray: '3 3' }}
              formatter={(valor) =>
                valor === null || valor === undefined
                  ? '—'
                  : `${String(valor)}%`
              }
            />
            <Legend {...propsLeyenda} />
            <Line
              // linear: los tramos solo unen jornadas reales, no interpolan.
              type="linear"
              dataKey="calculado"
              name="Cumplimiento calculado"
              stroke={SERIE.programado}
              strokeWidth={LINEA_GROSOR}
              dot={{ r: 3, fill: SERIE.programado, strokeWidth: 0 }}
              activeDot={{ r: PUNTO_RADIO + 2 }}
              connectNulls
            />
            <Scatter
              dataKey="ajuste"
              name="Ajuste manual"
              fill={SERIE.ejecutado}
              shape="diamond"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
