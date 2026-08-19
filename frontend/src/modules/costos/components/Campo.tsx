import { Badge } from '@/shared/ui/badge';
import { presentacionDe } from '@/modules/costos/lib/estados';
import type { EstadoRequerimiento } from '@/modules/costos/types';

/**
 * Campo con etiqueta.
 *
 * §14 pide no usar el asterisco de forma inconsistente: aquí lo lleva
 * TODO lo obligatorio y nada más, y la ayuda va debajo en vez de dentro
 * del placeholder —un placeholder desaparece justo cuando hace falta—.
 */
export function Campo({
  label,
  requerido,
  ayuda,
  children,
}: {
  label: string;
  requerido?: boolean;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {requerido && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

/**
 * Las clases del `<textarea>`.
 *
 * No hay primitiva compartida para textarea en `shared/ui`, y el resto
 * del repositorio lo escribe a mano en cada formulario. Esto al menos
 * las deja en un sitio dentro del módulo.
 */
export const CLASES_TEXTAREA =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ' +
  'placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/30 ' +
  'disabled:pointer-events-none disabled:opacity-50';

/** El estado del requerimiento, con la etiqueta y el tono de `lib/estados`. */
export function EstadoBadge({ estado }: { estado: EstadoRequerimiento }) {
  const { etiqueta, tono } = presentacionDe(estado);
  return <Badge variant={tono}>{etiqueta}</Badge>;
}

/** Un par etiqueta/valor, para las vistas de solo lectura. */
export function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {etiqueta}
      </p>
      <p className="text-sm text-foreground">{children}</p>
    </div>
  );
}
