import { Link } from 'react-router-dom';
import { ImageIcon, LockIcon, MapPinIcon, UsersIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { formatFechaCorta } from '@/lib/format';
import type { AlbumResumen } from '@/types/models';

/**
 * Tarjeta de un álbum en el listado.
 *
 * La portada es la última foto subida: en un feed grupal lo que dice si
 * un álbum está vivo es lo último que entró, no lo primero.
 */
export function TarjetaAlbum({
  album,
  mostrarSede = true,
  enlaceBase = '/fotos/album',
  ocultarColaboradores = false,
  acciones,
}: {
  album: AlbumResumen;
  /** En el explorador la sede ya la dice el breadcrumb. */
  mostrarSede?: boolean;
  /** El portal del cliente navega bajo otra ruta. */
  enlaceBase?: string;
  /** A un cliente no se le enseña cuántos internos entran al álbum. */
  ocultarColaboradores?: boolean;
  /** Acciones de administración, sobre la esquina de la portada. */
  acciones?: React.ReactNode;
}) {
  const cerrado = album.estado === 'CERRADO';

  return (
    <div className="group relative">
      {acciones && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-0.5 rounded-lg bg-card/95 p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {acciones}
        </div>
      )}
    <Link
      to={`${enlaceBase}/${album.id}`}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {album.ultimaFoto ? (
          <img
            src={album.ultimaFoto.urlMiniatura}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageIcon className="size-7" />
            <span className="text-xs">Sin fotos todavía</span>
          </div>
        )}
        {cerrado && (
          <div className="absolute top-2 right-2">
            <Badge variant="warning">
              <LockIcon className="size-3" />
              Cerrado
            </Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate font-semibold text-foreground">
            {album.nombre}
          </h3>
          {mostrarSede && (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPinIcon className="size-3 shrink-0" />
              {album.sede.nombre}
            </p>
          )}
        </div>

        {album.descripcion && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {album.descripcion}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ImageIcon className="size-3.5" />
            {album._count.fotos} foto(s)
          </span>
          {!ocultarColaboradores && (
            <span className="flex items-center gap-1">
              <UsersIcon className="size-3.5" />
              {album._count.compartidos} con acceso
            </span>
          )}
          {album.ultimaFoto && (
            <span>Última: {formatFechaCorta(album.ultimaFoto.creadoEn)}</span>
          )}
        </div>
      </div>
    </Link>
    </div>
  );
}
