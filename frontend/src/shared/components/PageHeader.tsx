import type { ReactNode } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/shared/lib/utils';

/** Una miga. Sin `to` no navega: así se marca la página actual. */
export interface Miga {
  label: string;
  to?: string;
}

/**
 * El encabezado estándar de CUALQUIER página, y el único sitio donde vive
 * el `<h1>`. Sustituye a todo título suelto.
 *
 * Detalles que no son adorno:
 *
 * - **`sm:items-end`** alinea título y acciones por su línea de asiento
 *   inferior. Con `items-center`, ante un título de dos líneas los botones
 *   quedan flotando a media altura.
 * - **`min-w-0` en el texto + `shrink-0` en las acciones**: si el título es
 *   largo, se encoge él y los botones se quedan enteros. Al revés se
 *   recortan los botones, que es lo que no se puede tocar.
 * - En móvil el bloque se apila y las acciones caen debajo, a la izquierda.
 *
 * La prop se llama `description` y no `subtitle` a propósito: es el nombre
 * que ya usan las pantallas de este proyecto y renombrarlo en 25 sitios no
 * cambiaría un píxel.
 */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className,
}: {
  title: string;
  description?: string;
  /** Migas por encima del título. La última es dónde estás. */
  breadcrumb?: Miga[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav
            aria-label="Ruta de navegación"
            className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
          >
            {breadcrumb.map((miga, i) => {
              const ultima = i === breadcrumb.length - 1;
              return (
                <span key={`${miga.label}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <ChevronRightIcon
                      aria-hidden
                      className="size-3 text-muted-foreground/60"
                    />
                  )}
                  {miga.to && !ultima ? (
                    <Link
                      to={miga.to}
                      className="transition-colors hover:text-foreground"
                    >
                      {miga.label}
                    </Link>
                  ) : (
                    <span className={cn(ultima && 'font-medium text-foreground')}>
                      {miga.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        )}

        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
          {title}
        </h1>

        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
