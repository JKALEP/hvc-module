import { useState } from 'react';
import { CheckCircle2Icon, MessageSquareWarningIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Spinner } from '@/shared/ui/spinner';
import { formatFecha } from '@/shared/lib/format';
import type { Observacion } from '@/modules/costos/types';
import { Textarea } from '@/shared/ui/textarea';

/**
 * Las observaciones del gestor y su confirmación (§27-29).
 *
 * §29 pide «una acción para dejar constancia de que se revisó», y aquí
 * es lo que abre la puerta a devolver el requerimiento: mientras quede
 * una sin confirmar, el backend rechaza la reemisión. Por eso el aviso
 * de arriba dice cuántas faltan en vez de dejar que el usuario descubra
 * el bloqueo al pulsar el otro botón.
 *
 * La respuesta es opcional —§29 solo exige constancia— pero se ofrece
 * el campo porque es donde el solicitante cuenta QUÉ corrigió, y eso es
 * lo que el gestor va a leer al volver a mirarlo.
 */
export function PanelObservaciones({
  observaciones,
  puedeConfirmar,
  ocupado,
  onConfirmar,
}: {
  observaciones: Observacion[];
  /** Solo el solicitante dueño del requerimiento las confirma. */
  puedeConfirmar: boolean;
  ocupado: boolean;
  onConfirmar: (observacionId: number, respuesta: string) => void;
}) {
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});

  if (observaciones.length === 0) return null;

  const pendientes = observaciones.filter((o) => o.estado === 'PENDIENTE');

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquareWarningIcon className="size-4 text-warning" />
        <h2 className="text-sm font-semibold text-foreground">
          Observaciones del gestor
        </h2>
        {pendientes.length > 0 && (
          <Badge variant="warning">
            {pendientes.length} sin confirmar
          </Badge>
        )}
      </div>

      {pendientes.length > 0 && puedeConfirmar && (
        <p className="text-sm text-muted-foreground">
          Confirma cada observación para poder devolver el requerimiento
          corregido.
        </p>
      )}

      <div className="space-y-3">
        {observaciones.map((o) => {
          const atendida = o.estado === 'ATENDIDA';
          return (
            <article
              key={o.id}
              className={
                atendida
                  ? 'rounded-lg border border-border bg-muted/30 p-3'
                  : 'rounded-lg border border-warning/25 bg-warning-soft p-3'
              }
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm whitespace-pre-wrap text-foreground">
                  {o.texto}
                </p>
                {atendida && (
                  <Badge variant="success">
                    <CheckCircle2Icon />
                    Confirmada
                  </Badge>
                )}
              </div>

              <p className="mt-1.5 text-xs text-muted-foreground">
                {o.creadoPor?.nombre ?? 'Alguien'} · {formatFecha(o.creadoEn)}
              </p>

              {atendida && o.respuesta && (
                // Neutro a propósito: este panel lo leen el solicitante,
                // que escribió la respuesta, y el gestor, que la recibe.
                <p className="mt-2 border-l-2 border-border pl-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Respuesta:
                  </span>{' '}
                  {o.respuesta}
                </p>
              )}

              {!atendida && puedeConfirmar && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={respuestas[o.id] ?? ''}
                    onChange={(e) =>
                      setRespuestas((r) => ({ ...r, [o.id]: e.target.value }))
                    }
                    rows={2}
                    placeholder="Qué corregiste (opcional)."
                  />
                  <Button
                    size="sm"
                    disabled={ocupado}
                    onClick={() => onConfirmar(o.id, respuestas[o.id] ?? '')}
                  >
                    {ocupado ? <Spinner /> : <CheckCircle2Icon />}
                    Revisada y entendida
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
