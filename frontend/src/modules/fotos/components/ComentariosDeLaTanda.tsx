import { useState } from 'react';
import { ChevronDownIcon, MessageCircleIcon } from 'lucide-react';

import { HiloComentarios } from '@/modules/fotos/components/HiloComentarios';
import { cn } from '@/shared/lib/utils';
import type { PermisoCarpeta } from '@/modules/fotos/types';

/**
 * El comentario DEL CONJUNTO (Fase 6 del rediseño).
 *
 * Una foto se sube sola o en tanda, y las dos escalas de comentario son
 * OPCIONALES e independientes: lo que se dice de **la tanda** vive aquí,
 * colgado de la intervención; lo que se dice de **una foto** vive en el visor,
 * colgado de ella. Una subida en conjunto puede llevar el de grupo, los de
 * cada foto, los dos o ninguno — nada obliga a rellenar nada.
 *
 * ⚠️ Va **plegado por defecto**, y es la misma razón por la que lo estaba el
 * hilo del álbum al que sustituye: la pestaña de Fotos existe para mirar
 * fotos, y un hilo desplegado encima de la rejilla compite con ellas. Se
 * despliega quien viene a leerlo o a escribir.
 *
 * Y va **dentro de la pestaña de Fotos y no al lado de la ficha**, donde ya
 * hay un hilo: aquél es del EQUIPO —lo que se dice de la máquina, y vale para
 * todas sus intervenciones—; éste es de ESTA intervención. Dos preguntas
 * distintas, dos sitios distintos.
 */
export function ComentariosDeLaTanda({
  intervencionId,
  permiso,
  ramaCerrada,
  portal = false,
}: {
  intervencionId: number;
  permiso: PermisoCarpeta | null;
  ramaCerrada: boolean;
  portal?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="rounded-lg border border-border/60">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <MessageCircleIcon className="size-4 shrink-0" />
        <span className="flex-1 text-left">Comentarios de esta intervención</span>
        <ChevronDownIcon
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            abierto && 'rotate-180',
          )}
        />
      </button>

      {abierto && (
        <div className="border-t border-border/60 px-3 py-3">
          <HiloComentarios
            entidad="intervencion"
            entidadId={intervencionId}
            permiso={permiso}
            ramaCerrada={ramaCerrada}
            portal={portal}
          />
        </div>
      )}
    </div>
  );
}
