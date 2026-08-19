import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ChartPieIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { Button } from '@/shared/ui/button';
import { Select } from '@/shared/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/shared/ui/table';
import { useOrganizaciones } from '@/modules/equipos/hooks/useEquipos';
import {
  useResumenEquipos,
  useDimensiones,
  useDistribucion,
  useExportarReporte,
} from '@/modules/equipos/hooks/useReportes';

/** Un número del resumen. */
function Kpi({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
      <p className="text-2xl font-semibold text-foreground tabular-nums">
        {valor}
      </p>
    </div>
  );
}

/**
 * Reportes consolidados: cómo se reparte el inventario.
 *
 * La dimensión es un desplegable y no cinco pestañas fijas porque
 * «tipo», «marca» y «estado» NO son columnas del sistema: cada
 * organización define sus propios campos y les pone el nombre que
 * quiere. El backend dice por qué se puede agrupar en cada caso y esta
 * pantalla solo ofrece lo que le devuelve — así, una organización que
 * mañana añada «Año de fabricación» lo tiene aquí sin tocar código.
 *
 * Sin organización elegida el reporte es global, y entonces solo caben
 * las dimensiones que existen en todas: organización y ubicación.
 */
export function Reportes() {
  const [organizacionId, setOrganizacionId] = useState<number | null>(null);
  const [dimension, setDimension] = useState('organizacion');

  const { data: organizaciones } = useOrganizaciones();
  const { data: resumen } = useResumenEquipos(organizacionId);
  const { data: dimensiones } = useDimensiones(organizacionId);
  const { data, isError } = useDistribucion(organizacionId, dimension);
  const exportar = useExportarReporte();

  const cargando = !data && !isError;
  const maximo = Math.max(1, ...(data?.filas.map((f) => f.cantidad) ?? []));

  const cambiarOrganizacion = (id: number | null) => {
    setOrganizacionId(id);
    // Los campos son de una organización: al cambiarla, la dimensión
    // elegida puede dejar de existir. Se vuelve a la única que siempre
    // vale en vez de pedirle al servidor algo que va a rechazar.
    setDimension('organizacion');
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/equipos"
          className="mb-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeftIcon className="size-4" />
          Volver a organizaciones
        </Link>
        <PageHeader
          title="Reportes"
          description="Cómo se reparte el inventario. Se puede agrupar por organización, por ubicación o por cualquier campo que la organización haya configurado."
        />
      </div>

      {resumen && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi etiqueta="Equipos" valor={resumen.equipos} />
          <Kpi etiqueta="Organizaciones" valor={resumen.organizaciones} />
          <Kpi etiqueta="Ubicaciones" valor={resumen.nodos} />
          <Kpi
            etiqueta="Incidencias abiertas"
            valor={resumen.incidenciasAbiertas}
          />
          <Kpi
            etiqueta="Cotizaciones pendientes"
            valor={resumen.cotizacionesPendientes}
          />
          <Kpi etiqueta="Órdenes activas" valor={resumen.ordenesActivas} />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">
            Organización
          </label>
          <Select
            className="h-9 w-56"
            value={organizacionId ?? ''}
            onChange={(e) =>
              cambiarOrganizacion(
                e.target.value === '' ? null : Number(e.target.value),
              )
            }
          >
            <option value="">Todas</option>
            {(organizaciones ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">
            Agrupar por
          </label>
          <Select
            className="h-9 w-56"
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
          >
            {(dimensiones ?? []).map((d) => (
              <option key={d.clave} value={d.clave}>
                {d.etiqueta}
              </option>
            ))}
          </Select>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={exportar.isPending || !data}
            onClick={() =>
              exportar.mutate({
                tipo: 'distribucion',
                organizacionId,
                dimension,
                formato: 'excel',
              })
            }
          >
            <FileSpreadsheetIcon />
            Excel
          </Button>
          <Button
            variant="outline"
            disabled={exportar.isPending || !data}
            onClick={() =>
              exportar.mutate({
                tipo: 'distribucion',
                organizacionId,
                dimension,
                formato: 'pdf',
              })
            }
          >
            <FileTextIcon />
            PDF
          </Button>
        </div>
      </div>

      {isError && (
        <EmptyState
          icon={ChartPieIcon}
          title="No se pudo calcular la distribución"
          description="Prueba con otra dimensión, o verifica que el backend esté corriendo."
        />
      )}

      {cargando && <TableSkeleton rows={5} cols={3} />}

      {data && data.filas.length === 0 && (
        <EmptyState
          icon={ChartPieIcon}
          title="Sin equipos que repartir"
          description="Registra equipos en el inventario y vuelve a este reporte."
        />
      )}

      {data && data.filas.length > 0 && (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{data.etiqueta}</TableHead>
                  <TableHead className="text-right">Equipos</TableHead>
                  <TableHead className="w-64">% del total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.filas.map((f) => (
                  <TableRow key={f.etiqueta}>
                    <TableCell className="font-medium">{f.etiqueta}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.cantidad}
                    </TableCell>
                    <TableCell>
                      {/* La barra se mide contra la fila más alta, no
                          contra el total: con muchas categorías todas
                          quedarían igual de cortas. El número de al lado
                          sí es el porcentaje real. */}
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${(f.cantidad / maximo) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                          {f.porcentaje}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell className="font-semibold">TOTAL</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {data.total}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {data.multiple && (
            <p className="text-xs text-muted-foreground">
              Campo de selección múltiple: un equipo puede contar en más de una
              fila, así que las filas suman más que el total.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
