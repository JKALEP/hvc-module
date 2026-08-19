import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ChevronRightIcon, UsersIcon, BuildingIcon } from 'lucide-react';

import { ChartCard } from '@/modules/personal/components/ChartCard';
import { EmptyState } from '@/shared/components/EmptyState';
import { Badge } from '@/shared/ui/badge';
import { Select } from '@/shared/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/shared/ui/table';
import { cn } from '@/shared/lib/utils';
import { fechaCorta } from '@/modules/personal/lib/obra';
import type {
  PuntoSerie,
  EmpresaParticipante,
  Participacion,
} from '@/modules/personal/types';

/**
 * Evolución del avance acumulado.
 *
 * Sustituye a cualquier gráfico aparte de producción diaria: ese dato
 * vive en el tooltip, junto al programado y al ejecutado del día, y
 * dibujarlo dos veces no añadía nada.
 */
export function GraficoAvance({ serie }: { serie: PuntoSerie[] }) {
  const puntos = serie.map((s) => ({ ...s, etiqueta: fechaCorta(s.fecha) }));

  return (
    <ChartCard
      title="Avance acumulado"
      description="Σ equipos ejecutados sobre el total contemplado. Pasa el cursor para ver el detalle del día."
      vacio={puntos.length === 0}
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={puntos} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="etiqueta"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
            formatter={(valor, nombre) => [`${Number(valor).toFixed(2)}%`, nombre]}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as PuntoSerie & { etiqueta: string };
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
                  <p className="mb-1 font-semibold text-foreground">{d.etiqueta}</p>
                  <p className="text-muted-foreground">
                    Programado: <span className="tabular-nums text-foreground">{d.equiposProgramados}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Ejecutado: <span className="tabular-nums text-foreground">{d.equiposEjecutados}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Producción:{' '}
                    <span className="tabular-nums text-foreground">
                      {d.produccion === null ? '—' : `${d.produccion.toFixed(1)}%`}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Avance acumulado:{' '}
                    <span className="tabular-nums font-medium text-foreground">
                      {d.avanceAcumulado.toFixed(2)}%
                    </span>
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="linear"
            dataKey="avanceAcumulado"
            stroke="var(--serie-ejecutado)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Empresas que pusieron gente, con su detalle desplegable. */
export function TablaEmpresas({
  empresas,
  onPersona,
}: {
  empresas: EmpresaParticipante[];
  onPersona: (documento: string) => void;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);

  if (empresas.length === 0)
    return (
      <EmptyState
        icon={BuildingIcon}
        title="Todavía no hay asistencia registrada"
        description="Registra participantes en el registro diario para ver las empresas."
      />
    );

  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-foreground">Empresas participantes</h2>
      <p className="text-sm text-muted-foreground">
        «Participaciones» son días-persona; «Personal», personas distintas. 20
        participaciones pueden ser 20 personas un día o 2 personas diez días.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-8" />
              <TableHead>Empresa</TableHead>
              <TableHead>Participaciones</TableHead>
              <TableHead>Personal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.map((e) => (
              <>
                <TableRow
                  key={e.empresa}
                  className="cursor-pointer"
                  onClick={() =>
                    setAbierta((a) => (a === e.empresa ? null : e.empresa))
                  }
                  aria-expanded={abierta === e.empresa}
                >
                  <TableCell>
                    <ChevronRightIcon
                      className={cn(
                        'size-4 text-muted-foreground transition-transform',
                        abierta === e.empresa && 'rotate-90',
                      )}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {e.empresa}
                    {!e.esEncargada && (
                      <Badge variant="warning" className="ml-2">
                        Externa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {e.participaciones}
                  </TableCell>
                  <TableCell className="tabular-nums">{e.personal}</TableCell>
                </TableRow>
                {abierta === e.empresa && (
                  <TableRow key={`${e.empresa}-detalle`} className="hover:bg-transparent">
                    <TableCell colSpan={4} className="bg-muted/30 whitespace-normal">
                      <div className="space-y-1">
                        {e.detalle.map((p) => (
                          <button
                            key={p.documento}
                            type="button"
                            onClick={() => onPersona(p.documento)}
                            className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <span className="truncate font-medium text-foreground">
                              {p.nombre}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {p.dias} día(s) · {p.fechas.map(fechaCorta).join(', ')}
                            </span>
                          </button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

/**
 * Participación por persona, en barras horizontales.
 *
 * Sin porcentaje individual: no hay un 100 % esperado por persona, así
 * que un porcentaje sugeriría una meta que no existe. La barra es
 * proporcional a quien más días acumuló.
 */
export function ParticipacionPersonal({
  datos,
  onPersona,
}: {
  datos: Participacion;
  onPersona: (documento: string) => void;
}) {
  const [empresa, setEmpresa] = useState('TODAS');

  if (datos.personas.length === 0)
    return (
      <EmptyState
        icon={UsersIcon}
        title="Sin participación registrada"
        description="Marca participantes en el registro diario."
      />
    );

  const visibles =
    empresa === 'TODAS'
      ? datos.personas
      : datos.personas.filter((p) => p.empresa === empresa);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">
          Participación del personal
        </h2>
        {/* El filtro se arma con quien REALMENTE participó: nunca ofrece
            una empresa sin nadie dentro. */}
        <Select
          className="h-9 w-56"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
        >
          <option value="TODAS">Todas las empresas</option>
          {datos.empresas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5 rounded-xl border border-border p-4">
        {visibles.map((p) => (
          <button
            key={p.documento}
            type="button"
            onClick={() => onPersona(p.documento)}
            className="flex w-full items-center gap-3 rounded-md px-1 py-1 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="w-56 shrink-0 truncate text-sm font-medium text-foreground">
              {p.nombre}
            </span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-[var(--serie-programado)]"
                style={{
                  width: `${Math.max(2, (p.dias / (datos.maximoDias || 1)) * 100)}%`,
                }}
              />
            </span>
            <span className="w-16 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
              {p.dias} día{p.dias === 1 ? '' : 's'}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
