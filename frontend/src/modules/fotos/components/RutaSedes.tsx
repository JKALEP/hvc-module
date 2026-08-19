import { Link } from 'react-router-dom';
import { ChevronRightIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import type { Ancestro } from '@/modules/fotos/types';

/**
 * Camino de carpetas: "Fotos › UPN › UPN Villa › Pabellón 1".
 *
 * Quien no es administrador ve el camino ANCESTRAL COMPLETO como
 * contexto —para saber dónde encaja lo suyo dentro de la empresa— pero
 * los escalones por encima de lo que le compartieron llegan con
 * `navegable: false` y se pintan como texto, no como enlace: no tiene
 * acceso a su contenido. Los hermanos de esos escalones no existen en la
 * respuesta, así que no hay nada que ocultar aquí.
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
  /** El portal del cliente cuelga de otra raíz. */
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
      {/* Punto de vuelta al inicio. Sin él, quien tiene dos carpetas
          compartidas no tendría forma de volver a la lista. */}
      <Link
        to={raiz}
        className={cn(enlace, actual === null && 'font-medium text-foreground')}
      >
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
            // Contexto, no navegación: no tiene acceso a su contenido.
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
