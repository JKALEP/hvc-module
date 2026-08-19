import { useState } from 'react';
import {
  CalendarIcon,
  DownloadIcon,
  ImagesIcon,
  Trash2Icon,
  UserIcon,
  PencilIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { Spinner } from '@/shared/ui/spinner';
import { Dialog, DialogContent } from '@/shared/ui/dialog';
import { useEliminarFoto } from '@/modules/fotos/hooks/useAlbumes';
import { descargarFoto } from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { formatFecha, formatFechaCorta } from '@/shared/lib/format';
import { HiloComentarios } from './HiloComentarios';
import type {
  FotoDeAlbum,
  AlbumDeGaleria,
  PermisoCarpeta,
} from '@/modules/fotos/types';

/** Tamaño legible de un archivo. */
function formatPeso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Galería agrupada por lote.
 *
 * Cada grupo es UNA subida: su descripción, quién la hizo y cuándo. Es
 * la unidad real del trabajo en obra —se documenta un momento, no una
 * foto— y por eso la descripción encabeza el grupo en vez de repetirse
 * bajo cada miniatura.
 */
export function GaleriaAlbumes({
  albumes,
  cargando,
  hayMas,
  cargandoMas,
  onCargarMas,
  puedeBorrar,
  portal = false,
  vacio,
  permiso = null,
  ramaCerrada = false,
  onRenombrar,
}: {
  albumes: AlbumDeGaleria[];
  cargando: boolean;
  hayMas: boolean;
  cargandoMas: boolean;
  onCargarMas: () => void;
  /** Decide foto a foto: el autor, o un administrador. */
  puedeBorrar: (f: FotoDeAlbum) => boolean;
  portal?: boolean;
  vacio: { titulo: string; descripcion?: string };
  /** El de la carpeta, ya resuelto por el servidor. Decide si se comenta. */
  permiso?: PermisoCarpeta | null;
  ramaCerrada?: boolean;
  /** Sin handler no se ofrece renombrar: el portal no lo pasa. */
  onRenombrar?: (album: AlbumDeGaleria) => void;
}) {
  const [abierta, setAbierta] = useState<FotoDeAlbum | null>(null);
  const [hiloAbierto, setHiloAbierto] = useState<number | null>(null);
  const [descargando, setDescargando] = useState(false);
  const eliminar = useEliminarFoto();

  /**
   * La descarga pide una URL firmada con `attachment` y navega a ella: el
   * atributo `download` de un enlace no funciona entre dominios, así que
   * quien impone el guardado es R2, no el navegador.
   */
  const descargar = async (foto: FotoDeAlbum) => {
    setDescargando(true);
    try {
      const { url } = await descargarFoto(foto.id, portal);
      window.location.assign(url);
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo descargar la foto'));
    } finally {
      setDescargando(false);
    }
  };

  if (cargando)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-lg" />
        ))}
      </div>
    );

  if (albumes.length === 0)
    return (
      <EmptyState
        icon={ImagesIcon}
        title={vacio.titulo}
        description={vacio.descripcion}
      />
    );

  return (
    <div className="space-y-8">
      {albumes.map((lote) => (
        <section key={lote.id} className="space-y-3">
          <header className="space-y-1 border-b border-border pb-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              {/* §16: el álbum ya puede tener nombre. Si no lo tiene —la
                  captura rápida de §17 sube sin título— manda la descripción,
                  y si tampoco, la fecha. Nunca «Sin nombre» a secas: un
                  álbum del día 12 se distingue por ser el del día 12. */}
              <h3 className="font-medium text-foreground">
                {lote.nombre ??
                  lote.descripcion ?? (
                    <span className="text-muted-foreground">
                      {formatFecha(lote.creadoEn)}
                    </span>
                  )}
              </h3>
              <p className="flex items-center gap-3 text-xs text-muted-foreground">
                {lote.subidoPor && (
                  <span className="flex items-center gap-1">
                    <UserIcon className="size-3.5" />
                    {lote.subidoPor.nombre}
                  </span>
                )}
                <span>{formatFecha(lote.creadoEn)}</span>
                <span className="tabular-nums">{lote.fotos.length} foto(s)</span>
                {onRenombrar && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Renombrar álbum ${lote.nombre ?? formatFecha(lote.creadoEn)}`}
                    onClick={() => onRenombrar(lote)}
                  >
                    <PencilIcon />
                  </Button>
                )}
              </p>
            </div>

            {/* Con nombre, la descripción baja a su sitio: es el detalle, no
                el título. Sin nombre ya está haciendo de título arriba. */}
            {lote.nombre && lote.descripcion && (
              <p className="text-sm text-muted-foreground">{lote.descripcion}</p>
            )}

            {/* §14 nombra el ÁLBUM entre las entidades comentables. El hilo
                se despliega en vez de estar siempre abierto: una galería con
                doce álbumes sería doce hilos compitiendo con las fotos. */}
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={() =>
                setHiloAbierto(hiloAbierto === lote.id ? null : lote.id)
              }
            >
              {hiloAbierto === lote.id ? <ChevronDownIcon /> : <ChevronRightIcon />}
              {lote.comentarios === 0
                ? 'Comentar'
                : `${lote.comentarios} comentario(s)`}
            </Button>

            {hiloAbierto === lote.id && (
              <div className="pt-1">
                <HiloComentarios
                  entidad="album"
                  entidadId={lote.id}
                  permiso={permiso}
                  ramaCerrada={ramaCerrada}
                />
              </div>
            )}
          </header>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {lote.fotos.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAbierta(f)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <img
                  src={f.urlMiniatura}
                  alt={lote.descripcion ?? ''}
                  loading="lazy"
                  className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                />
              </button>
            ))}
          </div>
        </section>
      ))}

      {hayMas && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={onCargarMas}
            disabled={cargandoMas}
          >
            {cargandoMas && <Spinner />}
            Cargar más fotos
          </Button>
        </div>
      )}

      {abierta && (
        <Dialog open onOpenChange={(v) => !v && setAbierta(null)}>
          <DialogContent className="max-w-3xl">
            <img
              src={abierta.url}
              alt=""
              className="max-h-[65vh] w-full rounded-lg bg-muted object-contain"
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {abierta.subidaPor && (
                <span className="flex items-center gap-1">
                  <UserIcon className="size-3.5" />
                  {abierta.subidaPor.nombre}
                </span>
              )}
              <span>Subida el {formatFecha(abierta.creadoEn)}</span>
              {abierta.tomadaEn && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="size-3.5" />
                  Tomada el {formatFechaCorta(abierta.tomadaEn)}
                </span>
              )}
              <span className="tabular-nums">
                {abierta.anchoPx}×{abierta.altoPx} px ·{' '}
                {formatPeso(abierta.bytes)}
              </span>
            </div>

            {/* §14 marca la foto como comentable OPCIONAL, y desde la Fase 6
                tiene ruta. Va DENTRO del visor y no bajo la miniatura: se
                comenta lo que se está mirando, y una rejilla con un hilo bajo
                cada foto sería ilegible. */}
            <div className="max-h-52 overflow-y-auto border-t border-border pt-3">
              <HiloComentarios
                entidad="foto"
                entidadId={abierta.id}
                permiso={permiso}
                ramaCerrada={ramaCerrada}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              {puedeBorrar(abierta) && (
                <Button
                  variant="destructive"
                  disabled={eliminar.isPending}
                  onClick={() =>
                    eliminar.mutate(abierta.id, {
                      onSuccess: () => setAbierta(null),
                    })
                  }
                >
                  {eliminar.isPending ? <Spinner /> : <Trash2Icon />}
                  Eliminar
                </Button>
              )}
              <Button
                disabled={descargando}
                onClick={() => void descargar(abierta)}
              >
                <DownloadIcon />
                Descargar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
