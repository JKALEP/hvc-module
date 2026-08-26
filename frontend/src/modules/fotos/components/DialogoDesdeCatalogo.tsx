import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import {
  useCatalogoActividades,
  useAnadirDesdeCatalogo,
} from '@/modules/fotos/hooks/useCatalogoFotos';

/**
 * Traer actividades del catálogo a la intervención en curso (Fase 2).
 *
 * Enseña el catálogo ENTERO y no solo lo del tipo de sistema del equipo, a
 * propósito: aquí no se está dando de alta nada, se está completando una
 * intervención concreta, y en obra aparece trabajo que el molde no previó. La
 * preselección por tipo manda en el alta; aquí manda quien está delante.
 *
 * ⚠️ Lo que ya está en la intervención se enseña marcado y deshabilitado en vez de
 * esconderse: ver que «Limpieza de filtros» ya está puesta contesta la
 * pregunta, y ocultarla haría pensar que falta del catálogo.
 */
export function DialogoDesdeCatalogo({
  intervencionId,
  yaPuestas,
  onCerrar,
}: {
  intervencionId: number;
  /** Los títulos que ya tiene la intervención. El servidor salta por TÍTULO. */
  yaPuestas: Set<string>;
  onCerrar: () => void;
}) {
  const { data: catalogo, isError } = useCatalogoActividades({
    soloActivas: true,
  });
  const anadir = useAnadirDesdeCatalogo();
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());

  const disponibles = (catalogo ?? []).filter((d) => !yaPuestas.has(d.nombre));

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Añadir del catálogo</DialogTitle>
          <DialogDescription>
            Se añaden a la intervención en curso. Las que ya están se saltan.
          </DialogDescription>
        </DialogHeader>

        {!catalogo && !isError && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive">
            No se pudo cargar el catálogo de actividades.
          </p>
        )}

        {catalogo?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            El catálogo está vacío. Se configura en Administración de Fotos.
          </p>
        )}

        {catalogo && catalogo.length > 0 && (
          <ul className="space-y-1">
            {catalogo.map((d) => {
              const puesta = yaPuestas.has(d.nombre);
              return (
                <li key={d.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id={`cat-${d.id}`}
                    className="mt-1"
                    disabled={puesta}
                    checked={puesta || elegidas.has(d.id)}
                    onChange={(e) =>
                      setElegidas((s) => {
                        const siguiente = new Set(s);
                        if (e.target.checked) siguiente.add(d.id);
                        else siguiente.delete(d.id);
                        return siguiente;
                      })
                    }
                  />
                  <label htmlFor={`cat-${d.id}`} className="text-sm">
                    {d.nombre}
                    {puesta && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ya está en esta intervención
                      </span>
                    )}
                    {d.descripcion && (
                      <span className="block text-xs text-muted-foreground">
                        {d.descripcion}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={anadir.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={
              anadir.isPending || elegidas.size === 0 || disponibles.length === 0
            }
            onClick={() =>
              anadir.mutate(
                { intervencionId, definiciones: [...elegidas] },
                { onSuccess: onCerrar },
              )
            }
          >
            {anadir.isPending && <Spinner />}
            Añadir {elegidas.size > 0 ? `(${elegidas.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
