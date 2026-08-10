import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

import { ChartCard } from './ChartCard';
import {
  EJE,
  propsEjeX,
  propsEjeY,
  propsGrid,
  propsTooltip,
  propsLeyenda,
  LINEA_GROSOR,
  PUNTO_RADIO,
} from '@/lib/chartTheme';
import type { EmpresaMensual } from '@/types/models';

// Umbral de utilización de contratista, el mismo del resto del sistema.
const UMBRAL = 70;

/**
 * Máximo de contratistas con color propio.
 *
 * No es una decisión estética: con los cuatro primeros pasos de la paleta,
 * el par amarillo↔naranja falla el piso de visión normal en claro (ΔE 13.7)
 * y la separación CVD en oscuro (ΔE 4.8). Con tres, todo pasa en ambos
 * modos (peor par ΔE 9.2 protan claro / 9.4 deutan oscuro).
 */
const TOPE_SERIES = 3;

const COLORES = [
  'var(--serie-programado)',
  'var(--serie-ejecutado)',
  'var(--serie-aqua)',
];

/**
 * Comparación mensual de utilización entre contratistas.
 *
 * Es el único gráfico de tendencia de esta vista: la pregunta "¿cómo
 * cambió en el tiempo?" no se contesta bien con una tabla. Todo lo demás
 * de la vista se resuelve con columnas por mes.
 */
export function GraficoUtilizacionMensual({
  empresas,
  metrica = 'cobertura',
}: {
  empresas: EmpresaMensual[];
  metrica?: 'cobertura' | 'utilizacionEfectiva';
}) {
  // Las 3 con más personal contratado. El color sigue a la entidad.
  const mostradas = [...empresas]
    .sort((a, b) => b.contratadosPromedio - a.contratadosPromedio)
    .slice(0, TOPE_SERIES);
  const ocultas = empresas.length - mostradas.length;

  // Eje X: los meses del rango, tomados de la primera empresa.
  const meses = empresas[0]?.meses ?? [];
  const puntos = meses.map((m, i) => {
    const fila: Record<string, string | number | null> = {
      etiqueta: m.etiqueta,
    };
    for (const e of mostradas) {
      fila[e.empresa] = e.meses[i]?.[metrica] ?? null;
    }
    return fila;
  });

  const etiquetaMetrica =
    metrica === 'cobertura'
      ? 'Cobertura: qué parte de la planilla se usó'
      : 'Utilización efectiva: normalizada por los días activos de sus propias obras';

  return (
    <ChartCard
      title="Utilización mensual por contratista"
      description={`${etiquetaMetrica}. La línea punteada marca el ${UMBRAL}%.${
        ocultas > 0
          ? ` Se muestran las ${TOPE_SERIES} contratistas con más personal; las otras ${ocultas} están en la tabla de abajo.`
          : ''
      }`}
      vacio={puntos.length === 0 || mostradas.length === 0}
      mensajeVacio="No hay contratistas con datos en los meses seleccionados."
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={puntos}
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
              formatter={(valor) =>
                valor === null || valor === undefined
                  ? '—'
                  : `${String(valor)}%`
              }
            />
            <Legend {...propsLeyenda} />
            <ReferenceLine
              y={UMBRAL}
              stroke={EJE}
              strokeDasharray="4 4"
              label={{
                value: `${UMBRAL}%`,
                position: 'right',
                fill: EJE,
                fontSize: 11,
              }}
            />
            {mostradas.map((e, i) => (
              <Line
                key={e.empresaId}
                // linear: los tramos unen mediciones mensuales reales.
                type="linear"
                dataKey={e.empresa}
                name={e.empresa}
                stroke={COLORES[i]}
                strokeWidth={LINEA_GROSOR}
                dot={{ r: PUNTO_RADIO, fill: COLORES[i], strokeWidth: 0 }}
                activeDot={{ r: PUNTO_RADIO + 2 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
