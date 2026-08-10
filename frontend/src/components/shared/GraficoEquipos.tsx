import {
  BarChart,
  Bar,
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
} from '@/lib/chartTheme';
import type { PuntoEquipos } from '@/types/models';

/**
 * Equipos programados vs ejecutados.
 *
 * Barras AGRUPADAS, no apiladas: apilarlas diría que programados +
 * ejecutados suman un total, y no es así — ejecutados es lo realizado *de*
 * lo programado. Agrupadas se comparan las alturas directamente.
 */
export function GraficoEquipos({ datos }: { datos: PuntoEquipos[] }) {
  const puntos = datos.map((d) => ({
    ...d,
    etiqueta: etiquetaDia(d.fecha),
  }));

  return (
    <ChartCard
      title="Equipos programados vs ejecutados"
      description="Cantidad de equipos por día. La diferencia entre ambas barras es el trabajo que quedó pendiente esa jornada."
      vacio={puntos.length === 0}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={puntos}
            margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
            barGap={2}
          >
            <CartesianGrid {...propsGrid} />
            <XAxis {...propsEjeX} />
            <YAxis {...propsEjeY} allowDecimals={false} />
            <Tooltip {...propsTooltip} />
            <Legend {...propsLeyenda} />
            <Bar
              dataKey="programados"
              name="Programados"
              fill={SERIE.programado}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="ejecutados"
              name="Ejecutados"
              fill={SERIE.ejecutado}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
