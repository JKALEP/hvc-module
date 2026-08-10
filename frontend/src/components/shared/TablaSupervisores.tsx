import { useState } from 'react';
import { ChevronRightIcon, UserCogIcon } from 'lucide-react';

import { EmptyState } from './EmptyState';
import { EstadoProyectoBadge } from './EstadoProyectoBadge';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { useResumenSupervisor } from '@/hooks/useMensual';
import { formatPorcentaje, formatFechaCorta } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FilaSupervisor, Periodo } from '@/types/models';

function claseProduccion(valor: number | null) {
  if (valor === null) return 'text-muted-foreground';
  if (valor >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (valor >= 70) return 'text-amber-600 dark:text-amber-500';
  return 'text-red-600 dark:text-red-400';
}

/** Obras que ha llevado un supervisor. Solo se consulta al desplegar. */
function ObrasSupervisadas({
  supervisorId,
  periodo,
}: {
  supervisorId: number;
  periodo: Periodo;
}) {
  const { data, isLoading } = useResumenSupervisor(supervisorId, periodo, true);

  if (isLoading) {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Cargando obras…
      </span>
    );
  }

  if (!data || data.proyectosSupervisados.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este supervisor todavía no ha firmado ninguna jornada.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Obras supervisadas ({data.totalProyectos}) · histórico completo, no
        depende del período
      </p>
      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Proyecto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead>Hasta</TableHead>
              <TableHead>Jornadas</TableHead>
              <TableHead>Producción</TableHead>
              <TableHead>Cumplimiento</TableHead>
              <TableHead>Jornadas con brecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.proyectosSupervisados.map((p) => (
              <TableRow key={p.proyectoId}>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.cliente ?? '—'}
                </TableCell>
                <TableCell>
                  {p.estado && <EstadoProyectoBadge estado={p.estado} />}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatFechaCorta(p.primerReporte)}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatFechaCorta(p.ultimoReporte)}
                </TableCell>
                <TableCell className="tabular-nums">{p.reportes}</TableCell>
                <TableCell
                  className={cn(
                    'tabular-nums',
                    claseProduccion(p.produccionPromedio),
                  )}
                >
                  {formatPorcentaje(p.produccionPromedio)}
                </TableCell>
                <TableCell
                  className={cn('tabular-nums', claseProduccion(p.cumplimiento))}
                >
                  {formatPorcentaje(p.cumplimiento)}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {p.jornadasConBrecha} (
                  {formatPorcentaje(p.porcentajeJornadasConBrecha, 0)})
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilaSupervisorTabla({
  supervisor,
  periodo,
}: {
  supervisor: FilaSupervisor;
  periodo: Periodo;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <TableCell>
          <ChevronRightIcon
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              abierto && 'rotate-90',
            )}
          />
        </TableCell>
        <TableCell className="font-medium">
          {supervisor.nombre}
          {supervisor.estado === 'INACTIVO' && (
            <Badge variant="outline" className="ml-2">
              Inactivo
            </Badge>
          )}
        </TableCell>
        <TableCell className="tabular-nums">
          {supervisor.proyectosHistoricos}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {supervisor.proyectosEnPeriodo}
        </TableCell>
        <TableCell className="tabular-nums">{supervisor.reportes}</TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {supervisor.diasReportados}
        </TableCell>
        <TableCell
          className={cn(
            'tabular-nums',
            claseProduccion(supervisor.produccionPromedio),
          )}
        >
          {formatPorcentaje(supervisor.produccionPromedio)}
        </TableCell>
        <TableCell className="tabular-nums">
          {supervisor.calificacionPromedio === null ? (
            <span className="text-muted-foreground">
              — <span className="text-xs">sin calificar</span>
            </span>
          ) : (
            <span
              className={claseProduccion(supervisor.calificacionPromedio)}
            >
              {formatPorcentaje(supervisor.calificacionPromedio)}
            </span>
          )}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {supervisor.personalPromedioPorDia ?? '—'}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {formatPorcentaje(supervisor.porcentajeJornadasConBrecha, 0)}
        </TableCell>
      </TableRow>

      {abierto && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={10} className="bg-muted/30 whitespace-normal">
            <ObrasSupervisadas
              supervisorId={supervisor.id}
              periodo={periodo}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * Comparación entre supervisores de HVC.
 *
 * Responde "¿qué obras ha llevado cada uno y cómo le ha ido?", que no se
 * contesta mirando un proyecto aislado. El número de obras es histórico;
 * el resto de métricas se acota al período.
 */
export function TablaSupervisores({
  supervisores,
  periodo,
}: {
  supervisores: FilaSupervisor[];
  periodo: Periodo;
}) {
  if (supervisores.length === 0) {
    return (
      <EmptyState
        icon={UserCogIcon}
        title="No hay supervisores registrados"
        description="Créalos con POST /supervisor o cárgalos por SQL."
      />
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        «Obras (histórico)» cuenta todas las que ha llevado alguna vez, sin
        filtro de fecha. Las demás métricas se miden sobre el período elegido.
        «Calificación» es la que el supervisor recibió en sus jornadas.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-8" />
              <TableHead>Supervisor</TableHead>
              <TableHead>Obras (histórico)</TableHead>
              <TableHead>Obras en período</TableHead>
              <TableHead>Jornadas</TableHead>
              <TableHead>Días</TableHead>
              <TableHead>Producción</TableHead>
              <TableHead>Calificación</TableHead>
              <TableHead>Personal/día</TableHead>
              <TableHead>Jornadas con brecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supervisores.map((s) => (
              <FilaSupervisorTabla
                key={s.id}
                supervisor={s}
                periodo={periodo}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
