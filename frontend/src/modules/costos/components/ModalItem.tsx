import { useState } from 'react';
import { AlertTriangleIcon, CheckIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { Campo } from './Campo';
import { Textarea } from '@/shared/ui/textarea';
import type {
  GuardarItemPayload,
  OpcionCatalogo,
  RequerimientoItem,
} from '@/modules/costos/types';

/**
 * El modal de §21: se pulsa «+ Añadir» y se llena aquí.
 *
 * §20 es explícito en que NO se escribe sobre una fila vacía de la
 * tabla. El ítem entra completo de una vez, con el fondo bloqueado, y
 * eso además es lo que permite validarlo entero antes de tocar nada.
 *
 * Sirve para añadir y para editar: son el mismo formulario y los mismos
 * cinco campos. Lo único que cambia al editar es el aviso de §54, que
 * solo aparece cuando el cambio puede invalidar precios ya recibidos.
 */
export function ModalItem({
  item,
  unidades,
  yaCotizado,
  ocupado,
  onGuardar,
  onCerrar,
}: {
  /** Sin ítem, es un alta. */
  item?: RequerimientoItem;
  unidades: OpcionCatalogo[];
  /**
   * Si algún proveedor ya puso precio a este ítem. Solo se sabe al
   * editar, y es lo que dispara el aviso de §54.
   */
  yaCotizado?: boolean;
  ocupado: boolean;
  onGuardar: (payload: GuardarItemPayload) => void;
  onCerrar: () => void;
}) {
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? '');
  const [unidad, setUnidad] = useState(item?.unidad ?? unidades[0]?.valor ?? '');
  const [cantidad, setCantidad] = useState(String(item?.cantidad ?? ''));
  const [detalle, setDetalle] = useState(item?.detalleObservacion ?? '');
  const [referencias, setReferencias] = useState(item?.referencias ?? '');

  const n = Number(cantidad);
  const cantidadValida = Number.isInteger(n) && n > 0;
  const listo = descripcion.trim() !== '' && unidad !== '' && cantidadValida;

  /**
   * ¿El cambio altera lo que se pide?
   *
   * Solo descripción, unidad y cantidad invalidan un precio. Corregir
   * una referencia no obliga a volver a preguntarle a nadie, y avisar de
   * ello sería enseñar a ignorar el aviso.
   */
  const alteraLoPedido =
    !!item &&
    (descripcion.trim() !== item.descripcion ||
      unidad !== item.unidad ||
      (cantidadValida && n !== item.cantidad));

  const guardar = () => {
    if (!listo) return;
    onGuardar({
      descripcion: descripcion.trim(),
      unidad,
      cantidad: n,
      detalleObservacion: detalle.trim() || null,
      referencias: referencias.trim() || null,
    });
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar ítem' : 'Añadir ítem'}</DialogTitle>
          <DialogDescription>
            Descripción, unidad y cantidad son obligatorias.
          </DialogDescription>
        </DialogHeader>

        {yaCotizado && alteraLoPedido && (
          <div className="flex gap-2.5 rounded-lg border border-warning/25 bg-warning-soft p-3 text-sm text-warning-soft-foreground">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">
                Este ítem ya está cotizado por algún proveedor.
              </p>
              <p>
                Si cambias la descripción, la unidad o la cantidad, esas
                cotizaciones quedarán pendientes de revisar y habrá que
                volver a pedirles precio. Lo ya recibido no se borra.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <Campo label="Descripción" requerido>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Cinta de aluminio 2&quot;"
                autoFocus
              />
            </Campo>
          </div>

          <div className="sm:col-span-3">
            <Campo label="Unidad" requerido>
              <Select
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
              >
                {unidades.map((u) => (
                  <option key={u.id} value={u.valor}>
                    {u.valor}
                  </option>
                ))}
              </Select>
            </Campo>
          </div>

          <div className="sm:col-span-3">
            <Campo
              label="Cantidad"
              requerido
              ayuda="Número entero mayor que 0."
            >
              <Input
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                inputMode="numeric"
                placeholder="4"
                aria-invalid={cantidad !== '' && !cantidadValida}
              />
            </Campo>
          </div>

          <div className="sm:col-span-6">
            <Campo label="Detalle de observación">
              <Textarea
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                rows={2}
                placeholder="Para sellado de ductos."
              />
            </Campo>
          </div>

          <div className="sm:col-span-6">
            <Campo label="Referencias" ayuda="Marca, modelo, código.">
              <Input
                value={referencias}
                onChange={(e) => setReferencias(e.target.value)}
                placeholder="Marca 3M, código 425"
              />
            </Campo>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!listo || ocupado}>
            {ocupado ? <Spinner /> : <CheckIcon />}
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
