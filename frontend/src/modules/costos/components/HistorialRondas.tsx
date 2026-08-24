import {
  CheckCircle2Icon,
  XCircleIcon,
  BanIcon,
  ClockIcon,
  RotateCcwIcon,
} from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { formatFecha, formatPrecio } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { HistorialRondas as Historial } from '@/modules/costos/lib/rondas';
import type {
  Aprobacion,
  CotizacionProveedor,
  DecisionAprobacion,
} from '@/modules/costos/types';

/** Cómo se pinta cada desenlace. En un solo sitio, como los estados. */
const DECISION: Record<
  DecisionAprobacion,
  {
    etiqueta: string;
    tono: 'success' | 'destructive' | 'outline';
    icono: typeof CheckCircle2Icon;
  }
> = {
  ACEPTADA: { etiqueta: 'Aceptada', tono: 'success', icono: CheckCircle2Icon },
  RECHAZADA: { etiqueta: 'Rechazada', tono: 'destructive', icono: XCircleIcon },
  SIN_ACUERDO: { etiqueta: 'Sin acuerdo', tono: 'outline', icono: BanIcon },
};

/**
 * El ciclo completo de §44, no solo la vuelta vigente.
 *
 * §44 admite rechazo → nueva evaluación → nueva decisión cuantas veces
 * haga falta, y el Aprobador que va a decidir la ronda 2 necesita ver
 * exactamente qué rechazó en la 1 y por qué: sin eso corre el riesgo de
 * rechazar dos veces lo mismo, o de aceptar algo que ya había devuelto.
 * «Se aprobó a la segunda» es información, y por eso el backend guarda
 * una fila por decisión en vez de sobrescribir.
 *
 * Las rondas se leen de la más reciente hacia atrás, que es como se
 * lee un expediente: primero dónde estamos, después cómo llegamos.
 */
export function HistorialRondas({
  historial,
  cotizaciones,
}: {
  historial: Historial;
  /** Para poner el total de la cotización de cada ronda. */
  cotizaciones: CotizacionProveedor[];
}) {
  const { rondas, sueltas, huboRechazo } = historial;

  if (rondas.length === 0 && sueltas.length === 0) return null;

  const totalDe = (cotizacionId: number) =>
    cotizaciones.find((c) => c.id === cotizacionId)?.total ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {rondas.length > 1 ? 'Rondas de evaluación' : 'La recomendación'}
        </h2>
        {huboRechazo && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RotateCcwIcon className="size-3.5" />
            Ya hubo una vuelta devuelta al gestor.
          </span>
        )}
      </div>

      <ol className="space-y-3">
        {rondas.map((r) => {
          const total = totalDe(r.evaluacion.cotizacionId);
          return (
            <li
              key={r.evaluacion.id}
              className={cn(
                'rounded-xl border p-4',
                r.vigente && r.pendiente
                  ? 'border-warning/30 bg-warning-soft/50'
                  : 'border-border',
                // Una ronda ya resuelta y superada se atenúa: sigue ahí
                // para consultarla, pero no compite por la atención con
                // la que hay que decidir.
                !r.vigente && 'opacity-75',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {rondas.length > 1 && (
                    <Badge variant="secondary">Ronda {r.ronda}</Badge>
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {r.evaluacion.cotizacion.proveedor.razonSocial}
                  </span>
                  {r.vigente && r.pendiente && (
                    <Badge variant="warning">
                      <ClockIcon />
                      Esperando tu decisión
                    </Badge>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatPrecio(total)}
                </span>
              </div>

              {/* §39: lo único que el gestor escribió para justificar. */}
              <div className="mt-2 rounded-lg border-l-2 border-border bg-muted/30 py-2 pl-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Justificación del gestor
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap text-foreground">
                  {r.evaluacion.justificacion}
                </p>
              </div>

              <p className="mt-1.5 text-xs text-muted-foreground">
                {r.evaluacion.gestor ? `${r.evaluacion.gestor.nombre} · ` : ''}
                {formatFecha(r.evaluacion.creadoEn)}
              </p>

              {r.decisiones.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-border pt-3">
                  {r.decisiones.map((d) => (
                    <li key={d.id}>
                      <LineaDecision decision={d} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      {/* §45: se cerró sin que hubiera nada que aprobar. */}
      {sueltas.length > 0 && (
        <ul className="space-y-2 rounded-xl border border-border p-4">
          {sueltas.map((d) => (
            <li key={d.id}>
              <LineaDecision decision={d} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LineaDecision({ decision }: { decision: Aprobacion }) {
  const { etiqueta, tono, icono: Icono } = DECISION[decision.decision];
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant={tono}>
          <Icono />
          {etiqueta}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {decision.aprobador ? `${decision.aprobador.nombre} · ` : ''}
          {formatFecha(decision.creadoEn)}
        </span>
      </div>
      {decision.comentario && (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">
          {decision.comentario}
        </p>
      )}
    </div>
  );
}
