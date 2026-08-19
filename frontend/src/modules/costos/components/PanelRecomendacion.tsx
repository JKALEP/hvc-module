import { AwardIcon, PencilIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { formatFecha, formatPrecio } from '@/shared/lib/format';
import type {
  CotizacionProveedor,
  EvaluacionCotizacion,
} from '@/modules/costos/types';

/**
 * Lo que el Gestor recomendó, vuelta por vuelta (§38-39, §44).
 *
 * Se listan TODAS las rondas y no solo la vigente. §44 admite rechazo →
 * nueva evaluación → nueva decisión, y guardar solo la última borraría
 * por qué se había recomendado la anterior: «se aprobó a la segunda» es
 * información, y el expediente tiene que poder contarlo dentro de un
 * año.
 *
 * La VIGENTE es la de ronda más alta. No hay booleano que mirar: se
 * deriva del orden en que llegan (el backend las manda de mayor a
 * menor), igual que el avance de un proyecto tampoco se almacena.
 */
export function PanelRecomendacion({
  evaluaciones,
  cotizaciones,
  puedeRecomendar,
  onRecomendar,
}: {
  evaluaciones: EvaluacionCotizacion[];
  cotizaciones: CotizacionProveedor[];
  /** Sale de `acciones` del backend: incluye poder corregir la vigente. */
  puedeRecomendar: boolean;
  onRecomendar: () => void;
}) {
  const [vigente, ...anteriores] = evaluaciones;
  const totalDe = (cotizacionId: number) =>
    cotizaciones.find((c) => c.id === cotizacionId)?.total ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Recomendación
          </h2>
          <p className="text-sm text-muted-foreground">
            Eliges y justificas; la decisión es del aprobador.
          </p>
        </div>
        {puedeRecomendar && (
          <Button onClick={onRecomendar} variant={vigente ? 'outline' : 'default'}>
            {vigente ? <PencilIcon /> : <AwardIcon />}
            {vigente ? 'Corregir recomendación' : 'Recomendar una cotización'}
          </Button>
        )}
      </div>

      {!vigente ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Todavía no has recomendado ninguna. Compara y elige la que
          convenga.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">Vigente</Badge>
                <span className="text-sm font-medium text-foreground">
                  {vigente.cotizacion.proveedor.razonSocial}
                </span>
                {evaluaciones.length > 1 && (
                  <span className="text-xs text-muted-foreground">
                    ronda {vigente.ronda}
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {formatPrecio(totalDe(vigente.cotizacionId))}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {vigente.justificacion}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {vigente.gestor ? `${vigente.gestor.nombre} · ` : ''}
              {formatFecha(vigente.creadoEn)}
            </p>
          </div>

          {anteriores.length > 0 && (
            <details className="rounded-xl border border-border">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-foreground">
                {anteriores.length} vuelta(s) anterior(es)
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {anteriores.map((e) => (
                  <li key={e.id} className="space-y-1 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-foreground">
                        Ronda {e.ronda} — {e.cotizacion.proveedor.razonSocial}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFecha(e.creadoEn)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {e.justificacion}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
