import {
  ComposedChart,
  Bar,
  Line,
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
  propsEjeX,
  propsEjeY,
  propsGrid,
  propsTooltip,
  propsLeyenda,
  etiquetaDia,
  LINEA_GROSOR,
  PUNTO_RADIO,
} from '@/lib/chartTheme';
import type { PuntoTecnicos } from '@/types/models';

/**
 * Técnicos programados vs laborando.
 *
 * Forma distinta a la del gráfico de equipos, a propósito:
 * `tecnicosProgramados` suele ser un número plano (4, 4, 4, 3) — como
 * barras sería un muro repetido; como línea lee "nivel objetivo" y el
 * hueco contra las barras salta a la vista. Ese hueco es exactamente la
 * señal que interesa vigilar.
 *
 * Un solo eje Y: ambas series son personas, misma escala.
 */
export function GraficoTecnicos({ datos }: { datos: PuntoTecnicos[] }) {
  const puntos = datos.map((d) => ({
    ...d,
    etiqueta: etiquetaDia(d.fecha),
  }));

  return (
    <ChartCard
      title="Técnicos programados vs laborando"
      description="Las barras son el personal que efectivamente participó; la línea es el objetivo planificado. Cuando la barra queda debajo de la línea, faltó gente."
      vacio={puntos.length === 0}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={puntos}
            margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid {...propsGrid} />
            <XAxis {...propsEjeX} />
            <YAxis {...propsEjeY} allowDecimals={false} />
            <Tooltip {...propsTooltip} />
            <Legend {...propsLeyenda} />
            <Bar
              dataKey="laborando"
              name="Laborando"
              fill={SERIE.ejecutado}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Line
              // linear: el objetivo cambia de golpe entre jornadas, no
              // transiciona suavemente.
              type="linear"
              dataKey="programados"
              name="Programados"
              stroke={SERIE.programado}
              strokeWidth={LINEA_GROSOR}
              dot={{ r: PUNTO_RADIO, fill: SERIE.programado, strokeWidth: 0 }}
              activeDot={{ r: PUNTO_RADIO + 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
