import { useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  ArrowLeftIcon,
  FileTextIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { Button } from '@/shared/ui/button';
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
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import { FormularioDocumento } from '@/modules/equipos/components/FormularioDocumento';
import { useEquipos } from '@/modules/equipos/hooks/useInventario';
import { useIncidencias } from '@/modules/equipos/hooks/useIncidencias';
import {
  useDocumentos,
  useCrearDocumento,
  useEliminarDocumento,
} from '@/modules/equipos/hooks/useDocumentos';
import {
  ETIQUETA_DOCUMENTO,
  ESTADOS_DOCUMENTO,
  estadoDe,
  dinero,
} from '@/modules/equipos/lib/documentos';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { cn } from '@/shared/lib/utils';
import type {
  TipoDocumento,
  Cotizacion,
  OrdenCompra,
} from '@/modules/equipos/types';

const TIPOS: TipoDocumento[] = ['cotizacion', 'orden-compra'];

/**
 * Cotizaciones y órdenes de compra de una organización.
 *
 * Una sola pantalla con dos pestañas y no dos rutas: son el mismo
 * trabajo —lo que se pidió y lo que se compró— y se consultan uno al
 * lado del otro.
 *
 * El tipo activo va en la URL para que volver atrás regrese a la
 * pestaña de la que se salió.
 */
export function Documentos() {
  const { id } = useParams<{ id: string }>();
  const organizacionId = Number(id);
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();

  const tipo: TipoDocumento =
    params.get('tipo') === 'orden-compra' ? 'orden-compra' : 'cotizacion';

  const [estado, setEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda, 300);
  const [creando, setCreando] = useState(false);
  const [aBorrar, setABorrar] = useState<Cotizacion | OrdenCompra | null>(null);

  const { data, isError } = useDocumentos(organizacionId, tipo, { estado, q });
  const { data: inventario } = useEquipos(organizacionId, {});
  const { data: incidencias } = useIncidencias(organizacionId, {});

  const crear = useCrearDocumento(organizacionId, tipo);
  const eliminar = useEliminarDocumento(organizacionId, tipo);

  const cargando = !data && !isError;
  const etiqueta = ETIQUETA_DOCUMENTO[tipo];

  const cambiarTipo = (t: TipoDocumento) => {
    setEstado(''); // los estados de un tipo no existen en el otro
    setParams({ tipo: t });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/equipos/${organizacionId}/inventario`}
          className="mb-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeftIcon className="size-4" />
          Volver al inventario
        </Link>
        <PageHeader
          title="Cotizaciones y órdenes"
          description="Lo que se pidió y lo que se compró. Cada documento se edita aquí mismo y se exporta al momento."
          actions={
            <Button onClick={() => setCreando(true)}>
              <PlusIcon />
              Nueva {etiqueta.singular.toLowerCase()}
            </Button>
          }
        />
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-border">
        {TIPOS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => cambiarTipo(t)}
            aria-current={t === tipo ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              t === tipo
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {ETIQUETA_DOCUMENTO[t].plural}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">
            Buscar
          </label>
          <div className="flex h-9 w-64 items-center gap-2 rounded-lg border border-input bg-background px-2.5">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Código o proveedor"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">
            Estado
          </label>
          <Select
            className="h-9 w-44"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Todos</option>
            {ESTADOS_DOCUMENTO[tipo].map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </Select>
        </div>

        {data && (
          <p className="pb-2 text-xs text-muted-foreground tabular-nums">
            {data.length} documento(s)
          </p>
        )}
      </div>

      {isError && (
        <EmptyState
          icon={FileTextIcon}
          title="No se pudieron cargar los documentos"
          description="Verifica que el backend esté corriendo."
        />
      )}

      {cargando && <TableSkeleton rows={5} cols={5} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={FileTextIcon}
          title={`Sin ${etiqueta.plural.toLowerCase()}`}
          description="Crea la primera desde el botón de arriba, o prueba con otros filtros."
        />
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right">Líneas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => {
                const e = estadoDe(tipo, d.estado);
                return (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navegar(
                        `/equipos/${organizacionId}/documentos/${tipo}/${d.id}`,
                      )
                    }
                  >
                    <TableCell className="font-medium tabular-nums">
                      {d.codigo}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.variante}>{e.etiqueta}</Badge>
                    </TableCell>
                    <TableCell>{d.proveedor}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.incidencia?.codigo ?? d.equipo?.codigoInterno ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {d.lineas.length}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {dinero(d.total)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {new Date(d.creadoEn).toLocaleDateString('es-PE')}
                    </TableCell>
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${d.codigo}`}
                        onClick={() => setABorrar(d)}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {creando && (
        <FormularioDocumento
          tipo={tipo}
          organizacionId={organizacionId}
          equipos={inventario?.equipos ?? []}
          incidencias={incidencias ?? []}
          ocupado={crear.isPending}
          onGuardar={(datos) =>
            crear.mutate(datos, {
              // Se abre en cuanto existe: las líneas se escriben allí.
              onSuccess: (r) =>
                navegar(
                  `/equipos/${organizacionId}/documentos/${tipo}/${r.id}`,
                ),
            })
          }
          onCerrar={() => setCreando(false)}
        />
      )}

      {aBorrar && (
        <DialogoConfirmar
          titulo={`¿Eliminar ${aBorrar.codigo}?`}
          mensaje="Se borran también sus líneas."
          detalle={
            // Solo las cotizaciones traen el contador de órdenes.
            tipo === 'cotizacion' &&
            ((aBorrar as Cotizacion)._count?.ordenesCompra ?? 0) > 0
              ? `Tiene ${(aBorrar as Cotizacion)._count.ordenesCompra} orden(es) de compra emitida(s). El servidor lo rechazará.`
              : 'Esto NO se puede deshacer.'
          }
          textoConfirmar="Eliminar"
          destructivo
          ocupado={eliminar.isPending}
          onCerrar={() => setABorrar(null)}
          onConfirmar={() =>
            eliminar.mutate(aBorrar.id, { onSuccess: () => setABorrar(null) })
          }
        />
      )}
    </div>
  );
}
