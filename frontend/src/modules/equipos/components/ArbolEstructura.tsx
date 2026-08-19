import { useState } from 'react';
import {
  ChevronRightIcon,
  FolderIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import type { NodoEstructura } from '@/modules/equipos/types';

/**
 * Una rama del árbol de ubicaciones.
 *
 * Definida al nivel del módulo y NO dentro del componente padre: un
 * componente declarado dentro de otro se recrea en cada render y el
 * campo de texto perdería el foco en cada tecla. Ya nos pasó con el
 * árbol de sedes de Fotos.
 */
function Rama({
  nodo,
  nivel,
  onAbrir,
  onAgregar,
  onRenombrar,
  onEliminar,
}: {
  nodo: NodoEstructura;
  nivel: number;
  onAbrir?: (nodoId: number) => void;
  onAgregar: (padreId: number) => void;
  onRenombrar: (nodo: NodoEstructura) => void;
  onEliminar: (nodo: NodoEstructura) => void;
}) {
  const [abierto, setAbierto] = useState(true);
  const tieneHijos = nodo.hijos.length > 0;

  return (
    <li>
      <div
        className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-muted/50"
        style={{ paddingLeft: `${8 + nivel * 20}px` }}
      >
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          disabled={!tieneHijos}
          aria-expanded={abierto}
          aria-label={abierto ? 'Contraer' : 'Expandir'}
          className="rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-0"
        >
          <ChevronRightIcon
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              abierto && 'rotate-90',
            )}
          />
        </button>

        <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
        <button
          type="button"
          onClick={() => onAbrir?.(nodo.id)}
          disabled={!onAbrir}
          className="truncate rounded text-sm font-medium text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:no-underline"
          title={onAbrir ? 'Ver el inventario de esta ubicación' : undefined}
        >
          {nodo.nombre}
        </button>

        {nodo.equipos > 0 && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {nodo.equipos} equipo(s)
          </span>
        )}

        <div className="ml-auto flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Agregar dentro de ${nodo.nombre}`}
            onClick={() => onAgregar(nodo.id)}
          >
            <PlusIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Renombrar ${nodo.nombre}`}
            onClick={() => onRenombrar(nodo)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar ${nodo.nombre}`}
            onClick={() => onEliminar(nodo)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      {abierto && tieneHijos && (
        <ul>
          {nodo.hijos.map((h) => (
            <Rama
              key={h.id}
              nodo={h}
              nivel={nivel + 1}
              onAbrir={onAbrir}
              onAgregar={onAgregar}
              onRenombrar={onRenombrar}
              onEliminar={onEliminar}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * El árbol de ubicaciones de una organización.
 *
 * Sin límite de profundidad a propósito: un cliente organiza su
 * inventario en dos niveles y otro en cinco, y el modelo no impone
 * ninguno.
 */
export function ArbolEstructura({
  nodos,
  onAbrir,
  onAgregar,
  onRenombrar,
  onEliminar,
}: {
  nodos: NodoEstructura[];
  /** Sin esto, el nombre no es pulsable. */
  onAbrir?: (nodoId: number) => void;
  onAgregar: (padreId: number | null) => void;
  onRenombrar: (nodo: NodoEstructura) => void;
  onEliminar: (nodo: NodoEstructura) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {nodos.map((n) => (
        <Rama
          key={n.id}
          nodo={n}
          nivel={0}
          onAbrir={onAbrir}
          onAgregar={onAgregar}
          onRenombrar={onRenombrar}
          onEliminar={onEliminar}
        />
      ))}
    </ul>
  );
}
