import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ClipboardListIcon,
  CheckCircle2Icon,
  XCircleIcon,
  BanIcon,
  AwardIcon,
  TrophyIcon,
  AlertTriangleIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Dato, EstadoBadge } from '@/modules/costos/components/Campo';
import { TablaItems } from '@/modules/costos/components/TablaItems';
import { BotonesExportar } from '@/modules/costos/components/BotonesExportar';
import { PanelObservaciones } from '@/modules/costos/components/PanelObservaciones';
import { TablaComparacion } from '@/modules/costos/components/TablaComparacion';
import { HistorialRondas } from '@/modules/costos/components/HistorialRondas';
import { DialogoDecision } from '@/modules/costos/components/DialogoDecision';
import { useRequerimiento } from '@/modules/costos/hooks/useRequerimientos';
import { useObservaciones } from '@/modules/costos/hooks/useObservaciones';
import {
  useCotizaciones,
  useComparacion,
  useEvaluaciones,
} from '@/modules/costos/hooks/useCotizaciones';
import {
  useAprobaciones,
  useDecidir,
} from '@/modules/costos/hooks/useAprobaciones';
import { construirRondas } from '@/modules/costos/lib/rondas';
import { tareaDe } from '@/modules/costos/lib/estados';
import { formatFechaCorta, formatPrecio, orDash } from '@/shared/lib/format';
import type {
  AccionRequerimiento,
  DecisionAprobacion,
} from '@/modules/costos/types';

/**
 * El panel de decisión del Aprobador (§40-45).
 *
 * §40 enumera lo que tiene que poder ver antes de pronunciarse: el
 * requerimiento completo, todos sus ítems, TODAS las cotizaciones
 * recibidas, cuál recomendó el gestor y por qué. Eso son cuatro
 * consultas que ya existen y se piden a la vez —no hay un endpoint
 * «panel del aprobador» que devuelva la unión, porque sería otra
 * definición de lo mismo—.
 *
 * ── Por qué la recomendación va arriba y en verde ────────────────────
 * El Aprobador no está eligiendo, está decidiendo sobre una elección
 * ajena. Lo primero que necesita es qué le proponen y con qué
 * argumento; el resto de cotizaciones está debajo para contrastar, no
 * para escoger. Por eso la tabla de comparación recibe
 * `cotizacionDestacada`: en esta pantalla el verde marca lo
 * recomendado, no lo más barato, y cuando no coinciden se ve
 * inmediatamente —que es la única pregunta que un aprobador se hace de
 * verdad—.
 *
 * Los botones salen de `acciones`, como en todo el módulo. Aquí importa
 * especialmente porque CERRAR_SIN_ACUERDO se admite desde bastante
 * antes de que haya nada que aprobar (§45), y esa asimetría ya está
 * resuelta en la máquina de estados del backend.
 */
export function RequerimientoDecision() {
  const { id } = useParams<{ id: string }>();
  const requerimientoId = Number(id);
  const navigate = useNavigate();

  const { data: req, isError } = useRequerimiento(requerimientoId);
  const { data: observaciones } = useObservaciones(requerimientoId);
  const { data: cotizaciones } = useCotizaciones(requerimientoId);
  const { data: evaluaciones } = useEvaluaciones(requerimientoId);
  const { data: aprobaciones } = useAprobaciones(requerimientoId);

  const hayCotizaciones = (cotizaciones?.length ?? 0) > 0;
  const { data: comparacion } = useComparacion(requerimientoId, hayCotizaciones);

  const decidir = useDecidir();
  const [decidiendo, setDecidiendo] = useState<DecisionAprobacion | null>(null);

  const historial = useMemo(
    () => construirRondas(evaluaciones ?? [], aprobaciones ?? []),
    [evaluaciones, aprobaciones],
  );

  if (isError)
    return (
      <EmptyState
        icon={ClipboardListIcon}
        title="No se pudo cargar el requerimiento"
        description="Puede que ya no exista."
        action={
          <Button onClick={() => navigate('/costos/aprobaciones')}>
            Volver a aprobaciones
          </Button>
        }
      />
    );

  if (!req) return <TableSkeleton rows={8} cols={4} />;

  const acciones = req.acciones ?? [];
  const puede = (a: AccionRequerimiento) => acciones.includes(a);
  const tarea = tareaDe('APROBADOR', req.estado);

  // La recomendación sobre la que se decide: la de ronda más alta.
  const vigente = historial.rondas.find((r) => r.vigente);
  const cotizacionRecomendada = vigente
    ? cotizaciones?.find((c) => c.id === vigente.evaluacion.cotizacionId)
    : undefined;

  /** ¿La recomendada es también la más barata? Si no, hay que explicarlo. */
  const masBarata =
    comparacion?.totalMasBajo !== null &&
    comparacion?.totalMasBajo !== undefined &&
    cotizacionRecomendada?.total === comparacion.totalMasBajo;

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2"
          onClick={() => navigate('/costos/aprobaciones')}
        >
          <ArrowLeftIcon />
          Aprobaciones
        </Button>

        <PageHeader
          title={req.numero ?? 'Requerimiento sin número'}
          description={`${req.clienteNombre} · pedido por ${orDash(req.solicitante?.nombre)}`}
          actions={<EstadoBadge estado={req.estado} />}
        />
      </div>

      {/* ── Lo que se recomienda, que es a lo que se viene ── */}
      {cotizacionRecomendada && vigente && (
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-50/60 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide text-emerald-800 uppercase dark:text-emerald-300">
                <AwardIcon className="size-4" />
                Cotización recomendada
                {historial.rondas.length > 1 && (
                  <Badge variant="secondary">Ronda {vigente.ronda}</Badge>
                )}
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {cotizacionRecomendada.proveedor.razonSocial}
              </p>
              <p className="text-sm text-muted-foreground">
                {cotizacionRecomendada.proveedor.ruc
                  ? `RUC ${cotizacionRecomendada.proveedor.ruc}`
                  : 'sin RUC'}
                {' · '}
                {cotizacionRecomendada.items.length} línea(s)
                {cotizacionRecomendada.plazoEntrega
                  ? ` · entrega ${cotizacionRecomendada.plazoEntrega}`
                  : ''}
                {cotizacionRecomendada.garantia
                  ? ` · garantía ${cotizacionRecomendada.garantia}`
                  : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {formatPrecio(cotizacionRecomendada.total)}
              </p>
              {masBarata ? (
                <Badge variant="success">
                  <TrophyIcon />
                  Es la más barata
                </Badge>
              ) : (
                <Badge variant="warning">
                  <AlertTriangleIcon />
                  No es la más barata
                </Badge>
              )}
            </div>
          </div>

          {/* §39-40: el argumento del gestor, que es lo que se juzga. */}
          <div className="mt-4 rounded-lg border border-border bg-background/70 p-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Por qué la recomienda
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
              {vigente.evaluacion.justificacion}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {vigente.evaluacion.gestor
                ? `${vigente.evaluacion.gestor.nombre} · `
                : ''}
              {formatFechaCorta(vigente.evaluacion.creadoEn)}
              {!masBarata &&
                comparacion?.totalMasBajo !== null &&
                comparacion?.totalMasBajo !== undefined &&
                ` · la más barata está en ${formatPrecio(comparacion.totalMasBajo)}`}
            </p>
          </div>
        </div>
      )}

      {/* Lo que se espera de ti, con las puertas que el backend admite. */}
      {(puede('ACEPTAR') ||
        puede('RECHAZAR') ||
        puede('CERRAR_SIN_ACUERDO')) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">
            {tarea ??
              'Todavía no te toca, pero puedes cerrarlo si no se va a llegar a acuerdo.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {puede('CERRAR_SIN_ACUERDO') && (
              <Button
                variant="outline"
                onClick={() => setDecidiendo('SIN_ACUERDO')}
              >
                <BanIcon />
                Cerrar sin acuerdo
              </Button>
            )}
            {puede('RECHAZAR') && (
              <Button
                variant="destructive"
                onClick={() => setDecidiendo('RECHAZADA')}
              >
                <XCircleIcon />
                Rechazar
              </Button>
            )}
            {puede('ACEPTAR') && (
              <Button onClick={() => setDecidiendo('ACEPTADA')}>
                <CheckCircle2Icon />
                Aceptar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── El requerimiento, entero (§40) ── */}
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-4">
            <Dato etiqueta="Cliente">{req.clienteNombre}</Dato>
            <Dato etiqueta="Supervisor">{req.supervisorNombre}</Dato>
            <Dato etiqueta="Tipo de mantenimiento">
              {req.tipoMantenimientoNombre}
            </Dato>
            <Dato etiqueta="Tipo de requerimiento">
              {req.tipoRequerimientoNombre}
            </Dato>
            <Dato etiqueta="Lugar de entrega">{req.lugarEntrega}</Dato>
            <Dato etiqueta="Fecha de entrega">
              {formatFechaCorta(req.fechaEntrega)}
            </Dato>
            <Dato etiqueta="Emitido">
              {formatFechaCorta(req.fechaEmision)}
            </Dato>
            <Dato etiqueta="Solicitante">
              {orDash(req.solicitante?.nombre)}
            </Dato>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Ítems solicitados
            </h2>
            <TablaItems items={req.items} soloLectura />
          </div>
        </CardContent>
      </Card>

      {/* Lo que se observó en su día: explica por qué tardó o cambió. */}
      <PanelObservaciones
        observaciones={observaciones ?? []}
        puedeConfirmar={false}
        ocupado={false}
        onConfirmar={() => undefined}
      />

      {/* ── Todas las cotizaciones recibidas (§40) ── */}
      {comparacion && hayCotizaciones && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Todas las cotizaciones
                </h2>
                <p className="text-sm text-muted-foreground">
                  En verde, la recomendada. El trofeo marca el total más bajo:
                  cuando no caen en la misma fila, la justificación de arriba
                  es la que tiene que explicarlo.
                </p>
              </div>
              {/* §69: para decidir con el cuadro delante, o archivarlo
                  junto a la decisión. */}
              <BotonesExportar
                ruta={`/costos/requerimiento/${String(requerimientoId)}/comparacion/exportar`}
                nombre={`comparativo-${req.numero ?? String(requerimientoId)}`}
              />
            </div>
            <TablaComparacion
              comparacion={comparacion}
              cotizacionDestacada={vigente?.evaluacion.cotizacionId ?? null}
            />
          </CardContent>
        </Card>
      )}

      {/* ── El ciclo de §44, vuelta por vuelta ── */}
      {(historial.rondas.length > 0 || historial.sueltas.length > 0) && (
        <Card>
          <CardContent className="pt-6">
            <HistorialRondas
              historial={historial}
              cotizaciones={cotizaciones ?? []}
            />
          </CardContent>
        </Card>
      )}

      {decidiendo && (
        <DialogoDecision
          decision={decidiendo}
          proveedor={cotizacionRecomendada?.proveedor.razonSocial}
          total={cotizacionRecomendada?.total}
          ocupado={decidir.isPending}
          onConfirmar={(comentario) =>
            decidir.mutate(
              {
                requerimientoId,
                payload: { decision: decidiendo, comentario },
              },
              { onSuccess: () => setDecidiendo(null) },
            )
          }
          onCerrar={() => setDecidiendo(null)}
        />
      )}
    </div>
  );
}
