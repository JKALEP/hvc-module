import { Link } from 'react-router-dom';
import { ChevronRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Breadcrumb del explorador: "Fotos › Lima › Almacén Central".
 *
 * Los ancestros vienen del backend con su nombre ya resuelto: la `ruta`
 * materializada solo guarda ids, así que el nombre no se puede componer
 * en el cliente sin leer todo el árbol —algo que un colaborador no puede
 * hacer—.
 */
export function RutaSedes({
  ancestros,
  actual,
  raiz = '/fotos',
  etiquetaRaiz = 'Fotos',
  rutaCarpeta = '/fotos/sede',
}: {
  ancestros: { id: number; nombre: string }[];
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
      <Link
        to={raiz}
        className={cn(enlace, actual === null && 'font-medium text-foreground')}
      >
        {etiquetaRaiz}
      </Link>

      {ancestros.map((a) => (
        <span key={a.id} className="flex items-center gap-0.5">
          <ChevronRightIcon className="size-3.5 shrink-0" />
          <Link to={`${rutaCarpeta}/${a.id}`} className={enlace}>
            {a.nombre}
          </Link>
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
