import { CheckIcon, XIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Spinner } from '@/shared/ui/spinner';
import { cn } from '@/shared/lib/utils';
import { useCalendarioPersona } from '@/modules/personal/hooks/useJornadas';
import { fechaCorta } from '@/modules/personal/lib/obra';

/**
 * Calendario de una persona en ESTA obra.
 *
 * Solo de este proyecto: el historial de alguien entre varios proyectos
 * pertenece al futuro módulo de Personal, no a la ficha de una obra.
 */
export function ModalPersona({
  proyectoId,
  documento,
  onCerrar,
}: {
  proyectoId: number;
  documento: string;
  onCerrar: () => void;
}) {
  const { data, isLoading, isError } = useCalendarioPersona(
    proyectoId,
    documento,
  );

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{data?.nombre ?? 'Cargando…'}</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.empresa} · ${data.diasParticipados} de ${data.diasDelProyecto} días del proyecto`
              : 'Buscando su participación en la obra.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Spinner className="size-5" />
          </div>
        )}

        {isError && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No se pudo cargar el calendario de esta persona.
          </p>
        )}

        {data && (
          <div className="grid max-h-80 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-5">
            {data.dias.map((d) => (
              <div
                key={d.fecha}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-xs',
                  d.participo
                    ? 'border-emerald-600/25 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                    : 'border-border bg-muted/30',
                )}
              >
                <span className="text-muted-foreground">
                  {fechaCorta(d.fecha)}
                </span>
                {d.participo ? (
                  <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XIcon className="size-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
