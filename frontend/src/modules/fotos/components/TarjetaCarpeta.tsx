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
import type { CarpetaListada } from '@/modules/fotos/types';

/**
 * Una carpeta.
 *
 * Sin imagen a propósito: una carpeta se distingue de las fotos por la
 * silueta, no por leer el texto. Aquí manda el azulejo sólido.
 *
 * Las acciones van FUERA del flujo y aparecen al pasar el cursor o al
 * enfocar con teclado: en el flujo se comían el ancho y el nombre quedaba
 * en dos letras — y con `opacity-0` lo seguían haciendo, porque seguían
 * ocupando sitio.
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
  /**
   * Qué acciones ofrecer, ya resueltas por quien pinta la tarjeta a partir
   * de `carpeta.permiso`. Un cliente no ve ninguna.
   *
   * `renombrar` y `compartir` van separadas porque son dos grados distintos
   * de §5 —organizar es de Editor, repartir llaves es de Acceso Total—, y
   * juntas ofrecían un botón que el backend rechaza con 403.
   */
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
  const codigoEquipo =
    carpeta.equipo?.codigoInterno ?? `#${carpeta.equipo?.id ?? ''}`;
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
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            carpeta.cerrada
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/10 text-primary',
          )}
        >
          {/* Un equipo se distingue por la silueta, no por leer el texto:
              en una estructura de obra hay muchas más carpetas que equipos,
              y el icono es lo que se busca de un vistazo (§12). */}
          {carpeta.tipo === 'EQUIPO' ? (
            <WrenchIcon className="size-5" />
          ) : (
            <FolderIcon className="size-5" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <p
            className="truncate font-medium text-foreground"
            title={carpeta.nombre}
          >
            {carpeta.nombre}
          </p>
          {/* El código del equipo del catálogo, SOLO si no está ya en el
              nombre. Una carpeta de equipo nace llamándose «Equipo <código>»,
              así que repetirlo debajo es ruido; en cambio si alguien la
              renombró, el código es lo único que dice a qué equipo apunta. */}
          {carpeta.equipo && !carpeta.nombre.includes(codigoEquipo) && (
            <p className="truncate text-xs text-muted-foreground">
              Equipo {codigoEquipo}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-x-2 truncate text-xs text-muted-foreground tabular-nums">
            {carpeta.subcarpetas > 0 && (
              <span>{carpeta.subcarpetas} carpeta(s)</span>
            )}
            <span className="flex items-center gap-1">
              <ImageIcon className="size-3" />
              {carpeta.fotos} foto(s)
            </span>
          </p>
          {/* Se propaga desde dentro: subir una foto tres niveles más
              abajo mueve esta fecha. */}
          <p className="truncate text-xs text-muted-foreground/80">
            {formatActualizado(carpeta.actualizadoEn)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {carpeta.cerrada && (
            <Badge variant="warning">
              <ArchiveIcon className="size-3" />
              Archivada
            </Badge>
          )}
        </div>
      </Link>

      {hayAcciones && (
        <div className="absolute inset-y-0 right-2 flex items-center gap-0.5 rounded-r-xl bg-card pl-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {acciones.renombrar && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Renombrar ${carpeta.nombre}`}
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
