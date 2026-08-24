import { useMemo, useState } from 'react';
import { SaveIcon, PlusIcon, Trash2Icon, SearchIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/shared/ui/table';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Badge } from '@/shared/ui/badge';
import { Spinner } from '@/shared/ui/spinner';
import { Campo } from './Campo';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useProveedores } from '@/modules/costos/hooks/useProveedores';
import { formatPrecio, aValorInputFecha, hoyISO } from '@/shared/lib/format';
import { Textarea } from '@/shared/ui/textarea';
import type {
  CotizacionProveedor,
  GuardarCotizacionPayload,
  RequerimientoItem,
  SolicitudCotizacion,
} from '@/modules/costos/types';

/**
 * Una línea mientras se teclea: todo texto, porque un campo a medio
 * escribir («12.») no es un número y convertirlo antes de tiempo borra
 * lo que el usuario iba a poner.
 */
interface LineaBorrador {
  /** Clave estable de React. No es el id de la base. */
  clave: string;
  /** A qué ítem pedido responde. Null = línea extra de §36. */
  requerimientoItemId: number | null;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precioUnitario: string;
}

let contador = 0;
const nuevaClave = () => `l${String(++contador)}`;

/**
 * Registrar (o corregir) la cotización de un proveedor (§34-36).
 *
 * §36 es tajante: los proveedores mandan formatos distintos y hoy NO se
 * interpretan automáticamente. El Gestor teclea lo que hace falta para
 * comparar, y eso —no el PDF que llegó— es la fuente. Por eso no hay
 * adjunto ni nada que parezca una importación.
 *
 * ── Las líneas nacen del requerimiento ───────────────────────────────
 * Al crear, la tabla ya viene con un renglón por ítem pedido, con su
 * descripción, unidad y cantidad copiadas y el precio en blanco. No es
 * un adorno: es lo que ata cada precio a su `requerimientoItemId`, y sin
 * esa atadura la comparación por ítem de §37 no existe —el backend
 * puede sumar totales, pero no puede decir quién fue más barato en la
 * línea que importa—.
 *
 * Lo que el proveedor no cotizó se quita con la papelera; lo que añadió
 * por su cuenta —flete, instalación— se agrega con «+ Línea» y va sin
 * ítem, que es exactamente lo que §36 admite.
 *
 * El total NO se teclea: es la suma de los subtotales y se calcula aquí
 * igual que en el backend. Un total escrito a mano es un número que
 * miente en cuanto se corrige una línea.
 */
export function ModalCotizacion({
  cotizacion,
  itemsRequerimiento,
  solicitudes,
  ocupado,
  onGuardar,
  onCerrar,
}: {
  /** Sin cotización, es un alta. */
  cotizacion?: CotizacionProveedor;
  itemsRequerimiento: RequerimientoItem[];
  /** Para enlazar el envío del que viene y para proponer proveedores. */
  solicitudes: SolicitudCotizacion[];
  ocupado: boolean;
  onGuardar: (payload: GuardarCotizacionPayload) => void;
  onCerrar: () => void;
}) {
  const editando = cotizacion !== undefined;

  const [proveedorId, setProveedorId] = useState<number | null>(
    cotizacion?.proveedorId ?? solicitudes[0]?.proveedorId ?? null,
  );
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda, 300);
  const { data: encontrados } = useProveedores(q);

  const [fechaCotizacion, setFechaCotizacion] = useState(
    cotizacion ? aValorInputFecha(cotizacion.fechaCotizacion) : hoyISO(),
  );
  const [validaHasta, setValidaHasta] = useState(
    cotizacion?.validaHasta ? aValorInputFecha(cotizacion.validaHasta) : '',
  );
  const [garantia, setGarantia] = useState(cotizacion?.garantia ?? '');
  const [plazoEntrega, setPlazoEntrega] = useState(
    cotizacion?.plazoEntrega ?? '',
  );
  const [condicionesPago, setCondicionesPago] = useState(
    cotizacion?.condicionesPago ?? '',
  );
  const [observaciones, setObservaciones] = useState(
    cotizacion?.observaciones ?? '',
  );

  const [lineas, setLineas] = useState<LineaBorrador[]>(() =>
    cotizacion
      ? cotizacion.items.map((i) => ({
          clave: nuevaClave(),
          requerimientoItemId: i.requerimientoItemId,
          descripcion: i.descripcion,
          unidad: i.unidad ?? '',
          cantidad: String(i.cantidad),
          precioUnitario: String(i.precioUnitario),
        }))
      : itemsRequerimiento.map((i) => ({
          clave: nuevaClave(),
          requerimientoItemId: i.id,
          descripcion: i.descripcion,
          unidad: i.unidad,
          cantidad: String(i.cantidad),
          precioUnitario: '',
        })),
  );

  /**
   * Los proveedores que se ofrecen al crear.
   *
   * Primero los que ya recibieron la solicitud, que es de donde vendrá
   * casi siempre la respuesta; el buscador amplía a todos porque §35
   * admite que cotice alguien a quien no se le pidió formalmente.
   */
  const opcionesProveedor = useMemo(() => {
    const porSolicitud = solicitudes.map((s) => ({
      id: s.proveedor.id,
      etiqueta: `${s.proveedor.razonSocial} — ya se le pidió`,
    }));
    const restantes = (encontrados ?? [])
      .filter((p) => !porSolicitud.some((o) => o.id === p.id))
      .map((p) => ({
        id: p.id,
        etiqueta: p.ruc ? `${p.razonSocial} (RUC ${p.ruc})` : p.razonSocial,
      }));
    // Sin repetidos: un proveedor puede tener dos solicitudes (§44).
    const vistos = new Set<number>();
    return [...porSolicitud, ...restantes].filter((o) => {
      if (vistos.has(o.id)) return false;
      vistos.add(o.id);
      return true;
    });
  }, [solicitudes, encontrados]);

  const cambiar = (clave: string, campo: keyof LineaBorrador, valor: string) =>
    setLineas((antes) =>
      antes.map((l) => (l.clave === clave ? { ...l, [campo]: valor } : l)),
    );

  const calculadas = useMemo(
    () =>
      lineas.map((l) => {
        const cantidad = Number(l.cantidad);
        const precio = Number(l.precioUnitario);
        const validaCantidad =
          l.cantidad.trim() !== '' && Number.isFinite(cantidad) && cantidad >= 0;
        const validaPrecio =
          l.precioUnitario.trim() !== '' &&
          Number.isFinite(precio) &&
          precio >= 0;
        const valida =
          l.descripcion.trim() !== '' && validaCantidad && validaPrecio;
        return {
          linea: l,
          cantidad,
          precio,
          validaCantidad,
          validaPrecio,
          valida,
          subtotal: valida ? Math.round(cantidad * precio * 100) / 100 : null,
        };
      }),
    [lineas],
  );

  const total = calculadas.reduce((a, c) => a + (c.subtotal ?? 0), 0);
  const lineasCompletas = calculadas.length > 0 && calculadas.every((c) => c.valida);
  const puedeGuardar =
    lineasCompletas && fechaCotizacion !== '' && (editando || proveedorId !== null);

  /** Cuántos ítems pedidos quedan sin precio. Es lo que §37 llama cobertura. */
  const sinCubrir = itemsRequerimiento.filter(
    (i) => !lineas.some((l) => l.requerimientoItemId === i.id),
  ).length;

  const guardar = () => {
    if (!puedeGuardar) return;
    const items = calculadas.map((c) => ({
      requerimientoItemId: c.linea.requerimientoItemId,
      descripcion: c.linea.descripcion.trim(),
      unidad: c.linea.unidad.trim() || null,
      cantidad: c.cantidad,
      precioUnitario: c.precio,
    }));

    const cabecera = {
      fechaCotizacion,
      validaHasta: validaHasta || null,
      garantia: garantia.trim() || null,
      plazoEntrega: plazoEntrega.trim() || null,
      condicionesPago: condicionesPago.trim() || null,
      observaciones: observaciones.trim() || null,
      items,
    };

    if (editando) {
      onGuardar(cabecera);
      return;
    }

    // De qué envío viene, si viene de alguno. La más reciente de ese
    // proveedor: §44 admite haberle pedido dos veces, y lo que se está
    // registrando responde a la última.
    const suya = solicitudes.find((s) => s.proveedorId === proveedorId);
    onGuardar({
      ...cabecera,
      proveedorId: proveedorId as number,
      solicitudId: suya?.id ?? null,
    });
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editando ? 'Corregir la cotización' : 'Registrar cotización'}
          </DialogTitle>
          <DialogDescription>
            {editando
              ? `De ${cotizacion.proveedor.razonSocial}. El proveedor no se cambia: eso sería otra cotización.`
              : 'Teclea lo que hace falta para comparar. Los documentos que manda el proveedor no se interpretan solos.'}
          </DialogDescription>
        </DialogHeader>

        {/* §54: se está arreglando una que quedó desfasada. */}
        {cotizacion?.requiereRevision && (
          <div className="rounded-lg border border-warning/25 bg-warning-soft p-3 text-sm">
            <p className="font-medium text-warning-soft-foreground">
              Esta cotización quedó pendiente de revisar
            </p>
            <p className="text-warning-soft-foreground">
              {cotizacion.revisionMotivo ??
                'Un ítem del requerimiento cambió después de recibirla.'}{' '}
              Al guardar vuelve a contar para la comparación, así que
              actualízala con lo que el proveedor haya respondido ahora.
            </p>
          </div>
        )}

        {/* ── Cabecera (§37) ── */}
        <div className="grid gap-4 sm:grid-cols-3">
          {!editando && (
            <div className="space-y-1.5 sm:col-span-3">
              <Campo label="Proveedor" requerido>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre, RUC o correo…"
                      className="pl-8"
                    />
                  </div>
                  <Select
                    value={proveedorId === null ? '' : String(proveedorId)}
                    onChange={(e) =>
                      setProveedorId(e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">Elige un proveedor…</option>
                    {opcionesProveedor.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </Select>
                </div>
              </Campo>
              <p className="text-xs text-muted-foreground">
                Puede cotizar alguien a quien no se le pidió formalmente:
                búscalo y aparecerá en la lista.
              </p>
            </div>
          )}

          <Campo
            label="Fecha de la cotización"
            requerido
            ayuda="La del documento del proveedor, no la de hoy."
          >
            <Input
              type="date"
              value={fechaCotizacion}
              onChange={(e) => setFechaCotizacion(e.target.value)}
            />
          </Campo>

          <Campo label="Válida hasta">
            <Input
              type="date"
              value={validaHasta}
              onChange={(e) => setValidaHasta(e.target.value)}
            />
          </Campo>

          <Campo label="Plazo de entrega">
            <Input
              value={plazoEntrega}
              onChange={(e) => setPlazoEntrega(e.target.value)}
              placeholder="Ej.: 5 días hábiles"
            />
          </Campo>

          <Campo label="Garantía">
            <Input
              value={garantia}
              onChange={(e) => setGarantia(e.target.value)}
              placeholder="Ej.: 12 meses"
            />
          </Campo>

          <Campo label="Condiciones de pago">
            <Input
              value={condicionesPago}
              onChange={(e) => setCondicionesPago(e.target.value)}
              placeholder="Ej.: 50 % adelanto, 50 % contra entrega"
            />
          </Campo>
        </div>

        {/* ── Las líneas (§35-36) ── */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Lo que cotizó
            </h3>
            <div className="flex items-center gap-2">
              {sinCubrir > 0 && (
                <Badge variant="warning">
                  {sinCubrir} ítem(s) sin cotizar
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLineas((antes) => [
                    ...antes,
                    {
                      clave: nuevaClave(),
                      requerimientoItemId: null,
                      descripcion: '',
                      unidad: '',
                      cantidad: '',
                      precioUnitario: '',
                    },
                  ])
                }
              >
                <PlusIcon />
                Línea
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="min-w-56">Descripción</TableHead>
                  <TableHead className="w-24">Unidad</TableHead>
                  <TableHead className="w-28">Cantidad</TableHead>
                  <TableHead className="w-32">Precio S/ unit.</TableHead>
                  <TableHead className="w-28 text-right">Subtotal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculadas.map((c) => (
                  <TableRow key={c.linea.clave} className="align-top">
                    <TableCell>
                      <Input
                        value={c.linea.descripcion}
                        onChange={(e) =>
                          cambiar(c.linea.clave, 'descripcion', e.target.value)
                        }
                        aria-invalid={c.linea.descripcion.trim() === ''}
                      />
                      {c.linea.requerimientoItemId === null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Línea extra: no responde a ningún ítem pedido.
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={c.linea.unidad}
                        onChange={(e) =>
                          cambiar(c.linea.clave, 'unidad', e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={c.linea.cantidad}
                        onChange={(e) =>
                          cambiar(c.linea.clave, 'cantidad', e.target.value)
                        }
                        inputMode="decimal"
                        placeholder="0"
                        aria-invalid={
                          c.linea.cantidad !== '' && !c.validaCantidad
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={c.linea.precioUnitario}
                        onChange={(e) =>
                          cambiar(
                            c.linea.clave,
                            'precioUnitario',
                            e.target.value,
                          )
                        }
                        inputMode="decimal"
                        placeholder="0.00"
                        aria-invalid={
                          c.linea.precioUnitario !== '' && !c.validaPrecio
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {c.subtotal === null ? '—' : formatPrecio(c.subtotal)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Quitar la línea"
                        title="Quitar la línea"
                        onClick={() =>
                          setLineas((antes) =>
                            antes.filter((l) => l.clave !== c.linea.clave),
                          )
                        }
                      >
                        <Trash2Icon className="text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {lineas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              La cotización necesita al menos una línea. Añade una con «+
              Línea».
            </p>
          )}
        </div>

        <Campo label="Observaciones">
          <Textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Lo que el proveedor aclaró y no cabe en las columnas."
          />
        </Campo>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">
            {lineasCompletas
              ? 'Listo para guardar.'
              : 'Cada línea necesita descripción, cantidad y precio.'}
          </p>
          <p className="text-sm font-semibold text-foreground">
            Total: {formatPrecio(total)}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!puedeGuardar || ocupado}>
            {ocupado ? <Spinner /> : <SaveIcon />}
            {editando ? 'Guardar cambios' : 'Registrar cotización'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
