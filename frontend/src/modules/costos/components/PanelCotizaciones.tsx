import {
  PlusIcon,
  PencilIcon,
  BanIcon,
  AlertTriangleIcon,
  FileTextIcon,
} from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { formatPrecio, formatFechaCorta, orDash } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type {
  CotizacionProveedor,
  EstadoCotizacionProveedor,
} from '@/modules/costos/types';

/**
 * Cómo se pinta cada estado de una cotización.
 *
 * En un solo sitio por lo mismo que `lib/estados.ts` centraliza los del
 * requerimiento: son cinco valores que aparecen en tres pantallas, y
 * repartirlos garantiza que alguna acabe diciendo otra cosa.
 */
const ESTADO: Record<
  EstadoCotizacionProveedor,
  { etiqueta: string; tono: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' }
> = {
  REGISTRADA: { etiqueta: 'Registrada', tono: 'secondary' },
  RECOMENDADA: { etiqueta: 'Recomendada', tono: 'warning' },
  APROBADA: { etiqueta: 'Aprobada', tono: 'success' },
  RECHAZADA: { etiqueta: 'Rechazada', tono: 'destructive' },
  DESCARTADA: { etiqueta: 'Descartada', tono: 'outline' },
};

/**
 * Las cotizaciones que llegaron (§34-36).
 *
 * Una tarjeta por proveedor con lo que §37 pide comparar de un vistazo.
 * La comparación fina —línea a línea— es otra vista; aquí se ve QUÉ hay
 * y se corrige lo que esté mal tecleado.
 *
 * Una cotización nunca se borra: se DESCARTA. §40 dice que el Aprobador
 * ve todas, así que esconder la que llegó tarde le quitaría información;
 * lo que hace descartarla es sacarla de la competición por el mejor
 * precio, no de la historia.
 */
export function PanelCotizaciones({
  cotizaciones,
  puedeEditar,
  onRegistrar,
  onEditar,
  onDescartar,
}: {
  cotizaciones: CotizacionProveedor[];
  /** Lo dice `acciones` del backend, no el estado deducido aquí. */
  puedeEditar: boolean;
  onRegistrar: () => void;
  onEditar: (cotizacion: CotizacionProveedor) => void;
  onDescartar: (cotizacion: CotizacionProveedor) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Cotizaciones recibidas
          </h2>
          <p className="text-sm text-muted-foreground">
            {cotizaciones.length === 0
              ? 'Todavía no se ha registrado ninguna.'
              : `${String(cotizaciones.length)} de proveedor(es) distintos.`}
          </p>
        </div>
        {puedeEditar && (
          <Button onClick={onRegistrar}>
            <PlusIcon />
            Registrar cotización
          </Button>
        )}
      </div>

      {cotizaciones.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border p-8 text-center">
          <FileTextIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Sin cotizaciones
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Cuando un proveedor responda, se teclea aquí lo que hace falta
            para compararlo con los demás.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {cotizaciones.map((c) => {
            const presentacion = ESTADO[c.estado];
            const fuera = c.estado === 'DESCARTADA';
            return (
              <li
                key={c.id}
                className={cn(
                  'space-y-3 rounded-xl border p-4',
                  c.requiereRevision
                    ? 'border-warning/30 bg-warning-soft/50'
                    : 'border-border',
                  fuera && 'opacity-60',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {c.proveedor.razonSocial}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.proveedor.ruc ? `RUC ${c.proveedor.ruc}` : 'sin RUC'} ·
                      cotizó el {formatFechaCorta(c.fechaCotizacion)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={presentacion.tono}>
                      {presentacion.etiqueta}
                    </Badge>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatPrecio(c.total)}
                    </span>
                  </div>
                </div>

                {/* §54: puso precio a algo que después cambió. */}
                {c.requiereRevision && (
                  <p className="flex items-start gap-1.5 text-xs text-warning-soft-foreground">
                    <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      Pendiente de revisar:{' '}
                      {c.revisionMotivo ??
                        'un ítem cambió después de recibirla.'}{' '}
                      No se puede recomendar hasta actualizarla.
                    </span>
                  </p>
                )}

                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  <Dupla etiqueta="Líneas" valor={String(c.items.length)} />
                  <Dupla
                    etiqueta="Válida hasta"
                    valor={
                      c.validaHasta ? formatFechaCorta(c.validaHasta) : '—'
                    }
                  />
                  <Dupla etiqueta="Plazo" valor={orDash(c.plazoEntrega)} />
                  <Dupla etiqueta="Garantía" valor={orDash(c.garantia)} />
                  <Dupla
                    etiqueta="Pago"
                    valor={orDash(c.condicionesPago)}
                    ancho
                  />
                  {c.observaciones && (
                    <Dupla etiqueta="Notas" valor={c.observaciones} ancho />
                  )}
                </dl>

                {puedeEditar && c.estado !== 'APROBADA' && (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditar(c)}
                    >
                      <PencilIcon />
                      Corregir
                    </Button>
                    {!fuera && c.estado !== 'RECOMENDADA' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDescartar(c)}
                      >
                        <BanIcon />
                        Descartar
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Dupla({
  etiqueta,
  valor,
  ancho,
}: {
  etiqueta: string;
  valor: string;
  ancho?: boolean;
}) {
  return (
    <div className={ancho ? 'sm:col-span-2' : undefined}>
      <dt className="font-medium tracking-wide text-muted-foreground uppercase">
        {etiqueta}
      </dt>
      <dd className="text-foreground">{valor}</dd>
    </div>
  );
}
