import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { SearchIcon, PackageIcon } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useMaestro } from '@/hooks/useMaestro';
import { useDebounce } from '@/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import { formatPrecio, orDash } from '@/lib/format';
import type { Producto } from '@/types/models';

const columnHelper = createColumnHelper<Producto>();

const columns = [
  columnHelper.accessor('codigo', {
    header: 'Código',
    cell: (info) => (
      <span className="font-medium text-foreground">
        {orDash(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('descripcion', {
    header: 'Descripción',
    cell: (info) => (
      <span className="whitespace-normal">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('unidadMedida', {
    header: 'Unidad',
    cell: (info) => orDash(info.getValue()),
  }),
  columnHelper.accessor('detalles', {
    header: 'Detalles',
    cell: (info) => (
      <span className="whitespace-normal text-muted-foreground">
        {orDash(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('referencias', {
    header: 'Referencias',
    cell: (info) => (
      <span className="text-muted-foreground">{orDash(info.getValue())}</span>
    ),
  }),
  columnHelper.accessor('precioUnitario', {
    header: 'Precio Unit.',
    cell: (info) => (
      <span className="font-medium tabular-nums">
        {formatPrecio(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('proveedor', {
    header: 'Proveedor',
    cell: (info) => orDash(info.getValue()),
  }),
  columnHelper.accessor('ruc', {
    header: 'RUC',
    cell: (info) => (
      <span className="tabular-nums text-muted-foreground">
        {orDash(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('estado', {
    header: 'Estado',
    cell: (info) => <EstadoBadge estado={info.getValue()} />,
  }),
];

export function Maestro() {
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q, SEARCH_DEBOUNCE_MS);
  const { data, isLoading, isFetching, isError } = useMaestro(debouncedQ);

  const productos = useMemo(() => data ?? [], [data]);

  const table = useReactTable({
    data: productos,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tabla Maestra"
        description="Consulta de productos. Busca por descripción, proveedor o RUC."
      />

      {/* Buscador con lupa */}
      <div className="relative max-w-md">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por descripción, proveedor o RUC…"
          className="h-9 pl-9"
        />
        {isFetching && (
          <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>

      {isLoading && <TableSkeleton rows={8} cols={6} />}

      {isError && (
        <EmptyState
          icon={PackageIcon}
          title="No se pudo cargar la tabla maestra"
          description="Verifica que el backend esté corriendo en http://localhost:3000."
        />
      )}

      {!isLoading && !isError && productos.length === 0 && (
        <EmptyState
          icon={PackageIcon}
          title={
            debouncedQ
              ? `Sin resultados para "${debouncedQ}"`
              : 'La tabla maestra está vacía'
          }
          description={
            debouncedQ
              ? 'Prueba con otro término de búsqueda.'
              : 'Importa y completa productos para verlos aquí.'
          }
        />
      )}

      {!isLoading && !isError && productos.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                  {hg.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
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
      )}
    </div>
  );
}
