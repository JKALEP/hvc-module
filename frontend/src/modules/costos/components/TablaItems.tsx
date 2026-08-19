import { PlusIcon, PencilIcon, Trash2Icon, PackageIcon } from 'lucide-react';

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/shared/ui/table';
import { Button } from '@/shared/ui/button';
import { orDash } from '@/shared/lib/format';
import type { RequerimientoItem } from '@/modules/costos/types';

/**
 * La tabla de ítems de §19, con el «+ Añadir» de §20.
 *
 * Las cinco columnas del documento y, cuando se puede editar, una sexta
 * de acciones. Sin edición inline: §20 dice que no se escribe sobre una
 * fila vacía, y por coherencia tampoco sobre una llena — se abre el
 * modal.
 *
 * En modo `soloLectura` es la vista previa de §24: la MISMA tabla sin
 * botones, para que lo que se revisa antes de emitir sea exactamente lo
 * que se emite.
 */
export function TablaItems({
  items,
  soloLectura,
  onAnadir,
  onEditar,
  onEliminar,
}: {
  items: RequerimientoItem[];
  soloLectura?: boolean;
  onAnadir?: () => void;
  onEditar?: (item: RequerimientoItem) => void;
  onEliminar?: (item: RequerimientoItem) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10">#</TableHead>
              <TableHead className="min-w-56">Descripción</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="min-w-40">Detalle de observación</TableHead>
              <TableHead className="min-w-32">Referencias</TableHead>
              {!soloLectura && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={soloLectura ? 6 : 7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  <PackageIcon className="mx-auto mb-2 size-6 opacity-50" />
                  Todavía no hay ítems. Un requerimiento necesita al menos uno
                  para poder emitirse.
                </TableCell>
              </TableRow>
            )}

            {items.map((item, n) => (
              <TableRow key={item.id} className="align-top">
                <TableCell className="text-muted-foreground tabular-nums">
                  {n + 1}
                </TableCell>
                <TableCell className="font-medium whitespace-normal text-foreground">
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
                {!soloLectura && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Editar ${item.descripcion}`}
                        onClick={() => onEditar?.(item)}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        aria-label={`Eliminar ${item.descripcion}`}
                        onClick={() => onEliminar?.(item)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!soloLectura && (
        <Button variant="outline" onClick={onAnadir}>
          <PlusIcon />
          Añadir ítem
        </Button>
      )}
    </div>
  );
}
