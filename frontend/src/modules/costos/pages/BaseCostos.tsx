import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { SearchIcon, PackageIcon } from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/shared/ui/table';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { useBaseCostos } from '@/modules/costos/hooks/useBaseCostos';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/shared/lib/constants';
import { formatPrecio, formatFecha, orDash } from '@/shared/lib/format';
import type { FilaBaseCostos } from '@/modules/costos/types';

const columnHelper = createColumnHelper<FilaBaseCostos>();

const columns = [
  columnHelper.accessor('requerimientoNumero', {
    header: 'Requerimiento',
    cell: (info) => (
      <span className="font-medium tabular-nums text-foreground">
        {orDash(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('descripcion', {
    header: 'Descripción',
    cell: (info) => <span className="whitespace-normal">{info.getValue()}</span>,
  }),
  columnHelper.accessor('unidad', { header: 'Unidad' }),
  columnHelper.accessor('cantidad', {
    header: 'Cantidad',
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  columnHelper.accessor('detalleObservacion', {
    header: 'Detalle',
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
  columnHelper.accessor('costoUnitario', {
    header: 'Costo unit.',
    cell: (info) => (
      <span className="font-medium tabular-nums">
        {formatPrecio(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('costoTotal', {
    header: 'Total',
    cell: (info) => (
      <span className="font-medium tabular-nums">
        {formatPrecio(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('proveedor', { header: 'Proveedor' }),
  columnHelper.accessor('proveedorRuc', {
    header: 'RUC',
    cell: (info) => (
      <span className="tabular-nums text-muted-foreground">
        {orDash(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('cliente', {
    header: 'Cliente',
    cell: (info) => (
      <span className="text-muted-foreground">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('registradoEn', {
    header: 'Registrado',
    cell: (info) => (
      <span className="text-muted-foreground">
        {formatFecha(info.getValue())}
      </span>
    ),
  }),
];

/**
 * La Base de Costos (§52).
 *
 * Era la «Tabla Maestra», que listaba filas de Excel a medio llenar. Ahora
 * cada fila es un costo realmente registrado y arrastra consigo su
 * requerimiento, su proveedor y su cliente.
 *
 * El estado de carga se deriva de `!data && !isError` y no de
 * `isLoading`: una consulta que reintenta —o que se queda pausada porque
 * el navegador se cree sin red— deja de estar «cargando» sin haber
 * traído nada, y entonces la pantalla afirmaría «no hay costos» cuando
 * en realidad no lo sabe. Mismo criterio que las pantallas de Fotos.
 */
export function BaseCostos() {
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const debouncedQ = useDebounce(q, SEARCH_DEBOUNCE_MS);

  const { data, isFetching, isError } = useBaseCostos(debouncedQ, pagina);

  const filas = useMemo(() => data?.filas ?? [], [data]);

  const table = useReactTable({
    data: filas,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const cargando = !data && !isError;
  const ultimaPagina = data ? Math.ceil(data.total / data.porPagina) : 1;

  // Buscar reinicia la paginación: la página 4 de otra búsqueda no existe.
  const buscar = (valor: string) => {
    setQ(valor);
    setPagina(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de costos"
        description="Histórico de lo que se ha pagado. Busca por descripción, proveedor o RUC."
      />

      <div className="relative max-w-md">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => buscar(e.target.value)}
          placeholder="Buscar por descripción, proveedor o RUC…"
          className="h-9 pl-9"
        />
        {isFetching && (
          <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>

      {cargando && <TableSkeleton rows={8} cols={8} />}

      {isError && (
        <EmptyState
          icon={PackageIcon}
          title="No se pudo cargar la base de costos"
          description="Verifica que el backend esté corriendo en http://localhost:3000."
        />
      )}

      {data && filas.length === 0 && (
        <EmptyState
          icon={PackageIcon}
          title={
            debouncedQ
              ? `Sin resultados para "${debouncedQ}"`
              : 'Todavía no hay costos registrados'
          }
          description={
            debouncedQ
              ? 'Prueba con otro término de búsqueda.'
              : 'Cuando se apruebe un requerimiento y se registre su costo, aparecerá aquí.'
          }
        />
      )}

      {data && filas.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-border">
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

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {data.total} línea(s) · página {data.pagina} de {ultimaPagina}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina >= ultimaPagina}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
