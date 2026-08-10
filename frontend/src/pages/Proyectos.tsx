import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import {
  LayoutGridIcon,
  TableIcon,
  FolderKanbanIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { FiltroRango } from '@/components/shared/FiltroRango';
import { TarjetaProyecto } from '@/components/shared/TarjetaProyecto';
import { EstadoProyectoBadge } from '@/components/shared/EstadoProyectoBadge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { useProyectos } from '@/hooks/usePersonal';
import { useComparacionProyectos } from '@/hooks/useProyectoAnalitica';
import {
  formatPorcentaje,
  formatEntero,
  hoyISO,
  inicioDeMesISO,
  orDash,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Periodo, FilaComparacion } from '@/types/models';

const columnHelper = createColumnHelper<FilaComparacion>();

/** Colorea un porcentaje según qué tan lejos esté del 90 %. */
function claseProduccion(valor: number | null): string {
  if (valor === null) return 'text-muted-foreground';
  if (valor >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (valor >= 70) return 'text-amber-600 dark:text-amber-500';
  return 'text-red-600 dark:text-red-400';
}

const columnas = [
  columnHelper.accessor('nombre', {
    header: 'Proyecto',
    cell: (info) => (
      <Link
        to={`/proyectos/${info.row.original.id}`}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor('cliente', {
    header: 'Cliente',
    cell: (info) => (
      <span className="text-muted-foreground">{orDash(info.getValue())}</span>
    ),
  }),
  columnHelper.accessor('estado', {
    header: 'Estado',
    cell: (info) => <EstadoProyectoBadge estado={info.getValue()} />,
  }),
  columnHelper.accessor('avanceAcumulado', {
    header: 'Avance',
    // Sin período: es el último AvanceSemanal registrado.
    cell: (info) => (
      <span className="font-semibold tabular-nums">
        {formatPorcentaje(info.getValue(), 0)}
      </span>
    ),
  }),
  columnHelper.accessor('produccionPromedio', {
    header: 'Producción prom.',
    cell: (info) => (
      <span className={cn('tabular-nums', claseProduccion(info.getValue()))}>
        {formatPorcentaje(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('cumplimiento', {
    header: 'Cumplimiento',
    cell: (info) => (
      <span className={cn('tabular-nums', claseProduccion(info.getValue()))}>
        {formatPorcentaje(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('personalDistinto', {
    header: 'Personal',
    cell: (info) => (
      <span className="tabular-nums">{formatEntero(info.getValue())}</span>
    ),
  }),
  columnHelper.accessor('tecnicosPromedioLaborando', {
    header: 'Técnicos prom.',
    cell: (info) => (
      <span className="tabular-nums text-muted-foreground">
        {info.getValue() ?? '—'}
      </span>
    ),
  }),
  columnHelper.accessor('diasConReporte', {
    header: 'Días',
    cell: (info) => (
      <span className="tabular-nums text-muted-foreground">
        {info.getValue()}
      </span>
    ),
  }),
];

export function Proyectos() {
  const [vista, setVista] = useState<'tarjetas' | 'comparacion'>('tarjetas');
  const [periodo, setPeriodo] = useState<Periodo>({
    desde: inicioDeMesISO(),
    hasta: hoyISO(),
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data: proyectos, isLoading, isError } = useProyectos();
  const { data: comparacion, isFetching } = useComparacionProyectos(periodo);

  const filas = useMemo(() => comparacion ?? [], [comparacion]);

  const table = useReactTable({
    data: filas,
    columns: columnas,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyectos"
        description="Avance y desempeño por obra. El avance acumulado es el último valor registrado; producción y cumplimiento se miden sobre el período."
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <Button
              variant={vista === 'tarjetas' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setVista('tarjetas')}
            >
              <LayoutGridIcon />
              Tarjetas
            </Button>
            <Button
              variant={vista === 'comparacion' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setVista('comparacion')}
            >
              <TableIcon />
              Comparación
            </Button>
          </div>
        }
      />

      <FiltroRango
        desde={periodo.desde}
        hasta={periodo.hasta}
        onDesde={(desde) => setPeriodo((p) => ({ ...p, desde }))}
        onHasta={(hasta) => setPeriodo((p) => ({ ...p, hasta }))}
        actualizando={isFetching}
      />

      {isError && (
        <EmptyState
          icon={FolderKanbanIcon}
          title="No se pudieron cargar los proyectos"
          description="Verifica que el backend esté corriendo en http://localhost:3000."
        />
      )}

      {isLoading && <TableSkeleton rows={4} cols={6} />}

      {!isLoading && !isError && (proyectos ?? []).length === 0 && (
        <EmptyState
          icon={FolderKanbanIcon}
          title="Todavía no hay proyectos"
          description="Crea uno con POST /proyecto o cárgalo por SQL para empezar a reportar."
        />
      )}

      {/* ── Vista de tarjetas ── */}
      {!isLoading && !isError && vista === 'tarjetas' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(proyectos ?? []).map((p) => (
            <TarjetaProyecto key={p.id} proyecto={p} periodo={periodo} />
          ))}
        </div>
      )}

      {/* ── Vista de comparación ── */}
      {!isLoading && !isError && vista === 'comparacion' && filas.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Haz clic en una cabecera para ordenar. «Producción prom.» es la
            media de los porcentajes diarios; «Cumplimiento» es el total de
            equipos ejecutados sobre el total programado — no son el mismo
            número.
          </p>
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                    {hg.headers.map((header) => {
                      const orden = header.column.getIsSorted();
                      return (
                        <TableHead key={header.id}>
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex items-center gap-1 uppercase transition-colors hover:text-foreground"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {orden === 'asc' ? (
                              <ArrowUpIcon className="size-3" />
                            ) : orden === 'desc' ? (
                              <ArrowDownIcon className="size-3" />
                            ) : (
                              <ArrowUpDownIcon className="size-3 opacity-40" />
                            )}
                          </button>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
