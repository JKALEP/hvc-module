import { useState, type ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

type IdPestana = 'albumes' | 'fotos' | 'tareas';

/**
 * Pestañas de contenido del equipo: Álbumes / Fotos / Tareas.
 *
 * Comentarios YA NO vive aquí: ahora es un panel siempre visible al lado
 * de la ficha del equipo (ver `Fotos.tsx`), así que se saca de la pestaña
 * para no duplicarlo. Cada panel sigue siendo el mismo componente de
 * siempre con las mismas props.
 */
export function PestanasFicha({
  contenidoAlbumes,
  contenidoFotos,
  contenidoTareas,
}: {
  contenidoAlbumes: ReactNode;
  contenidoFotos: ReactNode;
  contenidoTareas: ReactNode;
}) {
  const [activa, setActiva] = useState<IdPestana>('albumes');

  const pestanas: { id: IdPestana; etiqueta: string }[] = [
    { id: 'albumes', etiqueta: 'Álbumes' },
    { id: 'fotos', etiqueta: 'Fotos' },
    { id: 'tareas', etiqueta: 'Tareas' },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 border-b border-border">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={activa === p.id}
            onClick={() => setActiva(p.id)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors outline-none',
              activa === p.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activa === 'albumes' && contenidoAlbumes}
        {activa === 'fotos' && contenidoFotos}
        {activa === 'tareas' && contenidoTareas}
      </div>
    </div>
  );
}