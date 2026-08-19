import { useMemo, useState } from 'react';
import { SaveIcon, BuildingIcon } from 'lucide-react';

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
import { Spinner } from '@/shared/ui/spinner';
import { Dato } from './Campo';
import { formatPrecio, orDash } from '@/shared/lib/format';
import type {
  Costo,
  PlantillaCosto,
  RegistrarCostoPayload,
} from '@/modules/costos/types';

/**
 * Registrar el costo (§47-51).
 *
 * §47 pide una ventana superpuesta, y §48-49 que los datos del proveedor
 * y las cinco columnas del ítem vengan ya cargados: todo eso llega del
 * endpoint `/costo/plantilla`, que además resuelve cuál es la cotización
 * aprobada — una regla del backend que la pantalla no debe deducir.
 *
 * Lo ÚNICO editable es la columna de costo. Va por UNIDAD, no el total
 * de la línea: es lo que hace comparable «¿cuánto costó la cinta?» entre
 * un requerimiento de 4 unidades y otro de 40. El total se calcula al
 * lado, en vivo, para que nadie tenga que multiplicar de cabeza.
 *
 * `precioCotizado` se muestra como referencia pero NO se precarga en el
 * campo: precargarlo convertiría un registro en una confirmación
 * automática, y §50 dice que el solicitante lo registra.
 */
export function ModalRegistrarCosto({
  plantilla,
  costoExistente,
  ocupado,
  onGuardar,
  onCerrar,
}: {
  plantilla: PlantillaCosto;
  /** Al corregir, los importes ya registrados. */
  costoExistente?: Costo;
  ocupado: boolean;
  onGuardar: (payload: RegistrarCostoPayload) => void;
  onCerrar: () => void;
}) {
  const [costos, setCostos] = useState<Record<number, string>>(() => {
    const inicial: Record<number, string> = {};
    for (const i of costoExistente?.items ?? [])
      if (i.id) inicial[i.id] = '';
    // Al corregir se parte de lo ya registrado, emparejando por ítem.
    for (const item of plantilla.items) {
      const previo = costoExistente?.items.find(
        (c) => c.descripcion === item.descripcion && c.unidad === item.unidad,
      );
      inicial[item.requerimientoItemId] = previo
        ? String(previo.costoUnitario)
        : '';
    }
    return inicial;
  });

  const valorDe = (id: number) => costos[id] ?? '';

  const lineas = useMemo(
    () =>
      plantilla.items.map((item) => {
        const crudo = costos[item.requerimientoItemId] ?? '';
        const n = Number(crudo);
        const valido = crudo.trim() !== '' && Number.isFinite(n) && n >= 0;
        return {
          item,
          crudo,
          valido,
          total: valido ? Math.round(n * item.cantidad * 100) / 100 : null,
        };
      }),
    [plantilla.items, costos],
  );

  // §49 muestra la plantilla entera, así que se exige el costo de CADA
  // ítem. Lo que no se compró se registra en 0, y así el histórico no
  // queda con huecos que nadie sabe interpretar.
  const completo = lineas.every((l) => l.valido);
  const total = lineas.reduce((a, l) => a + (l.total ?? 0), 0);

  const guardar = () => {
    if (!completo) return;
    onGuardar({
      items: plantilla.items.map((item) => ({
        requerimientoItemId: item.requerimientoItemId,
        costoUnitario: Number(valorDe(item.requerimientoItemId)),
      })),
    });
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {costoExistente ? 'Corregir el costo' : 'Registrar costo'}
          </DialogTitle>
          <DialogDescription>
            Requerimiento {plantilla.requerimiento.numero} ·{' '}
            {plantilla.requerimiento.cliente}
          </DialogDescription>
        </DialogHeader>

        {/* §48: los datos del proveedor, de su ficha. */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <BuildingIcon className="size-4 text-muted-foreground" />
            Proveedor de la cotización aprobada
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Dato etiqueta="Razón social">
              {plantilla.proveedor.razonSocial}
            </Dato>
            <Dato etiqueta="RUC">{orDash(plantilla.proveedor.ruc)}</Dato>
            <Dato etiqueta="Teléfono">
              {orDash(plantilla.proveedor.telefono)}
            </Dato>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10">#</TableHead>
                <TableHead className="min-w-48">Descripción</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="min-w-32">Detalle</TableHead>
                <TableHead className="min-w-28">Referencias</TableHead>
                <TableHead className="min-w-32">Costo S/ unitario</TableHead>
                <TableHead className="text-right">Total S/</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.map(({ item, crudo, valido, total: subtotal }, n) => (
                <TableRow key={item.requerimientoItemId} className="align-top">
                  <TableCell className="text-muted-foreground tabular-nums">
                    {n + 1}
                  </TableCell>
                  <TableCell className="whitespace-normal font-medium text-foreground">
                    {item.descripcion}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.unidad}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.cantidad}
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm text-muted-foreground">
                    {orDash(item.detalleObservacion)}
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm text-muted-foreground">
                    {orDash(item.referencias)}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={crudo}
                      onChange={(e) =>
                        setCostos((c) => ({
                          ...c,
                          [item.requerimientoItemId]: e.target.value,
                        }))
                      }
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-28"
                      aria-invalid={crudo !== '' && !valido}
                    />
                    {item.precioCotizado !== null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cotizó {formatPrecio(item.precioCotizado)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {subtotal === null ? '—' : formatPrecio(subtotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {completo
              ? 'Listo para confirmar.'
              : 'Falta el costo de algún ítem. Si alguno no se compró, regístralo en 0.'}
          </p>
          <p className="text-sm font-semibold text-foreground">
            Total: {formatPrecio(total)}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!completo || ocupado}>
            {ocupado ? <Spinner /> : <SaveIcon />}
            {costoExistente ? 'Guardar corrección' : 'Confirmar costo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
