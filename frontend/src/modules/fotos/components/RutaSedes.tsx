import { Link } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import type { Ancestro } from '@/modules/fotos/types';

/**
 * Camino de carpetas: "🏠 Fotos › UPN › UPN Villa › Pabellón 1".
 *
 * REDISEÑO (solo visual): se agrega un icono de raíz para que el breadcrumb
 * se lea como punto de partida, tal como en la referencia. La regla de
 * `navegable: false` no cambia: sigue pintándose como texto sin enlace.
 */
export function RutaSedes({
  ancestros,
  actual,
  raiz = '/fotos',
  etiquetaRaiz = 'Fotos',
  rutaCarpeta = '/fotos/carpeta',
}: {
  ancestros: Ancestro[];
  actual: string | null;
  raiz?: string;
  etiquetaRaiz?: string;
  rutaCarpeta?: string;
}) {
  const enlace =
    'rounded px-1 py-0.5 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50';

  return (
    <nav
      aria-label="Ruta de carpetas"
      className="flex flex-wrap items-center gap-0.5 text-sm text-muted-foreground"
    >
      <Link
        to={raiz}
        className={cn(
          enlace,
          'flex items-center gap-1',
          actual === null && 'font-medium text-foreground',
        )}
      >
        <HomeIcon className="size-3.5" />
        {etiquetaRaiz}
      </Link>

      {ancestros.map((a) => (
        <span key={a.id} className="flex items-center gap-0.5">
          <ChevronRightIcon className="size-3.5 shrink-0" />
          {a.navegable ? (
            <Link to={`${rutaCarpeta}/${a.id}`} className={enlace}>
              {a.nombre}
            </Link>
          ) : (
            <span
              className="px-1 py-0.5 text-muted-foreground/70"
              title="No tienes acceso a esta carpeta"
            >
              {a.nombre}
            </span>
          )}
        </span>
      ))}

      {actual !== null && (
        <span className="flex items-center gap-0.5">
          <ChevronRightIcon className="size-3.5 shrink-0" />
          <span className="px-1 py-0.5 font-medium text-foreground">
            {actual}
          </span>
        </span>
      )}
    </nav>
  );
}