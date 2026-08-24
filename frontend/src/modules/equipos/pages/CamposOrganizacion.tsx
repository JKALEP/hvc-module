import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ListChecksIcon,
  PlusIcon,
  PowerIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import {
  useCampos,
  useCrearCampo,
  useEditarCampo,
  useEliminarCampo,
  useAgregarOpcion,
  useEliminarOpcion,
} from '@/modules/equipos/hooks/useInventario';
import {
  ETIQUETA_TIPO,
  TIPOS_ORDENADOS,
  TIPOS_CON_OPCIONES,
} from '@/modules/equipos/lib/campos';
import type { DefinicionCampo, TipoCampo } from '@/modules/equipos/types';

/** Alta de un campo. Privado de esta pantalla. */
function DialogoCampo({
  ocupado,
  onCrear,
  onCerrar,
}: {
  ocupado: boolean;
  onCrear: (v: {
    nombre: string;
    tipo: TipoCampo;
    obligatorio: boolean;
    opciones?: string[];
  }) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoCampo>('TEXTO');
  const [obligatorio, setObligatorio] = useState(false);
  const [opciones, setOpciones] = useState<string[]>([]);
  const [nueva, setNueva] = useState('');

  const necesitaOpciones = TIPOS_CON_OPCIONES.includes(tipo);
  const falta =
    nombre.trim() === '' || (necesitaOpciones && opciones.length === 0);

  const agregar = () => {
    const v = nueva.trim();
    if (v && !opciones.includes(v)) setOpciones((o) => [...o, v]);
    setNueva('');
  };

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo campo</DialogTitle>
          <DialogDescription>
            Se pedirá al registrar cada equipo de esta organización. El tipo no
            se puede cambiar después.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Nombre <span className="text-destructive">*</span>
            </label>
            <Input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Marca"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Tipo <span className="text-destructive">*</span>
            </label>
            <Select
              className="h-9"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoCampo)}
            >
              {TIPOS_ORDENADOS.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={obligatorio}
              onChange={(e) => setObligatorio(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Obligatorio al registrar un equipo
          </label>

          {necesitaOpciones && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Opciones <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregar();
                    }
                  }}
                  placeholder="Carrier"
                  className="h-9"
                />
                <Button variant="outline" onClick={agregar}>
                  Agregar
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {opciones.map((o) => (
                  <Badge key={o} variant="secondary">
                    {o}
                    <button
                      type="button"
                      onClick={() =>
                        setOpciones((xs) => xs.filter((x) => x !== o))
                      }
                      aria-label={`Quitar ${o}`}
                      className="ml-1 outline-none"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={falta || ocupado}
            onClick={() =>
              onCrear({
                nombre: nombre.trim(),
                tipo,
                obligatorio,
                opciones: necesitaOpciones ? opciones : undefined,
              })
            }
          >
            {ocupado ? <Spinner /> : <PlusIcon />}
            Crear campo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Los campos que una organización pide de cada equipo.
 *
 * Configurarlos es el paso previo a poder registrar inventario: el
 * formulario de alta se arma leyendo esta lista en su orden.
 */
export function CamposOrganizacion() {
  const { id } = useParams<{ id: string }>();
  const organizacionId = Number(id);

  const { data: campos, isError } = useCampos(organizacionId);
  const crear = useCrearCampo(organizacionId);
  const editar = useEditarCampo(organizacionId);
  const eliminar = useEliminarCampo(organizacionId);
  const agregarOpcion = useAgregarOpcion(organizacionId);
  const eliminarOpcion = useEliminarOpcion(organizacionId);

  const [creando, setCreando] = useState(false);
  const [aBorrar, setABorrar] = useState<DefinicionCampo | null>(null);
  const [nuevaOpcion, setNuevaOpcion] = useState<Record<number, string>>({});

  const cargando = !campos && !isError;

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
          title="Campos del inventario"
          description="Lo que se pedirá de cada equipo. El orden aquí es el orden del formulario y de las columnas de la tabla."
          actions={
            <Button onClick={() => setCreando(true)}>
              <PlusIcon />
              Nuevo campo
            </Button>
          }
        />
      </div>

      {isError && (
        <EmptyState
          icon={ListChecksIcon}
          title="No se pudieron cargar los campos"
          description="Verifica que el backend esté corriendo."
        />
      )}

      {cargando && <TableSkeleton rows={4} cols={3} />}

      {campos && campos.length === 0 && (
        <EmptyState
          icon={ListChecksIcon}
          title="Sin campos configurados"
          description="Crea el primero. Hasta que haya al menos uno no se pueden registrar equipos."
        />
      )}

      <div className="space-y-3">
        {(campos ?? []).map((c) => (
          <div
            key={c.id}
            className="space-y-2 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{c.nombre}</span>
              <Badge variant="secondary">{ETIQUETA_TIPO[c.tipo]}</Badge>
              {c.obligatorio && <Badge variant="warning">Obligatorio</Badge>}
              {!c.activo && <Badge variant="outline">Inactivo</Badge>}
              <code className="text-xs text-muted-foreground">{c.clave}</code>
              {c._count.valores > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {c._count.valores} equipo(s) con valor
                </span>
              )}

              <div className="ml-auto flex gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={
                    c.activo
                      ? 'Desactivar: deja de pedirse, sin perder lo capturado'
                      : 'Activar'
                  }
                  aria-label={
                    c.activo ? `Desactivar ${c.nombre}` : `Activar ${c.nombre}`
                  }
                  onClick={() =>
                    editar.mutate({ id: c.id, cambios: { activo: !c.activo } })
                  }
                >
                  <PowerIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Eliminar ${c.nombre}`}
                  title={`Eliminar ${c.nombre}`}
                  onClick={() => setABorrar(c)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>

            {TIPOS_CON_OPCIONES.includes(c.tipo) && (
              <div className="space-y-1.5 border-t border-border pt-2">
                <div className="flex flex-wrap gap-1.5">
                  {c.opciones.map((o) => (
                    <Badge
                      key={o.id}
                      variant={o.activo ? 'secondary' : 'outline'}
                    >
                      {o.etiqueta}
                      <button
                        type="button"
                        onClick={() => eliminarOpcion.mutate(o.id)}
                        aria-label={`Quitar ${o.etiqueta}`}
                        className="ml-1 outline-none"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={nuevaOpcion[c.id] ?? ''}
                    onChange={(e) =>
                      setNuevaOpcion((n) => ({ ...n, [c.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      const etiqueta = (nuevaOpcion[c.id] ?? '').trim();
                      if (!etiqueta) return;
                      agregarOpcion.mutate(
                        { campoId: c.id, etiqueta },
                        {
                          onSuccess: () =>
                            setNuevaOpcion((n) => ({ ...n, [c.id]: '' })),
                        },
                      );
                    }}
                    placeholder="Agregar opción y pulsar Enter"
                    className="h-8 max-w-xs"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {creando && (
        <DialogoCampo
          ocupado={crear.isPending}
          onCerrar={() => setCreando(false)}
          onCrear={(v) =>
            crear.mutate(v, { onSuccess: () => setCreando(false) })
          }
        />
      )}

      {aBorrar && (
        <DialogoConfirmar
          titulo={`¿Eliminar el campo "${aBorrar.nombre}"?`}
          mensaje="Deja de pedirse y se borran los valores que tenga."
          detalle={
            aBorrar._count.valores > 0
              ? `${aBorrar._count.valores} equipo(s) tienen un valor suyo. El servidor lo rechazará: desactívalo en su lugar y dejará de pedirse sin perder lo capturado.`
              : undefined
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
