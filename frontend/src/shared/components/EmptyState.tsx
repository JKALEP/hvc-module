import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

/** Escala del vacío. Ver la tabla de abajo. */
type Tamano = 'sm' | 'md' | 'lg';

/**
 * Tres tamaños, porque un vacío dentro de una celda y un vacío que ocupa
 * la pantalla entera no piden la misma presencia.
 */
const ESCALA: Record<
  Tamano,
  { caja: string; circulo: string; icono: string; titulo: string }
> = {
  sm: { caja: 'px-6 py-8', circulo: 'size-10', icono: 'size-5', titulo: 'text-sm' },
  md: { caja: 'px-6 py-12', circulo: 'size-14', icono: 'size-7', titulo: 'text-sm' },
  lg: { caja: 'px-6 py-20', circulo: 'size-16', icono: 'size-8', titulo: 'text-base' },
};

/**
 * Estado vacío: sin datos, sin resultados o sin permiso.
 *
 * ⚠️ El círculo del icono lleva **borde** además de fondo. Sin él, sobre el
 * fondo tenue de la caja se lee como una mancha en vez de como una pieza.
 *
 * La descripción se mide en **caracteres** (`max-w-[36ch]`) y no en píxeles:
 * lo que hace legible una línea es cuántos caracteres tiene, no cuánto
 * ocupa, así que la medida correcta es la del texto.
 *
 * Conserva el contenedor punteado del proyecto —que el sistema de
 * referencia no tiene— porque aquí el vacío se usa **a nivel de página**, y
 * ahí hace falta algo que delimite la zona; en la referencia vive siempre
 * dentro de una card, que ya pone el marco.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: Tamano;
}) {
  const e = ESCALA[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 text-center',
        e.caja,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full border border-border bg-muted/60 text-muted-foreground',
          e.circulo,
        )}
      >
        <Icon className={e.icono} />
      </div>

      <div>
        <p className={cn('font-semibold text-foreground', e.titulo)}>{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-[36ch] text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}
