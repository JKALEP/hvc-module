import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
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
  etiquetaDia,
  LINEA_GROSOR,
  PUNTO_RADIO,
} from '@/lib/chartTheme';
import type { PuntoProduccion } from '@/types/models';

// Umbral de producción bajo el cual se considera incumplimiento.
const UMBRAL_PRODUCCION = 90;

/**
 * Producción diaria. Una sola serie, así que no lleva leyenda: el título
 * la nombra.
 *
 * `connectNulls` queda en false a propósito. La producción es null cuando
 * ese día no hubo equipos programados; unir el hueco dibujaría una recta
 * que afirma un valor que nadie midió.
 */
export function GraficoProduccionDiaria({
  datos,
}: {
  datos: PuntoProduccion[];
}) {
  const puntos = datos.map((d) => ({
    ...d,
    etiqueta: etiquetaDia(d.fecha),
  }));

  return (
    <ChartCard
      title="Producción diaria"
      description={`Equipos ejecutados sobre programados, día a día. La línea de referencia marca el ${UMBRAL_PRODUCCION}%; los días sin equipos programados dejan un hueco en vez de un cero.`}
      vacio={puntos.length === 0}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={puntos}
            // Margen derecho amplio: si no, la etiqueta de la línea de
            // referencia queda cortada ("9" en vez de "90%").
            margin={{ top: 8, right: 44, bottom: 4, left: 0 }}
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
              formatter={(valor) => [
                valor === null || valor === undefined
                  ? 'Sin equipos programados'
                  : `${String(valor)}%`,
                'Producción',
              ]}
            />
            <ReferenceLine
              y={UMBRAL_PRODUCCION}
              stroke={EJE}
              strokeDasharray="4 4"
              label={{
                value: `${UMBRAL_PRODUCCION}%`,
                position: 'right',
                fill: EJE,
                fontSize: 11,
              }}
            />
            <Line
              // linear, no monotone: una curva suavizada dibujaría valores
              // intermedios entre dos jornadas que nadie midió.
              type="linear"
              dataKey="produccion"
              name="Producción"
              stroke={SERIE.ejecutado}
              strokeWidth={LINEA_GROSOR}
              dot={{ r: PUNTO_RADIO, fill: SERIE.ejecutado, strokeWidth: 0 }}
              activeDot={{ r: PUNTO_RADIO + 2 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
