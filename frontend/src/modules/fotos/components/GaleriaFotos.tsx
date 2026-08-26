import { useState } from 'react';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FolderInputIcon,
  ImagesIcon,
  MessageCircleIcon,
  PencilIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { Spinner } from '@/shared/ui/spinner';
import { Dialog, DialogContent } from '@/shared/ui/dialog';
import {
  useEliminarFoto,
  useEditarDescripcionFoto,
  useMoverFoto,
} from '@/modules/fotos/hooks/useFotos';
import { DialogoMoverFoto } from './DialogoMoverFoto';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { Textarea } from '@/shared/ui/textarea';
import { descargarFoto } from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { formatFecha, formatFechaCorta } from '@/shared/lib/format';
import { HiloComentarios } from './HiloComentarios';
import { alcanza } from '@/modules/fotos/lib/permisos';
import { cn } from '@/shared/lib/utils';
import type { FotoDeGaleria, PermisoCarpeta } from '@/modules/fotos/types';

/** Tamaño legible de un archivo. */
function formatPeso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────
// Miniatura en grilla (grid de fotos «planas», y grid de tarjetas)
// ─────────────────────────────────────────────────────────────

function MiniaturaFoto({
  foto,
  alt,
  activa = false,
  puedeBorrar,
  borrando,
  onAbrir,
  onBorrarRapido,
}: {
  foto: FotoDeGaleria;
  alt: string;
  activa?: boolean;
  puedeBorrar: boolean;
  borrando: boolean;
  onAbrir: () => void;
  onBorrarRapido: () => void;
}) {
  return (
    <div
      className={cn(
        'group/foto relative aspect-square shrink-0 overflow-hidden rounded-lg border-2 bg-muted',
        activa ? 'border-primary' : 'border-transparent',
      )}
    >
      <button
        type="button"
        onClick={onAbrir}
        className="block size-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <img
          src={foto.urlMiniatura}
          alt={alt}
          loading="lazy"
          className="size-full object-cover transition-transform group-hover/foto:scale-[1.03]"
        />
      </button>

      {puedeBorrar && (
        <button
          type="button"
          aria-label="Eliminar esta foto"
          title="Eliminar esta foto"
          disabled={borrando}
          onClick={(e) => {
            e.stopPropagation();
            onBorrarRapido();
          }}
          className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 outline-none transition-opacity hover:bg-destructive focus-visible:opacity-100 group-hover/foto:opacity-100 disabled:opacity-50"
        >
          {borrando ? (
            <Spinner className="size-3" />
          ) : (
            <XIcon className="size-3" />
          )}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Visor con panel dividido: foto grande + miniaturas a la izquierda,
// comentarios de la foto activa a la derecha. Es la MISMA ventana tanto
// para «entrar a un álbum» como para abrir una foto suelta desde la
// pestaña «Fotos» — solo cambia qué lista de fotos recibe.
// ─────────────────────────────────────────────────────────────

function VisorFotoDialog({
  titulo,
  fotos,
  indiceInicial,
  puedeSubir,
  puedeBorrar,
  permiso,
  ramaCerrada,
  portal,
  onEditarAlbum,
  onCerrar,
  onCambio,
}: {
  /** Nombre del álbum, si viene de uno. Sin álbum no hay cabecera de título. */
  titulo?: string;
  fotos: FotoDeGaleria[];
  indiceInicial: number;
  /** Si viene de un álbum concreto, habilita «Añadir fotos» abajo. */
  puedeSubir: boolean;
  puedeBorrar: (f: FotoDeGaleria) => boolean;
  permiso: PermisoCarpeta | null;
  ramaCerrada: boolean;
  portal: boolean;
  onEditarAlbum?: () => void;
  onCerrar: () => void;
  /** Avisa al padre cada vez que la lista cambia (borrado o movido). */
  onCambio?: (fotos: FotoDeGaleria[]) => void;
}) {
  const [lista, setLista] = useState(fotos);
  const [indice, setIndice] = useState(indiceInicial);
  const [borrador, setBorrador] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [borrandoId, setBorrandoId] = useState<number | null>(null);
  const { usuario } = useAuth();

  const eliminar = useEliminarFoto();
  const editarDescripcion = useEditarDescripcionFoto();
  const mover = useMoverFoto();

  const activa = lista[indice] ?? null;

  const actualizar = (next: FotoDeGaleria[]) => {
    setLista(next);
    onCambio?.(next);
  };

  const irA = (i: number) => {
    setIndice(i);
    setBorrador(null);
  };

  const siguiente = () => irA(indice + 1 >= lista.length ? 0 : indice + 1);
  const anterior = () => irA(indice - 1 < 0 ? lista.length - 1 : indice - 1);

  const borrarFoto = (f: FotoDeGaleria) => {
    if (!window.confirm('¿Eliminar esta foto? No se puede deshacer.')) return;
    setBorrandoId(f.id);
    eliminar.mutate(f.id, {
      onSuccess: () => {
        const next = lista.filter((x) => x.id !== f.id);
        if (next.length === 0) {
          actualizar(next);
          onCerrar();
          return;
        }
        setIndice((i) => Math.min(i, next.length - 1));
        actualizar(next);
      },
      onSettled: () => setBorrandoId(null),
    });
  };

  const descargar = async () => {
    if (!activa) return;
    setDescargando(true);
    try {
      const { url } = await descargarFoto(activa.id, portal);
      window.location.assign(url);
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo descargar la foto'));
    } finally {
      setDescargando(false);
    }
  };

  if (!activa) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-6xl">
        {titulo && (
          <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
            <div className="min-w-0">
              <h3 className="truncate font-medium text-foreground" title={titulo}>
                {titulo}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                Foto {indice + 1} de {lista.length}
              </p>
            </div>
            {onEditarAlbum && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Editar álbum"
                title="Editar álbum"
                onClick={onEditarAlbum}
              >
                <PencilIcon />
              </Button>
            )}
          </div>
        )}

        {/* Panel dividido: foto grande + miniaturas a la izquierda,
            comentarios de la foto activa a la derecha — siempre visibles,
            sin tener que desplegar nada. */}
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="relative flex max-h-[52vh] items-center justify-center overflow-hidden rounded-lg bg-muted">
              <img
                src={activa.url}
                alt=""
                className="max-h-[52vh] w-full object-contain"
              />

              {lista.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Foto anterior"
                    onClick={anterior}
                    className="absolute top-1/2 left-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white outline-none hover:bg-black/70"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Foto siguiente"
                    onClick={siguiente}
                    className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white outline-none hover:bg-black/70"
                  >
                    <ChevronRightIcon className="size-4" />
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {activa.subidaPor && (
                <span className="flex items-center gap-1">
                  <UserIcon className="size-3.5" />
                  {activa.subidaPor.nombre}
                </span>
              )}
              <span>Subida el {formatFecha(activa.creadoEn)}</span>
              {activa.tomadaEn && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="size-3.5" />
                  Tomada el {formatFechaCorta(activa.tomadaEn)}
                </span>
              )}
              <span className="tabular-nums">
                {activa.anchoPx}×{activa.altoPx} px · {formatPeso(activa.bytes)}
              </span>
            </div>

            {borrador === null ? (
              <div className="flex items-start justify-between gap-3">
                <p
                  className={
                    activa.descripcion
                      ? 'text-sm text-foreground'
                      : 'text-sm text-muted-foreground'
                  }
                >
                  {activa.descripcion || 'Sin descripción.'}
                </p>
                {puedeSubir && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Editar la descripción de la foto"
                    title="Editar descripción"
                    onClick={() => setBorrador(activa.descripcion ?? '')}
                  >
                    <PencilIcon />
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={borrador}
                  autoFocus
                  placeholder="Qué muestra esta foto"
                  onChange={(e) => setBorrador(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBorrador(null)}
                    disabled={editarDescripcion.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    disabled={editarDescripcion.isPending}
                    onClick={() =>
                      editarDescripcion.mutate(
                        {
                          fotoId: activa.id,
                          descripcion: borrador.trim() || null,
                        },
                        {
                          onSuccess: (r) => {
                            actualizar(
                              lista.map((f) =>
                                f.id === activa.id
                                  ? { ...f, descripcion: r.descripcion }
                                  : f,
                              ),
                            );
                            setBorrador(null);
                          },
                        },
                      )
                    }
                  >
                    {editarDescripcion.isPending && <Spinner />}
                    Guardar
                  </Button>
                </div>
              </div>
            )}

            {/* Miniaturas — clic cambia la foto activa sin cerrar la
                ventana. X al pasar el cursor, para borrar sin tener que
                activarla primero. */}
            {lista.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {lista.map((f, i) => (
                  <div key={f.id} className="size-16 shrink-0">
                    <MiniaturaFoto
                      foto={f}
                      alt=""
                      activa={i === indice}
                      puedeBorrar={puedeBorrar(f)}
                      borrando={borrandoId === f.id}
                      onAbrir={() => irA(i)}
                      onBorrarRapido={() => borrarFoto(f)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              {puedeSubir && (
                <Button
                  variant="outline"
                  onClick={() => setMoviendo(true)}
                  disabled={mover.isPending}
                >
                  <FolderInputIcon />
                  Mover
                </Button>
              )}
              {puedeBorrar(activa) && (
                <Button
                  variant="destructive"
                  disabled={eliminar.isPending}
                  onClick={() => borrarFoto(activa)}
                >
                  {eliminar.isPending ? <Spinner /> : <Trash2Icon />}
                  Eliminar
                </Button>
              )}
              <Button disabled={descargando} onClick={() => void descargar()}>
                <DownloadIcon />
                Descargar
              </Button>
            </div>

          </div>

          {/* Comentarios de LA FOTO que se está viendo, siempre visibles
              al costado — no hay que desplegar nada para verlos. */}
          <div className="flex max-h-[70vh] min-h-0 flex-col rounded-lg bg-muted/30 p-3">
            <h4 className="mb-2 flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
              <MessageCircleIcon className="size-4" />
              Comentarios de esta foto
            </h4>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <HiloComentarios
                entidad="foto"
                entidadId={activa.id}
                permiso={permiso}
                ramaCerrada={ramaCerrada}
                portal={portal}
              />
            </div>
          </div>
        </div>
      </DialogContent>

      {moviendo && (
        <DialogoMoverFoto
          esMia={activa.subidaPor?.id === usuario?.id}
          moviendo={mover.isPending}
          onMover={(destino) =>
            mover.mutate(
              { fotoId: activa.id, destino },
              {
                onSuccess: () => {
                  setMoviendo(false);
                  const next = lista.filter((x) => x.id !== activa.id);
                  if (next.length === 0) {
                    actualizar(next);
                    onCerrar();
                    return;
                  }
                  setIndice((i) => Math.min(i, next.length - 1));
                  actualizar(next);
                },
              },
            )
          }
          onCerrar={() => setMoviendo(false)}
        />
      )}
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Tarjetas de álbum — pestaña «Álbumes»
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// La galería de una VISITA
//
// ⚠️ Aquí había también `TarjetaAlbum`, `GrillaDeAlbumes` y
// `DetalleAlbumDialog`: la pestaña «Álbumes» y su detalle. Se fueron con los
// álbumes en la Fase 4 del rediseño. La galería plana era la otra pestaña y
// es la que queda, porque es la que sigue teniendo sentido: las fotos de la
// visita que se está mirando.
// ─────────────────────────────────────────────────────────────

export function GaleriaDeFotos({
  fotos,
  cargando,
  hayMas,
  cargandoMas,
  onCargarMas,
  puedeBorrar,
  permiso = null,
  ramaCerrada = false,
  portal = false,
  vacio,
}: {
  fotos: FotoDeGaleria[];
  cargando: boolean;
  hayMas: boolean;
  cargandoMas: boolean;
  onCargarMas: () => void;
  puedeBorrar: (f: FotoDeGaleria) => boolean;
  permiso?: PermisoCarpeta | null;
  ramaCerrada?: boolean;
  portal?: boolean;
  vacio: { titulo: string; descripcion?: string };
}) {
  const puedeSubir = !portal && alcanza(permiso, 'EDICION') && !ramaCerrada;
  const [indiceAbierto, setIndiceAbierto] = useState<number | null>(null);
  const [ocultas, setOcultas] = useState<Set<number>>(new Set());
  const [borrandoId, setBorrandoId] = useState<number | null>(null);
  const eliminar = useEliminarFoto();

  const todasLasFotos = fotos.filter((f) => !ocultas.has(f.id));

  const borrarRapido = (f: FotoDeGaleria) => {
    if (!window.confirm('¿Eliminar esta foto? No se puede deshacer.')) return;
    setBorrandoId(f.id);
    eliminar.mutate(f.id, {
      onSuccess: () => setOcultas((prev) => new Set(prev).add(f.id)),
      onSettled: () => setBorrandoId(null),
    });
  };

  if (cargando)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-lg" />
        ))}
      </div>
    );

  if (todasLasFotos.length === 0)
    return (
      <EmptyState
        icon={ImagesIcon}
        title={vacio.titulo}
        description={vacio.descripcion}
      />
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {todasLasFotos.map((f, i) => (
          <MiniaturaFoto
            key={f.id}
            foto={f}
            alt=""
            puedeBorrar={puedeBorrar(f)}
            borrando={borrandoId === f.id}
            onAbrir={() => setIndiceAbierto(i)}
            onBorrarRapido={() => borrarRapido(f)}
          />
        ))}
      </div>

      {hayMas && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onCargarMas} disabled={cargandoMas}>
            {cargandoMas && <Spinner />}
            Cargar más fotos
          </Button>
        </div>
      )}

      {indiceAbierto !== null && (
        <VisorFotoDialog
          fotos={todasLasFotos}
          indiceInicial={indiceAbierto}
          puedeSubir={puedeSubir}
          puedeBorrar={puedeBorrar}
          permiso={permiso}
          ramaCerrada={ramaCerrada}
          portal={portal}
          onCerrar={() => setIndiceAbierto(null)}
          onCambio={(next) => {
            // Lo que salió de `next` respecto a lo que se le pasó, se
            // oculta también aquí: mismo criterio que el borrado rápido.
            const idsQueQuedan = new Set(next.map((f) => f.id));
            const idsQueSalieron = todasLasFotos
              .filter((f) => !idsQueQuedan.has(f.id))
              .map((f) => f.id);
            if (idsQueSalieron.length > 0) {
              setOcultas((prev) => {
                const s = new Set(prev);
                idsQueSalieron.forEach((id) => s.add(id));
                return s;
              });
            }
          }}
        />
      )}
    </div>
  );
}