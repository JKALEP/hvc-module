import { useState } from 'react';
import { ChevronRightIcon, NotebookPenIcon, PencilIcon } from 'lucide-react';

import { EmptyState } from './EmptyState';
import { TableSkeleton } from './TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  useReportesDiarios,
  useReporteDiario,
} from '@/hooks/useReportesDiarios';
import { formatFechaCorta, formatPorcentaje } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Periodo, ReporteDiario } from '@/types/models';

function tonoProduccion(valor: string | null) {
  if (valor === null) return 'outline' as const;
  const n = Number(valor);
  if (n >= 90) return 'success' as const;
  if (n >= 70) return 'warning' as const;
  return 'destructive' as const;
}

/** Personal de una jornada. Solo se consulta al desplegar la fila. */
function DetallePersonal({ reporteId }: { reporteId: number }) {
  const { data, isLoading } = useReporteDiario(reporteId, true);

  if (isLoading) {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Cargando personal…
      </span>
    );
  }

  if (!data || data.participaciones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No se registró personal en esta jornada.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Personal presente ({data.participaciones.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {data.participaciones.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-sm"
          >
            <span className="font-medium">
              {p.trabajador.apellidos}, {p.trabajador.nombres}
            </span>
            <span className="tabular-nums text-xs text-muted-foreground">
              {p.trabajador.dni}
            </span>
            <span className="text-xs text-muted-foreground">
              · {p.empresa.nombre}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Una fila de la bitácora, con su detalle desplegable. */
function FilaBitacora({
  reporte,
  onEditar,
}: {
  reporte: ReporteDiario;
  onEditar?: (id: number) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const totalPersonal = reporte._count?.participaciones ?? 0;

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
        <TableCell className="tabular-nums">
          {formatFechaCorta(reporte.fecha)}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {reporte.supervisor.nombre}
        </TableCell>
        <TableCell className="tabular-nums">
          {reporte.equiposEjecutados} / {reporte.equiposProgramados}
        </TableCell>
        <TableCell>
          <Badge
            variant={tonoProduccion(reporte.produccion)}
            className="tabular-nums"
          >
            {formatPorcentaje(reporte.produccion)}
          </Badge>
        </TableCell>
        <TableCell className="tabular-nums">
          {reporte.tecnicosLaborando} / {reporte.tecnicosProgramados}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {reporte.numeroContratistasTrabajando}
          {reporte.numeroContratistasProgramados !== null
            ? ` de ${reporte.numeroContratistasProgramados}`
            : ''}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {formatPorcentaje(reporte.calificacionProveedor)}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {formatPorcentaje(reporte.calificacionSupervisor)}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {totalPersonal}
        </TableCell>
        <TableCell className="text-right">
          {onEditar && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Editar jornada"
              onClick={(e) => {
                e.stopPropagation();
                onEditar(reporte.id);
              }}
            >
              <PencilIcon />
            </Button>
          )}
        </TableCell>
      </TableRow>

      {abierto && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={11} className="bg-muted/30 whitespace-normal">
            <DetallePersonal reporteId={reporte.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * Bitácora diaria del proyecto. Reutiliza GET /reporte-diario con filtro de
 * proyecto y rango; el personal de cada día se pide bajo demanda.
 */
export function BitacoraProyecto({
  proyectoId,
  periodo,
  onEditar,
}: {
  proyectoId: number;
  periodo: Periodo;
  onEditar?: (reporteId: number) => void;
}) {
  const { data, isLoading } = useReportesDiarios(proyectoId, periodo);
  const reportes = data ?? [];

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground">Bitácora diaria</h3>
        <p className="text-sm text-muted-foreground">
          Haz clic en una jornada para ver el personal que participó ese día.
        </p>
      </div>

      {isLoading && <TableSkeleton rows={5} cols={7} />}

      {!isLoading && reportes.length === 0 && (
        <EmptyState
          icon={NotebookPenIcon}
          title="Sin jornadas en el período"
          description="Ajusta el rango de fechas o carga reportes en la sección Reporte diario."
        />
      )}

      {!isLoading && reportes.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-8" />
                <TableHead>Fecha</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Equipos</TableHead>
                <TableHead>Producción</TableHead>
                <TableHead>Técnicos</TableHead>
                <TableHead>Contratistas</TableHead>
                <TableHead>Calif. proveedor</TableHead>
                <TableHead>Calif. supervisor</TableHead>
                <TableHead>Personal</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportes.map((r) => (
                <FilaBitacora key={r.id} reporte={r} onEditar={onEditar} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
