import { PlusIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/shared/ui/table';
import { cn } from '@/shared/lib/utils';
import {
  dinero,
  subtotalDe,
  totalDe,
  LINEA_VACIA,
} from '@/modules/equipos/lib/documentos';
import type { LineaBorrador } from '@/modules/equipos/types';

/**
 * Las líneas del documento, editables en la propia tabla.
 *
 * El subtotal y el total se recalculan mientras se escribe, con la misma
 * fórmula del backend. La cifra que vale es la que devuelve el servidor
 * al guardar; esto es el eco inmediato para que nadie tenga que guardar
 * para ver cuánto suma.
 *
 * Las celdas calculadas van con fondo distinto, igual que en la grilla
 * del registro diario de obra: se distingue lo que se escribe de lo que
 * el sistema deduce sin tener que recordar una leyenda.
 */
export function TablaLineas({
  lineas,
  onCambiar,
  soloLectura = false,
}: {
  lineas: LineaBorrador[];
  onCambiar: (lineas: LineaBorrador[]) => void;
  soloLectura?: boolean;
}) {
  const editar = (i: number, campo: keyof LineaBorrador, valor: string) =>
    onCambiar(lineas.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  const quitar = (i: number) => onCambiar(lineas.filter((_, j) => j !== i));
  const agregar = () => onCambiar([...lineas, { ...LINEA_VACIA }]);

  const clase =
    'h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-sm outline-none hover:border-input focus:border-ring focus:bg-background focus:ring-3 focus:ring-ring/30';

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-28 text-right">Cantidad</TableHead>
              <TableHead className="w-32 text-right">P. unitario</TableHead>
              <TableHead className="w-32 text-right">Subtotal</TableHead>
              {!soloLectura && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={soloLectura ? 5 : 6}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Sin líneas. Agrega la primera para empezar a sumar.
                </TableCell>
              </TableRow>
            ) : (
              lineas.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  <TableCell className="p-0.5">
                    <input
                      className={clase}
                      value={l.descripcion}
                      readOnly={soloLectura}
                      onChange={(e) => editar(i, 'descripcion', e.target.value)}
                      placeholder="Qué se cotiza"
                    />
                  </TableCell>
                  <TableCell className="p-0.5">
                    <input
                      className={cn(clase, 'text-right tabular-nums')}
                      inputMode="decimal"
                      value={l.cantidad}
                      readOnly={soloLectura}
                      onChange={(e) => editar(i, 'cantidad', e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="p-0.5">
                    <input
                      className={cn(clase, 'text-right tabular-nums')}
                      inputMode="decimal"
                      value={l.precioUnitario}
                      readOnly={soloLectura}
                      onChange={(e) =>
                        editar(i, 'precioUnitario', e.target.value)
                      }
                    />
                  </TableCell>
                  {/* Calculada: fondo distinto y sin poder escribir. */}
                  <TableCell className="bg-muted/50 text-right tabular-nums">
                    {dinero(subtotalDe(l))}
                  </TableCell>
                  {!soloLectura && (
                    <TableCell className="p-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar la línea ${i + 1}`}
                        title={`Quitar la línea ${i + 1}`}
                        onClick={() => quitar(i)}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}

            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableCell
                colSpan={soloLectura ? 4 : 4}
                className="text-right font-semibold"
              >
                TOTAL
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {dinero(totalDe(lineas))}
              </TableCell>
              {!soloLectura && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {!soloLectura && (
        <Button variant="outline" size="sm" onClick={agregar}>
          <PlusIcon />
          Agregar línea
        </Button>
      )}
    </div>
  );
}
