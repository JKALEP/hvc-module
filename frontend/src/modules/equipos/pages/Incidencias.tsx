import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Select } from '@/shared/ui/select';
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import { FormularioIncidencia } from '@/modules/equipos/components/FormularioIncidencia';
import { useEquipos } from '@/modules/equipos/hooks/useInventario';
import {
  useIncidencias,
  useCrearIncidencia,
  useEditarIncidencia,
  useEliminarIncidencia,
  useHistorialIncidencia,
} from '@/modules/equipos/hooks/useIncidencias';
import {
  ETIQUETA_ESTADO_INCIDENCIA,
  VARIANTE_ESTADO_INCIDENCIA,
  SIGUIENTE_ESTADO,
} from '@/modules/equipos/lib/incidencias';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { cn } from '@/shared/lib/utils';
import type { Incidencia } from '@/modules/equipos/types';

/** La bitácora de una incidencia, dentro de su fila desplegada. */
function Bitacora({ incidenciaId }: { incidenciaId: number }) {
  const { data, isLoading } = useHistorialIncidencia(incidenciaId);

  if (isLoading)
    return <p className="text-sm text-muted-foreground">Cargando bitácora…</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-muted-foreground">Sin movimientos.</p>;

  return (
    <ol className="space-y-1.5">
      {data.map((e) => (
        <li key={e.id} className="flex flex-wrap gap-x-2 text-xs">
          <span className="text-muted-foreground tabular-nums">
            {new Date(e.creadoEn).toLocaleString('es-PE')}
          </span>
          <span className="text-foreground">
            {e.descripcion ??
              (e.campoAfectado
                ? `${e.campoAfectado}: ${e.valorAnterior ?? '(vacío)'} → ${e.valorNuevo ?? '(vacío)'}`
                : `${e.valorAnterior ?? ''} → ${e.valorNuevo ?? ''}`)}
          </span>
          {e.usuario && (
            <span className="text-muted-foreground">· {e.usuario.nombre}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * Las incidencias de una organización.
 *
 * Ordenadas con las abiertas primero: lo que falta por atender es lo que
 * hay que ver al entrar.
 */
export function Incidencias() {
  const { id } = useParams<{ id: string }>();
  const organizacionId = Number(id);
  const [params] = useSearchParams();
  const equipoDeUrl = params.get('equipo')
    ? Number(params.get('equipo'))
    : null;

  const [estado, setEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda, 300);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Incidencia | null>(null);
  const [aBorrar, setABorrar] = useState<Incidencia | null>(null);

  const { data, isError } = useIncidencias(organizacionId, {
    estado,
    equipoId: equipoDeUrl,
    q,
  });
  const { data: inventario } = useEquipos(organizacionId, {});

  const crear = useCrearIncidencia(organizacionId);
  const editar = useEditarIncidencia(organizacionId);
  const eliminar = useEliminarIncidencia(organizacionId);

  const cargando = !data && !isError;

  // Las sugerencias de tipo y prioridad salen de lo ya escrito: la lista
  // se forma sola sin que nadie tenga que configurar un catálogo.
  const { tipos, prioridades } = useMemo(() => {
    const t = new Set<string>();
    const p = new Set<string>();
    for (const i of data ?? []) {
      t.add(i.tipo);
      if (i.prioridad) p.add(i.prioridad);
    }
    return { tipos: [...t].sort(), prioridades: [...p].sort() };
  }, [data]);

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
          title="Incidencias"
          description="Lo que le pasó a cada equipo y en qué quedó. Las abiertas van primero."
          actions={
            <Button
              onClick={() => setCreando(true)}
              disabled={(inventario?.equipos.length ?? 0) === 0}
            >
              <PlusIcon />
              Nueva incidencia
            </Button>
          }
        />
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
              placeholder="Código, tipo o descripción"
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
            <option value="ABIERTA">Abierta</option>
            <option value="EN_ATENCION">En atención</option>
            <option value="CERRADA">Cerrada</option>
          </Select>
        </div>

        {data && (
          <p className="pb-2 text-xs text-muted-foreground tabular-nums">
            {data.length} incidencia(s)
          </p>
        )}
      </div>

      {isError && (
        <EmptyState
          icon={TriangleAlertIcon}
          title="No se pudieron cargar las incidencias"
          description="Verifica que el backend esté corriendo."
        />
      )}

      {cargando && <TableSkeleton rows={5} cols={4} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={TriangleAlertIcon}
          title="Sin incidencias"
          description="Abre la primera desde el botón de arriba, o prueba con otros filtros."
        />
      )}

      <div className="space-y-2">
        {(data ?? []).map((i) => (
          <div key={i.id} className="rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => setAbierta((a) => (a === i.id ? null : i.id))}
                aria-expanded={abierta === i.id}
                aria-label="Ver bitácora"
                className="rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChevronRightIcon
                  className={cn(
                    'size-4 text-muted-foreground transition-transform',
                    abierta === i.id && 'rotate-90',
                  )}
                />
              </button>

              <span className="font-medium tabular-nums text-foreground">
                {i.codigo}
              </span>
              <Badge variant={VARIANTE_ESTADO_INCIDENCIA[i.estado]}>
                {ETIQUETA_ESTADO_INCIDENCIA[i.estado]}
              </Badge>
              <Badge variant="secondary">{i.tipo}</Badge>
              {i.prioridad && <Badge variant="outline">{i.prioridad}</Badge>}

              <span className="text-sm text-muted-foreground">
                {i.equipo.codigoInterno ?? `Equipo ${i.equipo.id}`} ·{' '}
                {i.equipo.nodo.nombre}
              </span>

              <div className="ml-auto flex shrink-0 items-center gap-1">
                {SIGUIENTE_ESTADO[i.estado] && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={editar.isPending}
                    onClick={() =>
                      editar.mutate({
                        id: i.id,
                        equipoId: i.equipoId,
                        cambios: { estado: SIGUIENTE_ESTADO[i.estado]! },
                      })
                    }
                  >
                    <ArrowRightIcon />
                    {ETIQUETA_ESTADO_INCIDENCIA[SIGUIENTE_ESTADO[i.estado]!]}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar ${i.codigo}`}
                  title={`Editar ${i.codigo}`}
                  onClick={() => setEditando(i)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Eliminar ${i.codigo}`}
                  title={`Eliminar ${i.codigo}`}
                  onClick={() => setABorrar(i)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>

            <p className="px-4 pb-3 text-sm whitespace-normal text-muted-foreground">
              {i.descripcion}
              {i.recomendacion && (
                <span className="mt-1 block">
                  <span className="font-medium text-foreground">
                    Recomendación:{' '}
                  </span>
                  {i.recomendacion}
                </span>
              )}
            </p>

            {abierta === i.id && (
              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <Bitacora incidenciaId={i.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {creando && (
        <FormularioIncidencia
          equipos={inventario?.equipos ?? []}
          equipoFijo={equipoDeUrl ?? undefined}
          tiposUsados={tipos}
          prioridadesUsadas={prioridades}
          ocupado={crear.isPending}
          onCerrar={() => setCreando(false)}
          onGuardar={(datos) =>
            crear.mutate(datos, { onSuccess: () => setCreando(false) })
          }
        />
      )}

      {editando && (
        <FormularioIncidencia
          equipos={inventario?.equipos ?? []}
          incidencia={editando}
          tiposUsados={tipos}
          prioridadesUsadas={prioridades}
          ocupado={editar.isPending}
          onCerrar={() => setEditando(null)}
          onGuardar={(datos) =>
            editar.mutate(
              { id: editando.id, equipoId: editando.equipoId, cambios: datos },
              { onSuccess: () => setEditando(null) },
            )
          }
        />
      )}

      {aBorrar && (
        <DialogoConfirmar
          titulo={`¿Eliminar ${aBorrar.codigo}?`}
          mensaje="Se borran también sus fotos y su bitácora."
          detalle={
            aBorrar._count.cotizaciones + aBorrar._count.ordenesCompra > 0
              ? `Tiene ${aBorrar._count.cotizaciones} cotización(es) y ${aBorrar._count.ordenesCompra} orden(es) asociadas. El servidor lo rechazará.`
              : 'Esto NO se puede deshacer. Para conservar el registro, ciérrala en vez de borrarla.'
          }
          textoConfirmar="Eliminar"
          destructivo
          ocupado={eliminar.isPending}
          onCerrar={() => setABorrar(null)}
          onConfirmar={() =>
            eliminar.mutate(
              { id: aBorrar.id, equipoId: aBorrar.equipoId },
              { onSuccess: () => setABorrar(null) },
            )
          }
        />
      )}
    </div>
  );
}
