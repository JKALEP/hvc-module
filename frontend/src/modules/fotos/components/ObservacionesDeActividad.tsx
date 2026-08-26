import { useState } from 'react';
import { AlertCircleIcon, CheckIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { cn } from '@/shared/lib/utils';
import {
  useObservacionesDeActividad,
  useCrearObservacionEnActividad,
  useResolverObservacion,
  useEliminarObservacion,
} from '@/modules/fotos/hooks/useObservaciones';

/**
 * Lo que quedó pendiente EN una actividad concreta.
 *
 * ⚠️ Es distinto de un comentario, y por eso son dos cosas y no una: un
 * comentario se responde, una observación se RESUELVE. Lo que este panel
 * añade es el check y el rastro de quién lo cerró.
 *
 * Vive dentro de la actividad porque ahí es donde se levanta —«el filtro está
 * roto» cuelga de «Revisar filtros»— y por eso el panel general del equipo no
 * las repite: contarlas en los dos sitios sería contar dos veces el mismo
 * pendiente. Cuando su intervención pasa, la observación sí aparece en el panel
 * general de la siguiente, arrastrada: su actividad ya no está a la vista.
 */
export function ObservacionesDeActividad({
  actividadId,
  puedeEscribir,
  puedeModerar,
  usuarioId,
  portal = false,
}: {
  actividadId: number;
  puedeEscribir: boolean;
  puedeModerar: boolean;
  usuarioId: number | null | undefined;
  portal?: boolean;
}) {
  const { data: observaciones, isError } =
    useObservacionesDeActividad(actividadId);
  const crear = useCrearObservacionEnActividad();
  const resolver = useResolverObservacion();
  const eliminar = useEliminarObservacion();

  const [texto, setTexto] = useState('');

  const registrar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    crear.mutate(
      { actividadId, texto: limpio },
      { onSuccess: () => setTexto('') },
    );
  };

  if (!observaciones && !isError)
    return (
      <div className="flex justify-center py-2">
        <Spinner />
      </div>
    );

  const escribible = puedeEscribir && !portal;

  // Sin ninguna y sin poder escribir no se pinta nada: en una lista de diez
  // actividades, diez secciones vacías son ruido.
  if ((observaciones ?? []).length === 0 && !escribible) return null;

  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <AlertCircleIcon className="size-4" />
        Observaciones de esta actividad
      </h4>

      {isError && (
        <p className="text-sm text-destructive">
          No se pudieron cargar las observaciones.
        </p>
      )}

      {observaciones?.length === 0 && (
        <p className="text-xs text-muted-foreground">Nada pendiente aquí.</p>
      )}

      <ul className="space-y-1.5">
        {(observaciones ?? []).map((o) => {
          const resuelta = o.estado === 'RESUELTA';
          const esMia = o.creadoPor?.id === usuarioId;
          const puedeBorrar = esMia ? escribible : puedeModerar && !portal;
          return (
            <li key={o.id} className="flex items-start gap-2">
              {escribible && (
                <button
                  type="button"
                  aria-label={resuelta ? 'Volver a abrir' : 'Dar por resuelta'}
                  title={resuelta ? 'Volver a abrir' : 'Dar por resuelta'}
                  disabled={resolver.isPending}
                  onClick={() =>
                    resolver.mutate({ id: o.id, resuelta: !resuelta })
                  }
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                    resuelta
                      ? 'border-success bg-success-soft text-success-soft-foreground'
                      : 'border-input hover:border-ring',
                  )}
                >
                  {resuelta && <CheckIcon className="size-3" />}
                </button>
              )}
              <span
                className={cn(
                  'min-w-0 flex-1 text-sm',
                  resuelta && 'text-muted-foreground line-through',
                )}
              >
                {o.texto}
                <span className="ml-2 text-xs text-muted-foreground">
                  {o.creadoPor?.nombre}
                  {resuelta &&
                    o.resueltaPor &&
                    ` · resuelta por ${o.resueltaPor.nombre}`}
                </span>
              </span>
              {puedeBorrar && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Eliminar la observación"
                  disabled={eliminar.isPending}
                  onClick={() => eliminar.mutate(o.id)}
                >
                  <Trash2Icon />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {escribible && (
        <div className="mt-2 flex gap-2">
          <Input
            className="h-8"
            placeholder="Registrar observación…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && registrar()}
          />
          <Button
            size="sm"
            onClick={registrar}
            disabled={!texto.trim() || crear.isPending}
          >
            {crear.isPending && <Spinner />}
            Registrar
          </Button>
        </div>
      )}
    </div>
  );
}
