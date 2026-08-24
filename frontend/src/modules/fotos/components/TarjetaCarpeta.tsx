import { Link } from 'react-router-dom';
import {
  ArchiveIcon,
  FolderIcon,
  ImageIcon,
  PencilIcon,
  Share2Icon,
  Trash2Icon,
  WrenchIcon,
} from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { formatActualizado } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import {
  COLOR_A_CLASES,
  COLOR_POR_DEFECTO,
} from '@/modules/fotos/lib/colores';
import { useColoresDeCarpeta } from '@/modules/fotos/hooks/useCamposEquipo';
import type { CarpetaListada } from '@/modules/fotos/types';

/**
 * Una carpeta.
 *
 * REDISEÑO (solo visual): tile tipo OneDrive — icono grande arriba-izquierda,
 * badge de archivada arriba-derecha, y el nombre + metadatos apilados debajo
 * en vez de en fila. Las acciones se mueven de "franja al borde derecho" a
 * un cluster flotante en la esquina superior derecha, que es el patrón que
 * se ve en la referencia. Ninguna prop, hook ni regla de permisos cambia.
 */
export function TarjetaCarpeta({
  carpeta,
  enlaceBase = '/fotos/carpeta',
  acciones,
  onRenombrar,
  onCompartir,
  onArchivar,
  onEliminar,
}: {
  carpeta: CarpetaListada;
  enlaceBase?: string;
  acciones?: {
    renombrar: boolean;
    compartir: boolean;
    archivar: boolean;
    eliminar: boolean;
  };
  onRenombrar?: (c: CarpetaListada) => void;
  onCompartir?: (c: CarpetaListada) => void;
  onArchivar?: (c: CarpetaListada) => void;
  onEliminar?: (c: CarpetaListada) => void;
}) {
  const { data: colores } = useColoresDeCarpeta();
  const color = colores?.[carpeta.tipo] ?? COLOR_POR_DEFECTO[carpeta.tipo];

  const hayAcciones =
    acciones &&
    (acciones.renombrar ||
      acciones.compartir ||
      acciones.archivar ||
      acciones.eliminar);

  return (
    <div className="group relative">
      <Link
        to={`${enlaceBase}/${carpeta.id}`}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {/* Cabecera del tile: icono + estado. El color sigue viniendo de
            configuración (Fase 1c); una carpeta archivada sigue perdiendo
            el color a propósito. */}
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-xl',
              carpeta.cerrada
                ? 'bg-muted text-muted-foreground'
                : COLOR_A_CLASES[color],
            )}
          >
            {carpeta.tipo === 'EQUIPO' ? (
              <WrenchIcon className="size-5" />
            ) : (
              <FolderIcon className="size-5" />
            )}
          </div>

          {carpeta.cerrada && (
            <Badge variant="warning" className="shrink-0">
              <ArchiveIcon className="size-3" />
              Archivada
            </Badge>
          )}
        </div>

        {/* Nombre + metadatos apilados, como en la referencia: nombre,
            luego conteos, luego fecha, cada uno en su propia línea. */}
        <div className="min-w-0 space-y-1">
          <p
            className="truncate font-medium text-foreground"
            title={carpeta.nombre}
          >
            {carpeta.nombre}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground tabular-nums">
            {carpeta.subcarpetas > 0 && (
              <span>{carpeta.subcarpetas} carpeta(s)</span>
            )}
            <span className="flex items-center gap-1">
              <ImageIcon className="size-3" />
              {carpeta.fotos} foto(s)
            </span>
          </p>
          <p className="truncate text-xs text-muted-foreground/70">
            {formatActualizado(carpeta.actualizadoEn)}
          </p>
        </div>
      </Link>

      {hayAcciones && (
        <div className="absolute top-3 right-3 flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {acciones.renombrar && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Renombrar ${carpeta.nombre}`}
              title={`Renombrar ${carpeta.nombre}`}
              onClick={() => onRenombrar?.(carpeta)}
            >
              <PencilIcon />
            </Button>
          )}
          {acciones.compartir && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Compartir ${carpeta.nombre}`}
              title={`Compartir ${carpeta.nombre}`}
              onClick={() => onCompartir?.(carpeta)}
            >
              <Share2Icon />
            </Button>
          )}
          {acciones.archivar && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={
                carpeta.cerrada
                  ? `Reabrir ${carpeta.nombre}`
                  : `Archivar ${carpeta.nombre}`
              }
              title={
                carpeta.cerrada
                  ? `Reabrir ${carpeta.nombre}`
                  : `Archivar ${carpeta.nombre}`
              }
              onClick={() => onArchivar?.(carpeta)}
            >
              <ArchiveIcon />
            </Button>
          )}
          {acciones.eliminar && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Eliminar ${carpeta.nombre}`}
              title={`Eliminar ${carpeta.nombre}`}
              onClick={() => onEliminar?.(carpeta)}
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}