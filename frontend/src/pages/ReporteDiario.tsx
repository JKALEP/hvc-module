import { useRef, useState } from 'react';
import { ClipboardPlusIcon, PencilIcon, Trash2Icon } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import {
  FormularioReporteDiario,
  type ControlFormularioReporte,
} from '@/components/shared/FormularioReporteDiario';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { useProyectos, useSupervisores } from '@/hooks/usePersonal';
import {
  useReportesDiarios,
  useEliminarReporte,
} from '@/hooks/useReportesDiarios';
import { formatFechaCorta, formatPorcentaje } from '@/lib/format';

export function ReporteDiario() {
  const formulario = useRef<ControlFormularioReporte>(null);
  const [filtroProyecto, setFiltroProyecto] = useState<number | null>(null);

  const { data: proyectos, isLoading: cargandoProyectos } = useProyectos();
  const { data: supervisores } = useSupervisores();
  const { data: reportes, isLoading: cargandoReportes } =
    useReportesDiarios(filtroProyecto);

  const eliminar = useEliminarReporte();

  const sinCatalogos =
    !cargandoProyectos &&
    ((proyectos ?? []).length === 0 || (supervisores ?? []).length === 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reporte diario"
        description="Registra la jornada por proyecto. La producción, los técnicos laborando y las contratistas en obra se calculan solos."
      />

      {sinCatalogos && (
        <EmptyState
          icon={ClipboardPlusIcon}
          title="Faltan catálogos para poder reportar"
          description="Necesitas al menos un proyecto y un supervisor cargados. Créalos con POST /proyecto y POST /supervisor, o cárgalos por SQL."
        />
      )}

      {!sinCatalogos && (
        <Card>
          <CardContent>
            <FormularioReporteDiario control={formulario} />
          </CardContent>
        </Card>
      )}

      {/* Reportes cargados */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Reportes cargados
          </h2>
          <div className="w-64">
            <Select
              className="h-9"
              value={filtroProyecto ?? ''}
              onChange={(e) =>
                setFiltroProyecto(
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
            >
              <option value="">Todos los proyectos</option>
              {(proyectos ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {cargandoReportes && <TableSkeleton rows={5} cols={9} />}

        {!cargandoReportes && (reportes ?? []).length === 0 && (
          <EmptyState
            icon={ClipboardPlusIcon}
            title="Todavía no hay reportes"
            description="Completa el formulario de arriba para registrar la primera jornada."
          />
        )}

        {!cargandoReportes && (reportes ?? []).length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Equipos</TableHead>
                  <TableHead>Producción</TableHead>
                  <TableHead>Técnicos</TableHead>
                  <TableHead>Contratistas</TableHead>
                  <TableHead>Calif. proveedor</TableHead>
                  <TableHead>Calif. supervisor</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reportes ?? []).map((r) => {
                  const prod =
                    r.produccion === null ? null : Number(r.produccion);
                  const tono =
                    prod === null
                      ? 'outline'
                      : prod >= 90
                        ? 'success'
                        : prod >= 70
                          ? 'warning'
                          : 'destructive';
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums">
                        {formatFechaCorta(r.fecha)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.proyecto.nombre}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.supervisor.nombre}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {r.equiposEjecutados} / {r.equiposProgramados}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tono} className="tabular-nums">
                          {formatPorcentaje(r.produccion, 1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {r.tecnicosLaborando} / {r.tecnicosProgramados}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {r.numeroContratistasTrabajando}
                        {r.numeroContratistasProgramados !== null
                          ? ` / ${r.numeroContratistasProgramados}`
                          : ''}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatPorcentaje(r.calificacionProveedor, 1)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatPorcentaje(r.calificacionSupervisor, 1)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar reporte"
                            onClick={() => {
                              void formulario.current?.abrirParaEditar(r.id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Eliminar reporte"
                            disabled={eliminar.isPending}
                            onClick={() => eliminar.mutate(r.id)}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
