import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CalendarIcon,
  DownloadIcon,
  ImagesIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { usePortalFeed } from '@/hooks/useFotos';
import { urlDeDescarga } from '@/services/fotosService';
import { getErrorMessage } from '@/services/api';
import { formatFecha, formatFechaCorta } from '@/lib/format';
import type { FiltrosFeed, FotoFeed } from '@/types/models';

const SIN_FILTROS: FiltrosFeed = { subidaPorId: null, desde: '', hasta: '' };

/**
 * Galería del cliente externo: ver y descargar, nada más.
 *
 * No hay formulario de subida, ni borrado, ni autor de cada foto: el
 * backend ya no manda ese dato para una cuenta externa, y esta pantalla
 * tampoco lo pediría.
 */
export function PortalAlbum() {
  const { id } = useParams();
  const albumId = Number(id);

  const [filtros, setFiltros] = useState<FiltrosFeed>(SIN_FILTROS);
  const [abierta, setAbierta] = useState<FotoFeed | null>(null);
  const [descargando, setDescargando] = useState(false);

  const { data, isError } = usePortalFeed(albumId, filtros);
  const cargando = !data && !isError;
  const fotos = data?.fotos ?? [];
  const hayFiltro = filtros.desde !== '' || filtros.hasta !== '';

  /**
   * La descarga pide una URL firmada con `attachment` y navega a ella:
   * el atributo `download` de un enlace no funciona entre dominios, así
   * que quien impone el guardado es R2, no el navegador.
   */
  const descargar = async (foto: FotoFeed) => {
    setDescargando(true);
    try {
      const { url } = await urlDeDescarga(albumId, foto.id);
      window.location.assign(url);
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo descargar la foto'));
    } finally {
      setDescargando(false);
    }
  };

  if (isError) {
    return (
      <EmptyState
        icon={ImagesIcon}
        title="No puedes ver este álbum"
        description="O no existe, o ya no está compartido contigo."
        action={
          <Button variant="outline" render={<Link to="/portal" />}>
            <ArrowLeftIcon />
            Volver
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/portal"
          className="mb-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeftIcon className="size-4" />
          Volver
        </Link>

        <PageHeader
          title={data?.album.nombre ?? 'Álbum'}
          description={data?.album.descripcion ?? undefined}
          actions={
            data && <Badge variant="outline">{data.total} foto(s)</Badge>
          }
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
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
          title={hayFiltro ? 'Ninguna foto en esas fechas' : 'Álbum vacío'}
          description={
            hayFiltro
              ? 'Prueba a ampliar el rango de fechas.'
              : 'Todavía no hay fotos aquí.'
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
            </button>
          ))}
        </div>
      )}

      {abierta && (
        <Dialog
          open
          onOpenChange={(visible) => !visible && setAbierta(null)}
        >
          <DialogContent className="max-w-3xl">
            <img
              src={abierta.url}
              alt={abierta.descripcion ?? ''}
              className="max-h-[65vh] w-full rounded-lg bg-muted object-contain"
            />

            <div className="space-y-2">
              {abierta.descripcion && (
                <p className="text-sm text-foreground">{abierta.descripcion}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Publicada el {formatFecha(abierta.creadoEn)}</span>
                {abierta.tomadaEn && (
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="size-3.5" />
                    Tomada el {formatFechaCorta(abierta.tomadaEn)}
                  </span>
                )}
                <span>
                  {abierta.anchoPx}×{abierta.altoPx} px
                </span>
              </div>
            </div>

            <div className="flex justify-end border-t border-border pt-4">
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
