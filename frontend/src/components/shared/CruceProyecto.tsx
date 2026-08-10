import { NetworkIcon, UserXIcon } from 'lucide-react';

import { EmptyState } from './EmptyState';
import { TableSkeleton } from './TableSkeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { useCruceProyecto } from '@/hooks/useAlertas';
import { formatPorcentaje, formatEntero } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Periodo } from '@/types/models';

const UMBRAL_UTILIZACION = 70;

function clase(valor: number | null) {
  if (valor === null) return 'text-muted-foreground';
  if (valor >= UMBRAL_UTILIZACION) return 'text-emerald-600 dark:text-emerald-400';
  if (valor >= UMBRAL_UTILIZACION * 0.7)
    return 'text-amber-600 dark:text-amber-500';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Cruce Proyecto → Personal participante → Empresa → Utilización.
 *
 * La utilización que se muestra de cada contratista es la GLOBAL del
 * período —toda su planilla, en todas las obras—, no la de este proyecto:
 * la pregunta que responde es "¿estoy usando bien a esta contratista?",
 * que no se contesta mirando una sola obra.
 */
export function CruceProyecto({
  proyectoId,
  periodo,
}: {
  proyectoId: number;
  periodo: Periodo;
}) {
  const { data, isLoading } = useCruceProyecto(proyectoId, periodo);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <NetworkIcon className="size-4 text-muted-foreground" />
          Personal y contratistas de esta obra
        </h3>
        <p className="text-sm text-muted-foreground">
          Quién trabajó aquí, de qué empresa viene y cómo está utilizada esa
          empresa en todo el período — no solo en esta obra.
        </p>
      </div>

      {isLoading && <TableSkeleton rows={4} cols={6} />}

      {!isLoading && data && (
        <div className="space-y-4">
          {/* Contratistas presentes en la obra */}
          {data.empresas.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Contratista</TableHead>
                    <TableHead>RUC</TableHead>
                    <TableHead>Personas en la obra</TableHead>
                    <TableHead>Días-persona aquí</TableHead>
                    <TableHead>Contratados (total)</TableHead>
                    <TableHead>Utilización global</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.empresas.map((e) => (
                    <TableRow key={e.empresaId}>
                      <TableCell className="font-medium">{e.empresa}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {e.ruc}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {e.personasEnProyecto}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {e.participacionesEnProyecto}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {e.contratados ?? '—'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'font-medium tabular-nums',
                            clase(e.utilizacionCobertura),
                          )}
                        >
                          {formatPorcentaje(e.utilizacionCobertura)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Personal participante */}
          {data.personal.length === 0 ? (
            <EmptyState
              icon={UserXIcon}
              title="Sin personal registrado en el período"
              description="Ajusta el rango de fechas o carga jornadas para esta obra."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Trabajador</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Días en la obra</TableHead>
                    <TableHead>% de la obra</TableHead>
                    <TableHead>Contratista</TableHead>
                    <TableHead>Utilización de la contratista</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.personal.map((t) => (
                    <TableRow key={t.trabajadorId}>
                      <TableCell className="font-medium">
                        {t.apellidos}, {t.nombres}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {t.dni}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {t.diasTrabajados} / {t.diasDelProyecto}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {formatPorcentaje(t.porcentajeParticipacion)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.empresa}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'tabular-nums',
                            clase(t.empresaUtilizacionCobertura),
                          )}
                        >
                          {formatPorcentaje(t.empresaUtilizacionCobertura)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {data.personal.length} persona(s) ·{' '}
            {formatEntero(
              data.personal.reduce((a, t) => a + t.diasTrabajados, 0),
            )}{' '}
            días-persona en {data.periodo.diasConReporte} día(s) con reporte.
          </p>
        </div>
      )}
    </section>
  );
}
