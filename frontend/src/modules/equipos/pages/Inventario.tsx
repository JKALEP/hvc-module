import { useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  ArrowLeftIcon,
  BoxesIcon,
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  Trash2Icon,
  TriangleAlertIcon,
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
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import { FormularioEquipo } from '@/modules/equipos/components/FormularioEquipo';
import { useArbol } from '@/modules/equipos/hooks/useEquipos';
import {
  useCampos,
  useEquipos,
  useEquipo,
  useCrearEquipo,
  useEditarEquipo,
  useEliminarEquipo,
} from '@/modules/equipos/hooks/useInventario';
import { TIPOS_CON_OPCIONES } from '@/modules/equipos/lib/campos';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { EquipoFila, NodoEstructura } from '@/modules/equipos/types';

/** El árbol como lista plana con sangría, para los <select>. */
function aplanarNodos(
  nodos: NodoEstructura[],
  nivel = 0,
): { id: number; etiqueta: string }[] {
  return nodos.flatMap((n) => [
    { id: n.id, etiqueta: `${'　'.repeat(nivel)}${n.nombre}` },
    ...aplanarNodos(n.hijos, nivel + 1),
  ]);
}

/**
 * El inventario de una organización.
 *
 * Las columnas y los filtros los define la organización, no este
 * archivo: ambos salen de sus campos configurados.
 */
export function Inventario() {
  const { id } = useParams<{ id: string }>();
  const organizacionId = Number(id);
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const nodoId = params.get('nodo') ? Number(params.get('nodo')) : null;

  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda, 300);
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [aBorrar, setABorrar] = useState<EquipoFila | null>(null);

  const { data: campos } = useCampos(organizacionId);
  const { data: arbol } = useArbol(organizacionId);
  const { data, isError } = useEquipos(organizacionId, {
    nodoId,
    q,
    campos: filtros,
  });
  const { data: enEdicion } = useEquipo(editandoId);

  const crear = useCrearEquipo(organizacionId);
  const editar = useEditarEquipo(organizacionId);
  const eliminar = useEliminarEquipo(organizacionId);

  const cargando = !data && !isError;
  const sinCampos =
    campos !== undefined && campos.filter((c) => c.activo).length === 0;

  const cambiarFiltro = (clave: string, valor: string) =>
    setFiltros((f) => {
      const siguiente = { ...f };
      if (valor === '') delete siguiente[clave];
      else siguiente[clave] = valor;
      return siguiente;
    });

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
          title="Inventario"
          description="Los equipos registrados. Las columnas son los campos que configuró esta organización."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navegar(`/equipos/${organizacionId}/campos`)}
              >
                <SettingsIcon />
                Campos
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  navegar(`/equipos/${organizacionId}/incidencias`)
                }
              >
                <TriangleAlertIcon />
                Incidencias
              </Button>
              <Button
                variant="outline"
                onClick={() => navegar(`/equipos/${organizacionId}/documentos`)}
              >
                <FileTextIcon />
                Cotizaciones
              </Button>
              <Button onClick={() => setCreando(true)} disabled={sinCampos}>
                <PlusIcon />
                Nuevo equipo
              </Button>
            </div>
          }
        />
      </div>

      {sinCampos && (
        <EmptyState
          icon={SettingsIcon}
          title="Esta organización todavía no tiene campos"
          description="Configura al menos uno antes de registrar equipos."
        />
      )}

      {/* Filtros: uno fijo de texto y uno por cada campo de lista. */}
      {!sinCampos && (
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
                placeholder="Código o cualquier texto"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">
              Ubicación
            </label>
            <Select
              className="h-9 w-48"
              value={nodoId ?? ''}
              onChange={(e) =>
                setParams(e.target.value ? { nodo: e.target.value } : {})
              }
            >
              <option value="">Todas</option>
              {aplanarNodos(arbol ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {n.etiqueta}
                </option>
              ))}
            </Select>
          </div>

          {/* Un filtro por cada campo de lista: es lo que se filtra de
              verdad, y un desplegable no necesita que nadie adivine el
              texto exacto. */}
          {(campos ?? [])
            .filter((c) => c.activo && TIPOS_CON_OPCIONES.includes(c.tipo))
            .map((c) => (
              <div key={c.id} className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  {c.nombre}
                </label>
                <Select
                  className="h-9 w-44"
                  value={filtros[c.clave] ?? ''}
                  onChange={(e) => cambiarFiltro(c.clave, e.target.value)}
                >
                  <option value="">Todos</option>
                  {c.opciones.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.etiqueta}
                    </option>
                  ))}
                </Select>
              </div>
            ))}

          {data && (
            <p className="pb-2 text-xs text-muted-foreground tabular-nums">
              {data.total} equipo(s)
            </p>
          )}
        </div>
      )}

      {isError && (
        <EmptyState
          icon={BoxesIcon}
          title="No se pudo cargar el inventario"
          description="Verifica que el backend esté corriendo."
        />
      )}

      {cargando && !sinCampos && <TableSkeleton rows={6} cols={6} />}

      {data && data.equipos.length === 0 && !sinCampos && (
        <EmptyState
          icon={BoxesIcon}
          title="Sin equipos"
          description="Registra el primero o prueba con otros filtros."
        />
      )}

      {data && data.equipos.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Código</TableHead>
                <TableHead>Ubicación</TableHead>
                {data.columnas.map((c) => (
                  <TableHead key={c.clave} className="whitespace-nowrap">
                    {c.nombre}
                  </TableHead>
                ))}
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.equipos.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium tabular-nums">
                    {e.codigoInterno ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.nodo.nombre}
                  </TableCell>
                  {data.columnas.map((c) => (
                    <TableCell key={c.clave} className="whitespace-normal">
                      {e.valores[c.clave] || '—'}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ver la ficha de este equipo"
                        title="Ver la ficha de este equipo"
                        onClick={() =>
                          navegar(`/equipos/${organizacionId}/equipo/${e.id}`)
                        }
                      >
                        <FileTextIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ver incidencias de este equipo"
                        title="Ver incidencias de este equipo"
                        onClick={() =>
                          navegar(
                            `/equipos/${organizacionId}/incidencias?equipo=${e.id}`,
                          )
                        }
                      >
                        <TriangleAlertIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editar equipo"
                        title="Editar equipo"
                        onClick={() => setEditandoId(e.id)}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Eliminar equipo"
                        title="Eliminar equipo"
                        onClick={() => setABorrar(e)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {creando && campos && (
        <FormularioEquipo
          campos={campos}
          nodos={arbol ?? []}
          nodoPorDefecto={nodoId}
          ocupado={crear.isPending}
          onCerrar={() => setCreando(false)}
          onGuardar={(datos) =>
            crear.mutate(datos, { onSuccess: () => setCreando(false) })
          }
        />
      )}

      {editandoId !== null && campos && enEdicion && (
        <FormularioEquipo
          campos={campos}
          nodos={arbol ?? []}
          nodoPorDefecto={nodoId}
          equipo={enEdicion}
          ocupado={editar.isPending}
          onCerrar={() => setEditandoId(null)}
          onGuardar={(datos) =>
            editar.mutate(
              { id: editandoId, cambios: datos },
              { onSuccess: () => setEditandoId(null) },
            )
          }
        />
      )}

      {aBorrar && (
        <DialogoConfirmar
          titulo={`¿Eliminar el equipo ${aBorrar.codigoInterno ?? ''}?`}
          mensaje="Se borran también sus valores, fotos, incidencias e historial."
          detalle="Esto NO se puede deshacer."
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
