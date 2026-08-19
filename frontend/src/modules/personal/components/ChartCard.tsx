import type { ReactNode } from 'react';
import { ChartNoAxesColumnIcon } from 'lucide-react';

/**
 * Contenedor de un gráfico: título, descripción y estado vacío.
 * La descripción no es decorativa — dice cómo leer el gráfico, que es
 * donde se pierden la mayoría de los lectores.
 */
export function ChartCard({
  title,
  description,
  vacio,
  mensajeVacio = 'No hay datos en el período seleccionado.',
  children,
}: {
  title: string;
  description?: string;
  vacio?: boolean;
  mensajeVacio?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {vacio ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <ChartNoAxesColumnIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{mensajeVacio}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
