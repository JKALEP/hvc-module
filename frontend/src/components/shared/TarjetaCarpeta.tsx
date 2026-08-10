import { Link } from 'react-router-dom';
import {
  FolderIcon,
  ImageIcon,
  PencilIcon,
  PowerIcon,
  Share2Icon,
  Trash2Icon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CarpetaSede } from '@/types/models';

/**
 * Una sede como carpeta.
 *
 * Las acciones aparecen al pasar el cursor o al enfocar con teclado y
 * van FUERA del flujo: en el flujo se comían el ancho y el nombre de la
 * sede quedaba en dos letras — con `opacity-0` lo seguían haciendo,
 * porque seguían ocupando sitio.
 */
export function TarjetaCarpeta({
  carpeta,
  admin,
  enlaceBase = '/fotos/sede',
  onRenombrar,
  onCompartir,
  onCambiarEstado,
  onEliminar,
}: {
  carpeta: CarpetaSede;
  admin: boolean;
  /** El portal del cliente navega bajo otra ruta. */
  enlaceBase?: string;
  onRenombrar: (c: CarpetaSede) => void;
  onCompartir: (c: CarpetaSede) => void;
  onCambiarEstado: (c: CarpetaSede) => void;
  onEliminar: (c: CarpetaSede) => void;
}) {
  const inactiva = carpeta.estado === 'INACTIVA';

  return (
    <div className="group relative">
      <Link
        to={`${enlaceBase}/${carpeta.id}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            inactiva
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/10 text-primary',
          )}
        >
          <FolderIcon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate font-medium text-foreground',
              inactiva && 'line-through',
            )}
            title={carpeta.nombre}
          >
            {carpeta.nombre}
          </p>
          <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
            {carpeta.subsedes > 0 && (
              <span>{carpeta.subsedes} carpeta(s)</span>
            )}
            <span className="flex items-center gap-1">
              <ImageIcon className="size-3" />
              {carpeta.albumes} álbum(es)
            </span>
          </p>
        </div>

        {inactiva && <Badge variant="warning">Inactiva</Badge>}
      </Link>

      {admin && (
        <div className="absolute inset-y-0 right-2 flex items-center gap-0.5 rounded-r-xl bg-card pl-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Renombrar ${carpeta.nombre}`}
            onClick={() => onRenombrar(carpeta)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Compartir ${carpeta.nombre}`}
            onClick={() => onCompartir(carpeta)}
          >
            <Share2Icon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              inactiva
                ? `Reactivar ${carpeta.nombre}`
                : `Desactivar ${carpeta.nombre}`
            }
            onClick={() => onCambiarEstado(carpeta)}
          >
            <PowerIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar ${carpeta.nombre}`}
            onClick={() => onEliminar(carpeta)}
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
    </div>
  );
}
