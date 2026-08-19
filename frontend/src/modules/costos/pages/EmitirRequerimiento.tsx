import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  SendIcon,
  XIcon,
  FileTextIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { Dato } from '@/modules/costos/components/Campo';
import { FormularioCabecera } from '@/modules/costos/components/FormularioCabecera';
import {
  CABECERA_VACIA,
  aPayload,
  cabeceraCompleta,
  type Cabecera,
} from '@/modules/costos/lib/cabecera';
import { TablaItems } from '@/modules/costos/components/TablaItems';
import { ModalItem } from '@/modules/costos/components/ModalItem';
import {
  useOpcionesRequerimiento,
  useRequerimiento,
  useCrearRequerimiento,
  useAgregarItem,
  useEditarItem,
  useBorrarItem,
  useEmitirRequerimiento,
  useBorrarBorrador,
} from '@/modules/costos/hooks/useRequerimientos';
import { formatFechaCorta } from '@/shared/lib/format';
import type { RequerimientoItem } from '@/modules/costos/types';

type Paso = 'FORMULARIO' | 'PLANTILLA' | 'VISTA_PREVIA';

/**
 * Emitir un requerimiento (§12-25).
 *
 * Los tres pasos del documento, en una página completa y no en una mini
 * ventana (§12):
 *
 *   1. FORMULARIO   — los cinco campos de §13.
 *   2. PLANTILLA    — la representación editable de §16, con la tabla de
 *                     ítems y el modal «+ Añadir» de §20-21.
 *   3. VISTA PREVIA — la MISMA plantilla sin poder tocar nada (§24).
 *
 * ── Por qué el borrador se guarda al pasar del paso 1 al 2 ───────────
 * Los ítems cuelgan del requerimiento, así que para poder añadirlos
 * tiene que existir. Se crea en estado BORRADOR, que por eso NO consume
 * número: §25 dice que los identificadores se generan al EMITIR, y así
 * un borrador abandonado no se lleva por delante un correlativo.
 *
 * Y por eso «Cancelar» en el paso 2 BORRA el borrador: §15 y §23 dicen
 * que cancelar no guarda el requerimiento, y dejar restos invisibles en
 * la base sería incumplirlo por dentro aunque la pantalla lo disimule.
 */
export function EmitirRequerimiento() {
  const navigate = useNavigate();

  const [paso, setPaso] = useState<Paso>('FORMULARIO');
  const [cabecera, setCabecera] = useState<Cabecera>(CABECERA_VACIA);
  const [borradorId, setBorradorId] = useState<number | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [itemEnEdicion, setItemEnEdicion] = useState<RequerimientoItem | null>(
    null,
  );
  const [porBorrar, setPorBorrar] = useState<RequerimientoItem | null>(null);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  const opciones = useOpcionesRequerimiento();
  const borrador = useRequerimiento(borradorId ?? undefined);

  const crear = useCrearRequerimiento();
  const agregar = useAgregarItem();
  const editarItem = useEditarItem();
  const borrarItem = useBorrarItem();
  const emitir = useEmitirRequerimiento();
  const descartar = useBorrarBorrador();

  const items = borrador.data?.items ?? [];

  // ── Paso 1 → 2 ──
  const continuarDesdeFormulario = () => {
    if (!cabeceraCompleta(cabecera)) return;
    crear.mutate(aPayload(cabecera), {
      onSuccess: (req) => {
        setBorradorId(req.id);
        setPaso('PLANTILLA');
      },
    });
  };

  // ── Cancelar del paso 2/3: descarta el borrador ──
  const cancelarDeVerdad = () => {
    if (borradorId === null) {
      navigate('/costos/mis-requerimientos');
      return;
    }
    descartar.mutate(borradorId, {
      onSuccess: () => navigate('/costos/mis-requerimientos'),
    });
  };

  const guardarItem = (payload: Parameters<typeof agregar.mutate>[0]['payload']) => {
    if (borradorId === null) return;
    if (itemEnEdicion)
      editarItem.mutate(
        { requerimientoId: borradorId, itemId: itemEnEdicion.id, payload },
        { onSuccess: cerrarModal },
      );
    else
      agregar.mutate(
        { requerimientoId: borradorId, payload },
        { onSuccess: cerrarModal },
      );
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setItemEnEdicion(null);
  };

  if (opciones.isError)
    return (
      <EmptyState
        icon={FileTextIcon}
        title="No se pudieron cargar los catálogos"
        description="Verifica que el backend esté corriendo y que existan clientes, supervisores y unidades dados de alta."
      />
    );

  if (!opciones.data) return <TableSkeleton rows={6} cols={2} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emitir requerimiento"
        description={
          paso === 'FORMULARIO'
            ? 'Paso 1 de 3 — datos generales.'
            : paso === 'PLANTILLA'
              ? 'Paso 2 de 3 — agrega los ítems que se necesitan.'
              : 'Paso 3 de 3 — revisa el documento antes de emitirlo.'
        }
      />

      <Pasos actual={paso} />

      {/* ── Paso 1: formulario inicial (§13) ── */}
      {paso === 'FORMULARIO' && (
        <Card>
          <CardContent className="space-y-6 pt-6">
            <FormularioCabecera
              valor={cabecera}
              opciones={opciones.data}
              onChange={setCabecera}
            />

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCabecera(CABECERA_VACIA);
                  navigate('/costos/mis-requerimientos');
                }}
              >
                <XIcon />
                Cancelar
              </Button>
              <Button
                onClick={continuarDesdeFormulario}
                disabled={!cabeceraCompleta(cabecera) || crear.isPending}
              >
                {crear.isPending ? <Spinner /> : <ArrowRightIcon />}
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pasos 2 y 3: la plantilla (§16-24) ── */}
      {paso !== 'FORMULARIO' && borrador.data && (
        <Card>
          <CardContent className="space-y-6 pt-6">
            <Plantilla
              numero={borrador.data.numero}
              fechaEmision={borrador.data.fechaEmision}
              cliente={borrador.data.clienteNombre}
              supervisor={borrador.data.supervisorNombre}
              tipoMantenimiento={borrador.data.tipoMantenimientoNombre}
              tipoRequerimiento={borrador.data.tipoRequerimientoNombre}
              lugarEntrega={borrador.data.lugarEntrega}
              fechaEntrega={borrador.data.fechaEntrega}
            />

            <TablaItems
              items={items}
              soloLectura={paso === 'VISTA_PREVIA'}
              onAnadir={() => setModalAbierto(true)}
              onEditar={(item) => {
                setItemEnEdicion(item);
                setModalAbierto(true);
              }}
              onEliminar={setPorBorrar}
            />

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              {paso === 'PLANTILLA' ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmarCancelar(true)}
                    disabled={descartar.isPending}
                  >
                    <XIcon />
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => setPaso('VISTA_PREVIA')}
                    disabled={items.length === 0}
                  >
                    <ArrowRightIcon />
                    Continuar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setPaso('PLANTILLA')}
                    disabled={emitir.isPending}
                  >
                    <ArrowLeftIcon />
                    Volver a editar
                  </Button>
                  <Button
                    onClick={() =>
                      borradorId !== null &&
                      emitir.mutate(borradorId, {
                        onSuccess: (req) =>
                          navigate(`/costos/requerimiento/${req.id}`),
                      })
                    }
                    disabled={emitir.isPending}
                  >
                    {emitir.isPending ? <Spinner /> : <SendIcon />}
                    Emitir
                  </Button>
                </>
              )}
            </div>

            {paso === 'PLANTILLA' && items.length === 0 && (
              <p className="text-right text-sm text-muted-foreground">
                Agrega al menos un ítem para poder continuar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {modalAbierto && (
        <ModalItem
          item={itemEnEdicion ?? undefined}
          unidades={opciones.data.unidades}
          ocupado={agregar.isPending || editarItem.isPending}
          onGuardar={guardarItem}
          onCerrar={cerrarModal}
        />
      )}

      {porBorrar && (
        <DialogoConfirmar
          titulo="Quitar el ítem"
          mensaje={`Se quitará "${porBorrar.descripcion}" del requerimiento.`}
          textoConfirmar="Quitar"
          destructivo
          ocupado={borrarItem.isPending}
          onConfirmar={() =>
            borradorId !== null &&
            borrarItem.mutate(
              { requerimientoId: borradorId, itemId: porBorrar.id },
              { onSuccess: () => setPorBorrar(null) },
            )
          }
          onCerrar={() => setPorBorrar(null)}
        />
      )}

      {confirmarCancelar && (
        <DialogoConfirmar
          titulo="Cancelar el requerimiento"
          mensaje="Se descartará todo lo que llevas escrito."
          detalle="El borrador se elimina y no queda registro: todavía no se ha emitido ni tiene número."
          textoConfirmar="Sí, descartar"
          destructivo
          ocupado={descartar.isPending}
          onConfirmar={cancelarDeVerdad}
          onCerrar={() => setConfirmarCancelar(false)}
        />
      )}
    </div>
  );
}

/** Los tres pasos, para que se vea dónde se está y qué falta. */
function Pasos({ actual }: { actual: Paso }) {
  const pasos: { id: Paso; nombre: string }[] = [
    { id: 'FORMULARIO', nombre: 'Datos generales' },
    { id: 'PLANTILLA', nombre: 'Ítems' },
    { id: 'VISTA_PREVIA', nombre: 'Vista previa' },
  ];
  const indice = pasos.findIndex((p) => p.id === actual);

  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {pasos.map((p, i) => (
        <li key={p.id} className="flex items-center gap-2">
          <span
            className={
              i <= indice
                ? 'flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground'
                : 'flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground'
            }
          >
            {i + 1}
          </span>
          <span
            className={
              i === indice
                ? 'font-medium text-foreground'
                : 'text-muted-foreground'
            }
          >
            {p.nombre}
          </span>
          {i < pasos.length - 1 && (
            <span className="mx-1 text-muted-foreground">›</span>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * La cabecera del documento (§16-18).
 *
 * El número sale como «se asignará al emitir» mientras es borrador,
 * porque eso es exactamente lo que pasa (§25) y poner un hueco vacío
 * haría pensar que falta llenarlo.
 */
function Plantilla({
  numero,
  fechaEmision,
  cliente,
  supervisor,
  tipoMantenimiento,
  tipoRequerimiento,
  lugarEntrega,
  fechaEntrega,
}: {
  numero: string | null;
  fechaEmision: string;
  cliente: string;
  supervisor: string;
  tipoMantenimiento: string;
  tipoRequerimiento: string;
  lugarEntrega: string;
  fechaEntrega: string;
}) {
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-4">
      <Dato etiqueta="N.º de pedido">
        {numero ?? (
          <span className="text-muted-foreground italic">
            se asignará al emitir
          </span>
        )}
      </Dato>
      <Dato etiqueta="Fecha de emisión">{formatFechaCorta(fechaEmision)}</Dato>
      <Dato etiqueta="Cliente">{cliente}</Dato>
      <Dato etiqueta="Supervisor">{supervisor}</Dato>
      <Dato etiqueta="Tipo de mantenimiento">{tipoMantenimiento}</Dato>
      <Dato etiqueta="Tipo de requerimiento">{tipoRequerimiento}</Dato>
      <Dato etiqueta="Lugar de entrega">{lugarEntrega}</Dato>
      <Dato etiqueta="Fecha de entrega">{formatFechaCorta(fechaEntrega)}</Dato>
    </div>
  );
}
