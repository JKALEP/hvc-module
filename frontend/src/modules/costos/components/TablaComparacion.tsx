import { useState } from 'react';
import {
  TrophyIcon,
  AlertTriangleIcon,
  BanIcon,
  ScaleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from 'lucide-react';

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/shared/ui/table';
import { Badge } from '@/shared/ui/badge';
import { formatPrecio, formatFechaCorta, orDash } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { Comparacion } from '@/modules/costos/types';

/**
 * La comparación entre proveedores (§37).
 *
 * Dos vistas de lo mismo porque son dos decisiones distintas, y las dos
 * las calcula el backend:
 *
 *   · por proveedor — el total, la garantía, el plazo y las condiciones
 *     de un vistazo. Sirve para elegir con quién trabajar.
 *   · por ítem — qué ofreció cada uno en cada línea. Sirve para ver que
 *     el más barato en total puede no serlo en la línea que importa, y
 *     para detectar a quién le faltó cotizar algo.
 *
 * ── Lo que NO decide esta tabla ──────────────────────────────────────
 * Ni el mejor total ni el mejor precio por ítem se calculan aquí: llegan
 * hechos (`totalMasBajo`, `mejorPrecioUnitario`). Es deliberado —el
 * backend ya sabe que una DESCARTADA y una pendiente de revisar no
 * compiten, y rehacer ese criterio en la pantalla sería tener dos
 * versiones de «el más barato» esperando a discrepar—.
 *
 * Las que no compiten se siguen viendo, atenuadas y con su motivo: §40
 * le da al Aprobador derecho a ver todas las cotizaciones, y una fila
 * escondida es información que se pierde.
 *
 * ── Qué fila va en verde ─────────────────────────────────────────────
 * Por defecto, la del total más bajo: es lo que el Gestor está
 * decidiendo. Pero el Aprobador no elige, se pronuncia sobre lo que YA
 * eligió otro, y §40 pide que lo recomendado sea lo que destaque — así
 * que pasa `cotizacionDestacada` y el verde sigue a esa fila.
 *
 * El trofeo de «Más bajo» se queda donde esté en los dos casos, y ahí
 * está la gracia: cuando la recomendada NO es la más barata, las dos
 * marcas caen en filas distintas y el Aprobador ve de un vistazo la
 * única pregunta que le importa —por qué no se eligió la barata—, que
 * es justo lo que la justificación del gestor tiene que contestar.
 */
export function TablaComparacion({
  comparacion,
  cotizacionDestacada,
}: {
  comparacion: Comparacion;
  /** Si se pasa, el verde sigue a esta cotización y no al total más bajo. */
  cotizacionDestacada?: number | null;
}) {
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());

  const alternar = (id: number) =>
    setAbiertos((antes) => {
      const copia = new Set(antes);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });

  const { proveedores, items, extras, totalMasBajo, totalItemsPedidos } =
    comparacion;

  return (
    <div className="space-y-6">
      {/* ── Una fila por proveedor ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Por proveedor
          </h3>
          {totalMasBajo === null && proveedores.length > 0 && (
            <span className="text-xs text-warning-soft-foreground">
              Ninguna compite ahora mismo: están descartadas o pendientes de
              revisar.
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="min-w-44">Proveedor</TableHead>
                <TableHead className="text-right">Total S/</TableHead>
                <TableHead className="text-right">Cubre</TableHead>
                <TableHead>Plazo</TableHead>
                <TableHead>Garantía</TableHead>
                <TableHead className="min-w-32">Pago</TableHead>
                <TableHead>Vigencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proveedores.map((p) => {
                const fuera = p.estado === 'DESCARTADA' || p.requiereRevision;
                const esMejor = !fuera && p.total === totalMasBajo;
                const destacada =
                  cotizacionDestacada === undefined ||
                  cotizacionDestacada === null
                    ? esMejor
                    : p.cotizacionId === cotizacionDestacada;
                return (
                  <TableRow
                    key={p.cotizacionId}
                    className={cn(
                      destacada &&
                        'bg-success-soft/60 hover:bg-success-soft',
                      fuera && 'opacity-60',
                    )}
                  >
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-foreground">
                          {p.proveedor}
                        </span>
                        {esMejor && (
                          <Badge variant="success">
                            <TrophyIcon />
                            Más bajo
                          </Badge>
                        )}
                        {p.estado === 'RECOMENDADA' && (
                          <Badge variant="warning">Recomendada</Badge>
                        )}
                        {p.estado === 'DESCARTADA' && (
                          <Badge variant="outline">
                            <BanIcon />
                            Descartada
                          </Badge>
                        )}
                      </div>
                      {p.requiereRevision && (
                        <p className="mt-1 flex items-start gap-1 text-xs text-warning-soft-foreground">
                          <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
                          <span>
                            Fuera de la comparación:{' '}
                            {p.revisionMotivo ?? 'cambió lo que se pide.'}
                          </span>
                        </p>
                      )}
                      {p.observaciones && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {p.observaciones}
                        </p>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        destacada && 'text-success-soft-foreground',
                      )}
                    >
                      {formatPrecio(p.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={cn(
                          p.itemsCubiertos < totalItemsPedidos &&
                            'text-warning-soft-foreground',
                        )}
                      >
                        {p.itemsCubiertos}/{totalItemsPedidos}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {orDash(p.plazoEntrega)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {orDash(p.garantia)}
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {orDash(p.condicionesPago)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.validaHasta ? formatFechaCorta(p.validaHasta) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Una fila por ítem pedido ── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Por ítem</h3>
        <p className="text-sm text-muted-foreground">
          El más barato en total no siempre lo es en la línea que importa.
          Despliega un ítem para ver qué ofreció cada uno.
        </p>

        <ul className="divide-y divide-border rounded-xl border border-border">
          {items.map((item) => {
            const abierto = abiertos.has(item.requerimientoItemId);
            const nadie = item.ofertas.length === 0;
            return (
              <li key={item.requerimientoItemId}>
                <button
                  onClick={() => alternar(item.requerimientoItemId)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
                >
                  {abierto ? (
                    <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {item.descripcion}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.cantidad} {item.unidad}
                      {item.referencias ? ` · ${item.referencias}` : ''}
                    </p>
                  </div>
                  {nadie ? (
                    <Badge variant="warning">nadie lo cotizó</Badge>
                  ) : (
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      desde{' '}
                      <span className="font-medium text-foreground">
                        {formatPrecio(item.mejorPrecioUnitario)}
                      </span>
                      <span className="text-xs"> /{item.unidad}</span>
                    </span>
                  )}
                </button>

                {abierto && !nadie && (
                  <div className="border-t border-border bg-muted/20 px-3 py-2">
                    <ul className="space-y-1">
                      {item.ofertas.map((o, i) => {
                        const fuera = o.estado === 'DESCARTADA';
                        const esMejor =
                          !fuera &&
                          item.mejorPrecioUnitario !== null &&
                          o.precioUnitario === item.mejorPrecioUnitario;
                        return (
                          <li
                            key={`${String(o.cotizacionId)}-${String(i)}`}
                            className={cn(
                              'flex flex-wrap items-center justify-between gap-2 text-sm',
                              fuera && 'opacity-60',
                            )}
                          >
                            <span className="flex items-center gap-1.5 text-foreground">
                              {o.proveedor}
                              {esMejor && (
                                <TrophyIcon className="size-3.5 text-success" />
                              )}
                              {fuera && (
                                <Badge variant="outline">descartada</Badge>
                              )}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {o.cantidad} × {formatPrecio(o.precioUnitario)} ={' '}
                              <span className="font-medium text-foreground">
                                {formatPrecio(o.subtotal)}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {abierto && nadie && (
                  <p className="border-t border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    Ningún proveedor puso precio a este ítem. Si nadie lo
                    ofrece, habrá que pedírselo a alguien más o quitarlo del
                    requerimiento.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Lo que ningún ítem pedido reclama (§36) ── */}
      {extras.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ScaleIcon className="size-4 text-muted-foreground" />
            Líneas añadidas por los proveedores
          </h3>
          <p className="text-sm text-muted-foreground">
            No responden a ningún ítem pedido —flete, instalación— pero sí
            cuentan en el total de quien las puso.
          </p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {extras.map((o, i) => (
              <li
                key={`${String(o.cotizacionId)}-extra-${String(i)}`}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm',
                  o.estado === 'DESCARTADA' && 'opacity-60',
                )}
              >
                <span className="text-foreground">
                  {o.descripcion}
                  <span className="text-muted-foreground"> — {o.proveedor}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {o.cantidad} × {formatPrecio(o.precioUnitario)} ={' '}
                  <span className="font-medium text-foreground">
                    {formatPrecio(o.subtotal)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
