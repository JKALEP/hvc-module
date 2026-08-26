import { useState, type ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

type IdPestana = 'actividades' | 'fotos';

/**
 * Pestañas de contenido de la INTERVENCIÓN: Actividades / Fotos.
 *
 * ⚠️ Eran tres —Álbumes / Fotos / Actividades— y la primera se fue con los
 * álbumes en la Fase 4. Y el orden cambió a propósito: **Actividades primero**,
 * porque es el checklist de la intervención y lo que se viene a hacer; las fotos
 * sueltas son lo que no encaja en ninguna actividad, no el punto de partida.
 *
 * Comentarios YA NO vive aquí: es un panel siempre visible al lado de la
 * ficha del equipo (ver `Fotos.tsx`), así que se saca de la pestaña para no
 * duplicarlo.
 */
export function PestanasFicha({
  contenidoActividades,
  contenidoFotos,
}: {
  contenidoActividades: ReactNode;
  contenidoFotos: ReactNode;
}) {
  const [activa, setActiva] = useState<IdPestana>('actividades');

  const pestanas: { id: IdPestana; etiqueta: string }[] = [
    { id: 'actividades', etiqueta: 'Actividades' },
    { id: 'fotos', etiqueta: 'Fotos' },
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
        {activa === 'actividades' && contenidoActividades}
        {activa === 'fotos' && contenidoFotos}
      </div>
    </div>
  );
}