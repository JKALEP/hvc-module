import { cn } from '@/shared/lib/utils';

/**
 * Contenedor "panel" único del módulo Fotos.
 *
 * Sustituye a las variantes sueltas que convivían en el módulo sin
 * criterio: `rounded-2xl border border-border bg-card p-5 shadow-sm`
 * (Fotos.tsx), `rounded-xl border border-border bg-card p-4`
 * (Portal.tsx, PanelActividades.tsx, CapturaRapida.tsx), `surface p-4`
 * (AdminFotos.tsx) y el componente `Card` de shared/ui (PanelSubida.tsx).
 *
 * Ninguna de esas variantes se elige como "la mejor": se usa la del
 * bloque principal de Fotos.tsx como base porque es el patrón más
 * usado y visible del módulo. El diseño no cambia, solo se deja de
 * repetir.
 *
 * `denso`: paneles secundarios (una sección dentro de una pestaña,
 * un bloque de admin) usan menos padding y esquinas menos redondeadas
 * que el panel "de primer nivel" de una pantalla.
 *
 * `as`: por defecto es un `<div>`. Varios usos actuales son
 * semánticamente `<section>` (agrupan contenido con su propio
 * encabezado) y conviene conservar esa etiqueta para accesibilidad.
 */
export function PanelFotos({
  denso = false,
  as: Componente = 'div',
  className,
  ...props
}: React.ComponentProps<'div'> & {
  denso?: boolean;
  as?: 'div' | 'section';
}) {
  return (
    <Componente
      className={cn(
        'border border-border bg-card shadow-sm',
        denso ? 'rounded-xl p-4' : 'rounded-2xl p-5',
        className,
      )}
      {...props}
    />
  );
}