import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CalendarIcon,
  ImagesIcon,
  LockIcon,
  MapPinIcon,
  Trash2Icon,
  UploadIcon,
  UserIcon,
  XIcon,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  useAutoresAlbum,
  useEliminarFoto,
  useFeedAlbum,
  useSubirFotos,
} from '@/hooks/useFotos';
import { useAuth } from '@/hooks/useAuth';
import { esAdminFotos } from '@/lib/modulos';
import { formatFecha, formatFechaCorta } from '@/lib/format';
import type { FiltrosFeed, FotoFeed } from '@/types/models';

const SIN_FILTROS: FiltrosFeed = { subidaPorId: null, desde: '', hasta: '' };

/** Tamaño legible de un archivo. */
function formatPeso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Formulario de subida. Solo aparece si el álbum está abierto. */
function PanelSubida({ albumId }: { albumId: number }) {
  const subir = useSubirFotos();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [descripcion, setDescripcion] = useState('');
  // El <input type="file"> no se puede vaciar por estado: se limpia por ref.
  const inputRef = useRef<HTMLInputElement>(null);

  const limpiar = () => {
    setArchivos([]);
    setDescripcion('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const enviar = () => {
    if (archivos.length === 0) return;
    subir.mutate({ albumId, archivos, descripcion }, { onSuccess: limpiar });
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Fotos <span className="text-destructive">*</span>
            </label>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
              onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
              className="block w-full cursor-pointer rounded-lg border border-input bg-background text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Hasta 10 fotos por vez, máximo 15 MB cada una. JPEG, PNG, HEIC o
              WebP.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Descripción
            </label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Se aplica a todas las fotos de esta subida"
              className="h-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {archivos.length === 0
              ? 'Ninguna foto seleccionada.'
              : `${archivos.length} foto(s) · ${formatPeso(
                  archivos.reduce((a, f) => a + f.size, 0),
                )}`}
          </p>
          <div className="flex gap-2">
            {archivos.length > 0 && !subir.isPending && (
              <Button variant="ghost" size="sm" onClick={limpiar}>
                <XIcon />
                Quitar
              </Button>
            )}
            <Button
              onClick={enviar}
              disabled={archivos.length === 0 || subir.isPending}
            >
              {subir.isPending ? <Spinner /> : <UploadIcon />}
              {subir.isPending ? 'Subiendo…' : 'Subir'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Foto a tamaño completo, con su ficha y el borrado. */
function VisorFoto({
  foto,
  albumId,
  puedeBorrar,
  onCerrar,
}: {
  foto: FotoFeed;
  albumId: number;
  puedeBorrar: boolean;
  onCerrar: () => void;
}) {
  const eliminar = useEliminarFoto();

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-3xl">
        <img
          src={foto.url}
          alt={foto.descripcion ?? ''}
          className="max-h-[65vh] w-full rounded-lg bg-muted object-contain"
        />

        <div className="space-y-2">
          {foto.descripcion && (
            <p className="text-sm text-foreground">{foto.descripcion}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {foto.subidaPor && (
              <span className="flex items-center gap-1">
                <UserIcon className="size-3.5" />
                {foto.subidaPor.nombre}
              </span>
            )}
            <span className="flex items-center gap-1">
              <UploadIcon className="size-3.5" />
              Subida el {formatFecha(foto.creadoEn)}
            </span>
            {foto.tomadaEn && (
              <span className="flex items-center gap-1">
                <CalendarIcon className="size-3.5" />
                Tomada el {formatFechaCorta(foto.tomadaEn)}
              </span>
            )}
            <span>
              {foto.anchoPx}×{foto.altoPx} px · {formatPeso(foto.bytes)}
            </span>
          </div>
        </div>

        {puedeBorrar && (
          <div className="flex justify-end border-t border-border pt-4">
            <Button
              variant="destructive"
              disabled={eliminar.isPending}
              onClick={() =>
                eliminar.mutate(
                  { albumId, fotoId: foto.id },
                  { onSuccess: onCerrar },
                )
              }
            >
              {eliminar.isPending ? <Spinner /> : <Trash2Icon />}
              Eliminar foto
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Feed de un álbum: ver y publicar.
 *
 * No hay dos vistas según el rol — ver y subir son el mismo permiso, así
 * que un admin y un colaborador ven exactamente esta pantalla. Lo único
 * que la cambia es que el álbum esté CERRADO, y eso vale para ambos.
 */
export function AlbumFotos() {
  const { id } = useParams();
  const albumId = Number(id);
  const { usuario } = useAuth();

  const [filtros, setFiltros] = useState<FiltrosFeed>(SIN_FILTROS);
  const [abierta, setAbierta] = useState<FotoFeed | null>(null);

  const { data, isError } = useFeedAlbum(albumId, filtros);
  const { data: autores } = useAutoresAlbum(albumId);

  if (isError) {
    return (
      <EmptyState
        icon={LockIcon}
        title="No puedes ver este álbum"
        description="O no existe, o nadie te ha dado acceso todavía. Pídeselo a un administrador de Fotos."
        action={
          <Button variant="outline" render={<Link to="/fotos" />}>
            <ArrowLeftIcon />
            Volver a los álbumes
          </Button>
        }
      />
    );
  }

  const album = data?.album;
  const fotos = data?.fotos ?? [];
  // Sin datos y sin error todavía no se sabe nada: no es un álbum vacío.
  // Se mira `data` y no `isLoading` porque una consulta que reintenta —o
  // que se queda en pausa— deja de estar "cargando" sin traer nada.
  const cargando = !data && !isError;
  const hayFiltro =
    filtros.subidaPorId !== null || filtros.desde !== '' || filtros.hasta !== '';

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/fotos"
          className="mb-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeftIcon className="size-4" />
          Volver a los álbumes
        </Link>

        <PageHeader
          title={album?.nombre ?? 'Álbum'}
          description={album?.descripcion ?? undefined}
          actions={
            album && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <MapPinIcon className="size-3" />
                  {album.sede.nombre}
                </Badge>
                {album.estado === 'CERRADO' && (
                  <Badge variant="warning">
                    <LockIcon className="size-3" />
                    Cerrado
                  </Badge>
                )}
              </div>
            )
          }
        />
      </div>

      {data && !data.puedeSubir && (
        <div className="rounded-xl border border-amber-600/25 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-500">
          Este álbum está cerrado: se puede consultar, pero nadie puede subir
          fotos nuevas. Un administrador de Fotos puede reabrirlo desde
          Administrar.
        </div>
      )}

      {data?.puedeSubir && <PanelSubida albumId={albumId} />}

      {/* Filtros del feed */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56 space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Publicado por
          </label>
          <Select
            className="h-9"
            value={filtros.subidaPorId === null ? '' : String(filtros.subidaPorId)}
            onChange={(e) =>
              setFiltros((f) => ({
                ...f,
                subidaPorId:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          >
            <option value="">Todos</option>
            {(autores ?? []).map((a) => (
              <option key={a.usuarioId} value={a.usuarioId}>
                {a.nombre} ({a.fotos})
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Desde
          </label>
          <Input
            type="date"
            className="h-9 w-40"
            value={filtros.desde}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, desde: e.target.value }))
            }
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Hasta
          </label>
          <Input
            type="date"
            className="h-9 w-40"
            value={filtros.hasta}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, hasta: e.target.value }))
            }
          />
        </div>

        {hayFiltro && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFiltros(SIN_FILTROS)}
          >
            <XIcon />
            Limpiar
          </Button>
        )}

        <p className="ml-auto text-sm text-muted-foreground">
          {data ? `${data.total} foto(s)` : ''}
        </p>
      </div>

      {cargando && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      )}

      {data && fotos.length === 0 && (
        <EmptyState
          icon={ImagesIcon}
          title={hayFiltro ? 'Ninguna foto con esos filtros' : 'Álbum vacío'}
          description={
            hayFiltro
              ? 'Prueba a ampliar el rango de fechas o a quitar el filtro por autor.'
              : data?.puedeSubir
                ? 'Sube la primera con el formulario de arriba.'
                : 'El álbum está cerrado y todavía no tiene fotos.'
          }
        />
      )}

      {fotos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setAbierta(f)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <img
                src={f.urlMiniatura}
                alt={f.descripcion ?? ''}
                loading="lazy"
                className="size-full object-cover transition-transform group-hover:scale-[1.03]"
              />
              {/* Quién la subió: es un feed grupal, el autor es parte del dato. */}
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 text-left text-xs text-white">
                {f.subidaPor?.nombre}
              </span>
            </button>
          ))}
        </div>
      )}

      {abierta && (
        <VisorFoto
          foto={abierta}
          albumId={albumId}
          // Borra quien la subió o un administrador de Fotos: la misma
          // regla que aplica el backend.
          puedeBorrar={
            abierta.subidaPor?.id === usuario?.id || esAdminFotos(usuario)
          }
          onCerrar={() => setAbierta(null)}
        />
      )}
    </div>
  );
}
