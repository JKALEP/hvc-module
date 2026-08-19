import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ClipboardListIcon,
  SaveIcon,
  SendIcon,
  WalletIcon,
  XCircleIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { Dato, EstadoBadge, CLASES_TEXTAREA } from '@/modules/costos/components/Campo';
import { FormularioCabecera } from '@/modules/costos/components/FormularioCabecera';
import {
  aPayload,
  aPayloadLogistico,
  cabeceraCompleta,
  cabeceraDe,
  type Cabecera,
} from '@/modules/costos/lib/cabecera';
import { TablaItems } from '@/modules/costos/components/TablaItems';
import { BotonesExportar } from '@/modules/costos/components/BotonesExportar';
import { ModalItem } from '@/modules/costos/components/ModalItem';
import { PanelObservaciones } from '@/modules/costos/components/PanelObservaciones';
import { ModalRegistrarCosto } from '@/modules/costos/components/ModalRegistrarCosto';
import {
  useOpcionesRequerimiento,
  useRequerimiento,
  useEditarRequerimiento,
  useEmitirRequerimiento,
  useCancelarRequerimiento,
  useAgregarItem,
  useEditarItem,
  useBorrarItem,
} from '@/modules/costos/hooks/useRequerimientos';
import {
  useObservaciones,
  useConfirmarObservacion,
} from '@/modules/costos/hooks/useObservaciones';
import {
  usePlantillaCosto,
  useCosto,
  useRegistrarCosto,
  useCorregirCosto,
} from '@/modules/costos/hooks/useCostoRequerimiento';
import { presentacionDe } from '@/modules/costos/lib/estados';
import { formatFechaCorta, formatPrecio, orDash } from '@/shared/lib/format';
import type { RequerimientoItem } from '@/modules/costos/types';

/**
 * El detalle de un requerimiento, desde el lado del solicitante.
 *
 * Reúne lo que §26-29 y §46-51 le piden ver y hacer: en qué punto está,
 * qué le observaron, qué puede corregir y —cuando le toca— registrar el
 * costo.
 *
 * Qué botones se pintan sale de `acciones`, que calcula el BACKEND con
 * la misma tabla que después los hace cumplir. Aquí no se decide nada
 * sobre estados: si la pantalla lo dedujera por su cuenta, tarde o
 * temprano ofrecería una puerta que devuelve 400.
 */
export function RequerimientoDetalle() {
  const { id } = useParams<{ id: string }>();
  const requerimientoId = Number(id);
  const navigate = useNavigate();

  const opciones = useOpcionesRequerimiento();
  const { data: req, isError } = useRequerimiento(requerimientoId);
  const { data: observaciones } = useObservaciones(requerimientoId);

  /**
   * Lo que el usuario lleva escrito, o null si no ha tocado nada.
   *
   * La cabecera efectiva se DERIVA: `editado ?? cabeceraDe(req)`. Antes
   * esto era un `useEffect` que sembraba el estado, y eso tiene dos
   * problemas —un render en cascada, y una copia que se queda atrás
   * cuando el servidor devuelve otra cosa—. Al guardar se vuelve a null
   * y el formulario refleja lo que quedó grabado.
   */
  const [editado, setEditado] = useState<Cabecera | null>(null);
  const [modalItem, setModalItem] = useState(false);
  const [itemEnEdicion, setItemEnEdicion] = useState<RequerimientoItem | null>(
    null,
  );
  const [porBorrar, setPorBorrar] = useState<RequerimientoItem | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivoCancelar, setMotivoCancelar] = useState('');
  const [modalCosto, setModalCosto] = useState(false);

  const editar = useEditarRequerimiento();
  const emitir = useEmitirRequerimiento();
  const cancelar = useCancelarRequerimiento();
  const agregar = useAgregarItem();
  const editarItem = useEditarItem();
  const borrarItem = useBorrarItem();
  const confirmar = useConfirmarObservacion();
  const registrar = useRegistrarCosto();
  const corregir = useCorregirCosto();

  const estado = req?.estado;
  const acciones = req?.acciones ?? [];
  const cerrado =
    estado === 'FINALIZADO' ||
    estado === 'CANCELADO' ||
    estado === 'SIN_ACUERDO';
  const borrador = estado === 'BORRADOR' || estado === 'OBSERVADO';

  // El costo existe desde que se registra; la plantilla, desde que toca.
  const plantilla = usePlantillaCosto(
    requerimientoId,
    estado === 'PENDIENTE_REGISTRO_COSTO' || estado === 'FINALIZADO',
  );
  const costo = useCosto(requerimientoId, estado === 'FINALIZADO');

  const cabecera = editado ?? (req ? cabeceraDe(req) : null);

  const observacionesPendientes = (observaciones ?? []).filter(
    (o) => o.estado === 'PENDIENTE',
  ).length;

  /** ¿Algún proveedor ya puso precio a algo? Dispara el aviso de §54. */
  const hayCotizaciones = (req?._count.cotizaciones ?? 0) > 0;

  if (isError)
    return (
      <EmptyState
        icon={ClipboardListIcon}
        title="No se pudo cargar el requerimiento"
        description="Puede que ya no exista, o que sea de otra persona."
        action={
          <Button onClick={() => navigate('/costos/mis-requerimientos')}>
            Volver a mis requerimientos
          </Button>
        }
      />
    );

  if (!req || !opciones.data || !cabecera)
    return <TableSkeleton rows={6} cols={4} />;

  const guardarCabecera = () => {
    if (!cabeceraCompleta(cabecera)) return;
    // Ya emitido, solo viajan los campos logísticos: mandar el resto
    // sería pedirle al backend que rechace algo que no queremos cambiar.
    const payload = borrador
      ? aPayload(cabecera)
      : aPayloadLogistico(cabecera);
    editar.mutate(
      { id: requerimientoId, payload },
      // Se suelta lo escrito para que el formulario vuelva a derivarse
      // de lo que quedó grabado.
      { onSuccess: () => setEditado(null) },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2"
          onClick={() => navigate('/costos/mis-requerimientos')}
        >
          <ArrowLeftIcon />
          Mis requerimientos
        </Button>

        <PageHeader
          title={req.numero ?? 'Requerimiento en borrador'}
          description={presentacionDe(req.estado).significa}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {/* §69. Un borrador todavía no es un documento que enseñar:
                  no tiene número y sus ítems pueden cambiar en el
                  siguiente clic. */}
              {req.numero && (
                <BotonesExportar
                  ruta={`/costos/requerimiento/${String(requerimientoId)}/exportar`}
                  nombre={`requerimiento-${req.numero}`}
                />
              )}
              <EstadoBadge estado={req.estado} />
            </div>
          }
        />
      </div>

      {/* §46: la tarea pendiente, donde no se pueda pasar por alto. */}
      {estado === 'PENDIENTE_REGISTRO_COSTO' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-600/25 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Requerimiento aprobado — falta registrar el costo
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Anota cuánto costó cada ítem para cerrar el proceso.
            </p>
          </div>
          <Button
            onClick={() => setModalCosto(true)}
            disabled={!plantilla.data}
          >
            <WalletIcon />
            Registrar costo
          </Button>
        </div>
      )}

      <PanelObservaciones
        observaciones={observaciones ?? []}
        puedeConfirmar={estado === 'OBSERVADO'}
        ocupado={confirmar.isPending}
        onConfirmar={(observacionId, respuesta) =>
          confirmar.mutate({ observacionId, requerimientoId, respuesta })
        }
      />

      {/* ── Cabecera ── */}
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-4">
            <Dato etiqueta="N.º de pedido">
              {req.numero ?? (
                <span className="text-muted-foreground italic">
                  se asigna al emitir
                </span>
              )}
            </Dato>
            <Dato etiqueta="Fecha de emisión">
              {formatFechaCorta(req.fechaEmision)}
            </Dato>
            <Dato etiqueta="Solicitante">
              {orDash(req.solicitante?.nombre)}
            </Dato>
            <Dato etiqueta="Cotizaciones recibidas">
              {req._count.cotizaciones}
            </Dato>
          </div>

          {cerrado ? (
            <div className="grid gap-4 sm:grid-cols-4">
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
            </div>
          ) : (
            <>
              <FormularioCabecera
                valor={cabecera}
                opciones={opciones.data}
                soloLogistica={!borrador}
                onChange={setEditado}
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={guardarCabecera}
                  disabled={editar.isPending}
                >
                  {editar.isPending ? <Spinner /> : <SaveIcon />}
                  Guardar cambios
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Ítems ── */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-sm font-semibold text-foreground">
            Ítems solicitados
          </h2>
          <TablaItems
            items={req.items}
            soloLectura={cerrado}
            onAnadir={() => setModalItem(true)}
            onEditar={(item) => {
              setItemEnEdicion(item);
              setModalItem(true);
            }}
            onEliminar={setPorBorrar}
          />
        </CardContent>
      </Card>

      {/* ── El costo, cuando ya está ── */}
      {costo.data && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                Costo registrado
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  Total: {formatPrecio(costo.data.total)}
                </span>
                <BotonesExportar
                  ruta={`/costos/requerimiento/${String(requerimientoId)}/costo/exportar`}
                  nombre={`costo-${req.numero ?? String(requerimientoId)}`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalCosto(true)}
                  disabled={!plantilla.data}
                >
                  Corregir
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Dato etiqueta="Proveedor">
                {costo.data.proveedorRazonSocial}
              </Dato>
              <Dato etiqueta="RUC">{orDash(costo.data.proveedorRuc)}</Dato>
              <Dato etiqueta="Registrado por">
                {orDash(costo.data.registradoPor?.nombre)}
              </Dato>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {costo.data.items.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="text-foreground">{i.descripcion}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {i.cantidad} {i.unidad} × {formatPrecio(i.costoUnitario)} ={' '}
                    <span className="font-medium text-foreground">
                      {formatPrecio(i.costoTotal)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Acciones del proceso ── */}
      {(acciones.includes('EMITIR') || acciones.includes('CANCELAR')) && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          {acciones.includes('CANCELAR') && (
            <Button variant="outline" onClick={() => setCancelando(true)}>
              <XCircleIcon />
              Cancelar requerimiento
            </Button>
          )}
          {acciones.includes('EMITIR') && (
            <Button
              onClick={() => emitir.mutate(requerimientoId)}
              disabled={
                emitir.isPending ||
                req.items.length === 0 ||
                observacionesPendientes > 0
              }
              title={
                observacionesPendientes > 0
                  ? 'Confirma las observaciones antes de devolverlo'
                  : undefined
              }
            >
              {emitir.isPending ? <Spinner /> : <SendIcon />}
              {estado === 'OBSERVADO' ? 'Devolver corregido' : 'Emitir'}
            </Button>
          )}
        </div>
      )}

      {modalItem && (
        <ModalItem
          item={itemEnEdicion ?? undefined}
          unidades={opciones.data.unidades}
          yaCotizado={hayCotizaciones}
          ocupado={agregar.isPending || editarItem.isPending}
          onGuardar={(payload) => {
            const cerrar = () => {
              setModalItem(false);
              setItemEnEdicion(null);
            };
            if (itemEnEdicion)
              editarItem.mutate(
                {
                  requerimientoId,
                  itemId: itemEnEdicion.id,
                  payload,
                },
                { onSuccess: cerrar },
              );
            else
              agregar.mutate(
                { requerimientoId, payload },
                { onSuccess: cerrar },
              );
          }}
          onCerrar={() => {
            setModalItem(false);
            setItemEnEdicion(null);
          }}
        />
      )}

      {porBorrar && (
        <DialogoConfirmar
          titulo="Quitar el ítem"
          mensaje={`Se quitará "${porBorrar.descripcion}" del requerimiento.`}
          detalle={
            hayCotizaciones
              ? 'Si algún proveedor ya lo había cotizado, sus líneas se conservan en la cotización pero quedan sin ítem.'
              : undefined
          }
          textoConfirmar="Quitar"
          destructivo
          ocupado={borrarItem.isPending}
          onConfirmar={() =>
            borrarItem.mutate(
              { requerimientoId, itemId: porBorrar.id },
              { onSuccess: () => setPorBorrar(null) },
            )
          }
          onCerrar={() => setPorBorrar(null)}
        />
      )}

      {cancelando && (
        <DialogoConfirmar
          titulo="Cancelar el requerimiento"
          mensaje="Queda cerrado y no se puede reabrir. El motivo se guarda en la bitácora."
          textoConfirmar="Cancelar requerimiento"
          destructivo
          ocupado={cancelar.isPending}
          deshabilitado={motivoCancelar.trim() === ''}
          onConfirmar={() =>
            cancelar.mutate(
              { id: requerimientoId, motivo: motivoCancelar },
              {
                onSuccess: () => {
                  setCancelando(false);
                  setMotivoCancelar('');
                },
              },
            )
          }
          onCerrar={() => setCancelando(false)}
        >
          <textarea
            value={motivoCancelar}
            onChange={(e) => setMotivoCancelar(e.target.value)}
            rows={3}
            placeholder="Por qué se cancela (obligatorio)."
            className={CLASES_TEXTAREA}
          />
        </DialogoConfirmar>
      )}

      {modalCosto && plantilla.data && (
        <ModalRegistrarCosto
          plantilla={plantilla.data}
          costoExistente={costo.data}
          ocupado={registrar.isPending || corregir.isPending}
          onGuardar={(payload) => {
            const mutacion = costo.data ? corregir : registrar;
            mutacion.mutate(
              { requerimientoId, payload },
              { onSuccess: () => setModalCosto(false) },
            );
          }}
          onCerrar={() => setModalCosto(false)}
        />
      )}
    </div>
  );
}
