import { useState } from 'react';
import { AwardIcon, AlertTriangleIcon, TrophyIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Spinner } from '@/shared/ui/spinner';
import { CLASES_TEXTAREA } from './Campo';
import { formatPrecio } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type {
  CotizacionProveedor,
  EvaluacionCotizacion,
  RecomendarPayload,
} from '@/modules/costos/types';

/**
 * El mismo mínimo que exige `EvaluacionService`.
 *
 * Duplicado a sabiendas: el backend lo vuelve a comprobar y es él quien
 * manda. Aquí está solo para no dejar que alguien escriba dos palabras,
 * pulse y reciba un 400 —avisar antes de gastar el viaje—.
 */
const MINIMO_JUSTIFICACION = 15;

/**
 * Recomendar una cotización (§38-39).
 *
 * §38 marca la distinción que sostiene todo el módulo: el Gestor
 * SELECCIONA y RECOMIENDA; no aprueba. Por eso el botón dice «Recomendar
 * al aprobador» y no «Aprobar», y por eso la cotización queda
 * RECOMENDADA y el requerimiento pasa a la mesa de otro.
 *
 * La justificación es obligatoria y con mínimo porque es literalmente lo
 * único que el Aprobador va a leer para decidir (§40). Un «ok» dejaría
 * la decisión sin fundamento por escrito, que es lo que §39 quiere
 * evitar.
 *
 * ── Corregir vs. abrir vuelta nueva ──────────────────────────────────
 * Mientras el Aprobador no se haya pronunciado, esto SUSTITUYE la
 * recomendación vigente en vez de abrir una ronda: el Gestor se
 * equivocó de cotización o quiere mejorar el texto, y eso no es una
 * vuelta del ciclo de §44 —inflaría el contador con erratas y haría
 * ilegible «se aprobó a la tercera»—. Quién de las dos cosas es lo
 * decide el BACKEND mirando si la evaluación vigente ya tiene
 * aprobación; aquí solo se anticipa el texto.
 */
export function DialogoRecomendar({
  cotizaciones,
  vigente,
  corrige,
  ocupado,
  onGuardar,
  onCerrar,
}: {
  cotizaciones: CotizacionProveedor[];
  /** La recomendación de ronda más alta, si ya hay alguna. */
  vigente?: EvaluacionCotizacion;
  /** El requerimiento ya está en la mesa del aprobador: esto la sustituye. */
  corrige: boolean;
  ocupado: boolean;
  onGuardar: (payload: RecomendarPayload) => void;
  onCerrar: () => void;
}) {
  const [cotizacionId, setCotizacionId] = useState<number | null>(
    vigente?.cotizacionId ?? null,
  );
  const [justificacion, setJustificacion] = useState(
    vigente?.justificacion ?? '',
  );

  /**
   * Solo se ofrecen las que el backend admitiría.
   *
   * Una DESCARTADA la sacó el propio Gestor, y una pendiente de revisar
   * puso precio a algo que ya cambió (§54): recomendarla sería pedirle
   * al Aprobador que decida sobre un número que no corresponde a lo que
   * se pide. El backend rechaza las dos; ofrecerlas sería enseñar una
   * puerta cerrada.
   */
  const elegibles = cotizaciones.filter(
    (c) => c.estado !== 'DESCARTADA' && !c.requiereRevision,
  );
  const bloqueadas = cotizaciones.length - elegibles.length;

  const masBarata = elegibles.length
    ? Math.min(...elegibles.map((c) => c.total))
    : null;

  const limpia = justificacion.trim();
  const valido =
    cotizacionId !== null && limpia.length >= MINIMO_JUSTIFICACION;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {corrige ? 'Corregir la recomendación' : 'Recomendar una cotización'}
          </DialogTitle>
          <DialogDescription>
            {corrige
              ? 'El aprobador todavía no se ha pronunciado, así que esto sustituye lo recomendado. El cambio queda en la bitácora.'
              : 'Eliges y justificas; la decisión es del aprobador. La cotización queda recomendada, no aprobada.'}
          </DialogDescription>
        </DialogHeader>

        {elegibles.length === 0 ? (
          <p className="rounded-lg border border-amber-600/25 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            No hay ninguna cotización que se pueda recomendar: están
            descartadas o pendientes de revisar. Actualiza la que corresponda
            antes de seguir.
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              Cuál se recomienda<span className="text-destructive"> *</span>
            </p>
            <ul className="space-y-2">
              {elegibles.map((c) => {
                const marcada = cotizacionId === c.id;
                return (
                  <li key={c.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        marcada
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50',
                      )}
                    >
                      <input
                        type="radio"
                        name="cotizacion"
                        checked={marcada}
                        onChange={() => setCotizacionId(c.id)}
                        className="mt-1 size-4 shrink-0 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                            {c.proveedor.razonSocial}
                            {c.total === masBarata && (
                              <Badge variant="success">
                                <TrophyIcon />
                                Más bajo
                              </Badge>
                            )}
                            {c.estado === 'RECOMENDADA' && (
                              <Badge variant="warning">actual</Badge>
                            )}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {formatPrecio(c.total)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.items.length} línea(s)
                          {c.plazoEntrega ? ` · entrega ${c.plazoEntrega}` : ''}
                          {c.garantia ? ` · garantía ${c.garantia}` : ''}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>

            {bloqueadas > 0 && (
              <p className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {bloqueadas} cotización(es) no se pueden recomendar: están
                  descartadas o pendientes de revisar.
                </span>
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Por qué ésa<span className="text-destructive"> *</span>
          </label>
          <textarea
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            rows={5}
            placeholder="Ventajas frente a las otras, cómo se compararon y por qué se elige ésta. Ej.: es la más barata en los tres ítems principales y la única que entrega en 5 días; la de X es 3 % menor en total pero no cotizó el ítem 4."
            className={CLASES_TEXTAREA}
          />
          <p className="text-xs text-muted-foreground">
            {limpia.length >= MINIMO_JUSTIFICACION
              ? 'Es lo único que el aprobador va a leer para decidir.'
              : `Faltan ${String(MINIMO_JUSTIFICACION - limpia.length)} caracteres. Es lo único que el aprobador va a leer para decidir.`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              valido &&
              onGuardar({
                cotizacionId: cotizacionId,
                justificacion: limpia,
              })
            }
            disabled={!valido || ocupado}
          >
            {ocupado ? <Spinner /> : <AwardIcon />}
            {corrige ? 'Guardar recomendación' : 'Recomendar al aprobador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
