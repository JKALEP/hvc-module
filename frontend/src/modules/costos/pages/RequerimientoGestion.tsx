import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ClipboardListIcon,
  MessageSquareWarningIcon,
  ScaleIcon,
  RotateCcwIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { Dato, EstadoBadge } from '@/modules/costos/components/Campo';
import { TablaItems } from '@/modules/costos/components/TablaItems';
import { BotonesExportar } from '@/modules/costos/components/BotonesExportar';
import { PanelObservaciones } from '@/modules/costos/components/PanelObservaciones';
import { DialogoObservar } from '@/modules/costos/components/DialogoObservar';
import { SelectorProveedores } from '@/modules/costos/components/SelectorProveedores';
import { PanelSolicitudes } from '@/modules/costos/components/PanelSolicitudes';
import { PanelCotizaciones } from '@/modules/costos/components/PanelCotizaciones';
import { ModalCotizacion } from '@/modules/costos/components/ModalCotizacion';
import { TablaComparacion } from '@/modules/costos/components/TablaComparacion';
import { PanelRecomendacion } from '@/modules/costos/components/PanelRecomendacion';
import { DialogoRecomendar } from '@/modules/costos/components/DialogoRecomendar';
import { useRequerimiento } from '@/modules/costos/hooks/useRequerimientos';
import {
  useObservaciones,
  useCrearObservacion,
} from '@/modules/costos/hooks/useObservaciones';
import {
  useSolicitudes,
  useCompartir,
  useCotizaciones,
  useRegistrarCotizacion,
  useEditarCotizacion,
  useDescartarCotizacion,
  useComparacion,
  useEvaluaciones,
  useEvaluar,
  useReevaluar,
  useRecomendar,
} from '@/modules/costos/hooks/useCotizaciones';
import { tareaDe } from '@/modules/costos/lib/estados';
import { formatFechaCorta, orDash } from '@/shared/lib/format';
import { Textarea } from '@/shared/ui/textarea';
import type {
  AccionRequerimiento,
  CotizacionProveedor,
} from '@/modules/costos/types';

/**
 * El puesto de trabajo del Gestor sobre UN requerimiento (§27-39).
 *
 * ── Por qué una sola pantalla y no una por paso ──────────────────────
 * Observar, pedir precio, registrar lo que llega, comparar y recomendar
 * son cinco momentos del MISMO expediente, y en casi todos hay que
 * mirar lo de al lado: se compara con los ítems pedidos delante, se
 * recomienda con la comparación delante. Partirlo en cinco rutas
 * obligaría a ir y volver con la mitad del contexto perdido.
 *
 * Lo que cambia entre momentos no es la pantalla, son los BOTONES, y
 * eso lo decide `acciones`, que calcula el backend con la misma tabla
 * que después los hace cumplir. Aquí no se deduce ningún estado: si la
 * pantalla lo dedujera por su cuenta, tarde o temprano ofrecería una
 * puerta que devuelve 400.
 *
 * El Gestor no edita el requerimiento —ni cabecera ni ítems—: eso es del
 * Solicitante, y lo que el Gestor tiene cuando algo está mal es
 * observarlo (§27). Por eso todo lo de arriba es de solo lectura.
 */
export function RequerimientoGestion() {
  const { id } = useParams<{ id: string }>();
  const requerimientoId = Number(id);
  const navigate = useNavigate();

  const { data: req, isError } = useRequerimiento(requerimientoId);
  const { data: observaciones } = useObservaciones(requerimientoId);
  const { data: solicitudes } = useSolicitudes(requerimientoId);
  const { data: cotizaciones } = useCotizaciones(requerimientoId);
  const { data: evaluaciones } = useEvaluaciones(requerimientoId);

  const hayCotizaciones = (cotizaciones?.length ?? 0) > 0;
  const { data: comparacion } = useComparacion(requerimientoId, hayCotizaciones);

  const observar = useCrearObservacion();
  const compartir = useCompartir();
  const registrar = useRegistrarCotizacion();
  const editar = useEditarCotizacion();
  const descartar = useDescartarCotizacion();
  const evaluar = useEvaluar();
  const reevaluar = useReevaluar();
  const recomendar = useRecomendar();

  const [observando, setObservando] = useState(false);
  const [eligiendoProveedores, setEligiendoProveedores] = useState(false);
  const [modalCotizacion, setModalCotizacion] = useState(false);
  const [enEdicion, setEnEdicion] = useState<CotizacionProveedor | null>(null);
  const [porDescartar, setPorDescartar] = useState<CotizacionProveedor | null>(
    null,
  );
  const [motivoDescartar, setMotivoDescartar] = useState('');
  const [recomendando, setRecomendando] = useState(false);

  if (isError)
    return (
      <EmptyState
        icon={ClipboardListIcon}
        title="No se pudo cargar el requerimiento"
        description="Puede que ya no exista."
        action={
          <Button onClick={() => navigate('/costos/bandeja')}>
            Volver a la bandeja
          </Button>
        }
      />
    );

  if (!req) return <TableSkeleton rows={8} cols={4} />;

  const acciones = req.acciones ?? [];
  const puede = (a: AccionRequerimiento) => acciones.includes(a);

  const tarea = tareaDe('GESTOR_COTIZACIONES', req.estado);
  /**
   * ¿Esto sustituye la recomendación vigente en vez de abrir una vuelta?
   *
   * Se sabe por el estado: si el requerimiento ya está en la mesa del
   * aprobador y aún así se admite RECOMENDAR, es que no se ha
   * pronunciado —en cuanto lo hace pasa a RECHAZADO o a
   * PENDIENTE_REGISTRO_COSTO—. Solo cambia el texto que se muestra:
   * quién es cada cosa lo decide el backend.
   */
  const corrigeRecomendacion = req.estado === 'PENDIENTE_APROBACION';

  const cerrarModalCotizacion = () => {
    setModalCotizacion(false);
    setEnEdicion(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2"
          onClick={() => navigate('/costos/bandeja')}
        >
          <ArrowLeftIcon />
          Bandeja de cotizaciones
        </Button>

        <PageHeader
          title={req.numero ?? 'Requerimiento sin número'}
          description={`${req.clienteNombre} · pedido por ${orDash(req.solicitante?.nombre)}`}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {/* §69: el pliego que se le pasa a un proveedor por fuera
                  del correo, cuando lo pide en otro formato. */}
              <BotonesExportar
                ruta={`/costos/requerimiento/${String(requerimientoId)}/exportar`}
                nombre={`requerimiento-${req.numero ?? String(requerimientoId)}`}
              />
              <EstadoBadge estado={req.estado} />
            </div>
          }
        />
      </div>

      {/* Lo que se espera de ti, con las puertas que el backend admite. */}
      {tarea && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/25 bg-warning-soft p-4">
          <p className="text-sm font-medium text-warning-soft-foreground">
            {tarea}
          </p>
          <div className="flex flex-wrap gap-2">
            {puede('OBSERVAR') && (
              <Button variant="outline" onClick={() => setObservando(true)}>
                <MessageSquareWarningIcon />
                Observar
              </Button>
            )}
            {puede('PASAR_A_COTIZACION') && (
              <Button onClick={() => setEligiendoProveedores(true)}>
                Dar paso a proveedores
              </Button>
            )}
            {puede('EVALUAR') && (
              <Button
                onClick={() => evaluar.mutate(requerimientoId)}
                disabled={evaluar.isPending}
              >
                {evaluar.isPending ? <Spinner /> : <ScaleIcon />}
                Empezar a evaluar
              </Button>
            )}
            {puede('REEVALUAR') && (
              <Button
                onClick={() => reevaluar.mutate(requerimientoId)}
                disabled={reevaluar.isPending}
              >
                {reevaluar.isPending ? <Spinner /> : <RotateCcwIcon />}
                Volver a evaluar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Lo que se pidió: solo lectura ── */}
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
            {/* Solo lectura: corregir un ítem es del solicitante. Lo que
                el gestor tiene cuando algo está mal es observarlo (§27). */}
            <TablaItems items={req.items} soloLectura />
          </div>
        </CardContent>
      </Card>

      <PanelObservaciones
        observaciones={observaciones ?? []}
        puedeConfirmar={false}
        ocupado={false}
        onConfirmar={() => undefined}
      />

      {/* ── Pedir precio (§30-33) ── */}
      <Card>
        <CardContent className="pt-6">
          <PanelSolicitudes
            solicitudes={solicitudes ?? []}
            puedePedir={puede('PASAR_A_COTIZACION')}
            onPedir={() => setEligiendoProveedores(true)}
          />
        </CardContent>
      </Card>

      {/* ── Lo que respondieron (§34-36) ── */}
      <Card>
        <CardContent className="pt-6">
          <PanelCotizaciones
            cotizaciones={cotizaciones ?? []}
            puedeEditar={puede('REGISTRAR_COTIZACION')}
            onRegistrar={() => {
              setEnEdicion(null);
              setModalCotizacion(true);
            }}
            onEditar={(c) => {
              setEnEdicion(c);
              setModalCotizacion(true);
            }}
            onDescartar={(c) => {
              setMotivoDescartar('');
              setPorDescartar(c);
            }}
          />
        </CardContent>
      </Card>

      {/* ── Comparar (§37) ── */}
      {comparacion && hayCotizaciones && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Comparación
                </h2>
                <p className="text-sm text-muted-foreground">
                  Todo lo que hay sobre la mesa, de un vistazo y línea a línea.
                </p>
              </div>
              {/* §69: el cuadro comparativo que acompaña a la
                  recomendación cuando sube a la mesa del aprobador. */}
              <BotonesExportar
                ruta={`/costos/requerimiento/${String(requerimientoId)}/comparacion/exportar`}
                nombre={`comparativo-${req.numero ?? String(requerimientoId)}`}
              />
            </div>
            <TablaComparacion comparacion={comparacion} />
          </CardContent>
        </Card>
      )}

      {/* ── Recomendar (§38-39) ── */}
      {(hayCotizaciones || (evaluaciones?.length ?? 0) > 0) && (
        <Card>
          <CardContent className="pt-6">
            <PanelRecomendacion
              evaluaciones={evaluaciones ?? []}
              cotizaciones={cotizaciones ?? []}
              puedeRecomendar={puede('RECOMENDAR')}
              onRecomendar={() => setRecomendando(true)}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Diálogos ── */}

      {observando && (
        <DialogoObservar
          numero={req.numero}
          ocupado={observar.isPending}
          onGuardar={(texto) =>
            observar.mutate(
              { requerimientoId, texto },
              { onSuccess: () => setObservando(false) },
            )
          }
          onCerrar={() => setObservando(false)}
        />
      )}

      {eligiendoProveedores && (
        <SelectorProveedores
          yaSolicitados={
            new Set((solicitudes ?? []).map((s) => s.proveedorId))
          }
          ocupado={compartir.isPending}
          onCompartir={(destinos) =>
            compartir.mutate(
              { requerimientoId, destinos },
              { onSuccess: () => setEligiendoProveedores(false) },
            )
          }
          onCerrar={() => setEligiendoProveedores(false)}
        />
      )}

      {modalCotizacion && (
        <ModalCotizacion
          cotizacion={enEdicion ?? undefined}
          itemsRequerimiento={req.items}
          solicitudes={solicitudes ?? []}
          ocupado={registrar.isPending || editar.isPending}
          onGuardar={(payload) => {
            if (enEdicion)
              editar.mutate(
                {
                  requerimientoId,
                  cotizacionId: enEdicion.id,
                  veniaARevisar: enEdicion.requiereRevision,
                  payload,
                },
                { onSuccess: cerrarModalCotizacion },
              );
            else
              registrar.mutate(
                { requerimientoId, payload },
                { onSuccess: cerrarModalCotizacion },
              );
          }}
          onCerrar={cerrarModalCotizacion}
        />
      )}

      {porDescartar && (
        <DialogoConfirmar
          titulo="Descartar la cotización"
          mensaje={`La de ${porDescartar.proveedor.razonSocial} deja de competir por el mejor precio.`}
          detalle="No se borra: el aprobador seguirá viendo que ese proveedor respondió y por qué se dejó fuera."
          textoConfirmar="Descartar"
          destructivo
          ocupado={descartar.isPending}
          deshabilitado={motivoDescartar.trim() === ''}
          onConfirmar={() =>
            descartar.mutate(
              {
                requerimientoId,
                cotizacionId: porDescartar.id,
                motivo: motivoDescartar,
              },
              { onSuccess: () => setPorDescartar(null) },
            )
          }
          onCerrar={() => setPorDescartar(null)}
        >
          <Textarea
            value={motivoDescartar}
            onChange={(e) => setMotivoDescartar(e.target.value)}
            rows={3}
            placeholder="Por qué se deja fuera (obligatorio). Ej.: llegó tres días después del plazo."
          />
        </DialogoConfirmar>
      )}

      {recomendando && (
        <DialogoRecomendar
          cotizaciones={cotizaciones ?? []}
          vigente={evaluaciones?.[0]}
          corrige={corrigeRecomendacion}
          ocupado={recomendar.isPending}
          onGuardar={(payload) =>
            recomendar.mutate(
              { requerimientoId, corrige: corrigeRecomendacion, payload },
              { onSuccess: () => setRecomendando(false) },
            )
          }
          onCerrar={() => setRecomendando(false)}
        />
      )}
    </div>
  );
}
