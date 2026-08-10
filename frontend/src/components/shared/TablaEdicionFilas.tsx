import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CopyIcon, Trash2Icon } from 'lucide-react';

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EstadoBadge } from './EstadoBadge';
import { editarProducto } from '@/services/importacionService';
import { getErrorMessage } from '@/services/api';
import {
  useDuplicarProducto,
  useEliminarProducto,
} from '@/hooks/useImportacionMutations';
import { QUERY_KEYS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { orDash } from '@/lib/format';
import type { Producto } from '@/types/models';

// Campos editables inline.
type CampoEditable = 'codigo' | 'precioUnitario' | 'proveedor' | 'ruc';
type Draft = Partial<Record<CampoEditable, string>>;

interface FooterApi {
  guardarTodo: () => void;
  guardando: boolean;
  hayCambios: boolean;
}

interface Props {
  importacionId: number;
  productos: Producto[];
  /** Footer con los botones (Guardar / Cancelar), controlado por la página. */
  renderFooter?: (api: FooterApi) => ReactNode;
  /** Se llama tras guardar con éxito. */
  onGuardado?: () => void;
}

export function TablaEdicionFilas({
  importacionId,
  productos,
  renderFooter,
  onGuardado,
}: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [guardando, setGuardando] = useState(false);

  const duplicar = useDuplicarProducto();
  const eliminar = useEliminarProducto();

  // Valor actual mostrado: draft si existe, si no el del servidor.
  const val = (p: Producto, campo: CampoEditable): string => {
    const d = drafts[p.id]?.[campo];
    if (d !== undefined) return d;
    return (p[campo] as string | null) ?? '';
  };

  const setVal = (id: number, campo: CampoEditable, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [campo]: value },
    }));
  };

  // Completitud calculada con los valores actuales (para el color en vivo).
  const esCompleta = (p: Producto): boolean =>
    !!val(p, 'codigo').trim() &&
    !!val(p, 'precioUnitario').trim() &&
    !!val(p, 'proveedor').trim() &&
    !!val(p, 'ruc').trim();

  const hayCambios = Object.keys(drafts).length > 0;

  const guardarTodo = async () => {
    setGuardando(true);
    try {
      await Promise.all(
        productos.map((p) => {
          const limpio = (s: string) => (s.trim() === '' ? null : s.trim());
          return editarProducto(importacionId, p.id, {
            codigo: limpio(val(p, 'codigo')),
            precioUnitario: limpio(val(p, 'precioUnitario')),
            proveedor: limpio(val(p, 'proveedor')),
            ruc: limpio(val(p, 'ruc')),
          });
        }),
      );
      qc.invalidateQueries({ queryKey: QUERY_KEYS.importacion(importacionId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.importaciones });
      qc.invalidateQueries({ queryKey: ['maestro'] });
      setDrafts({});
      toast.success('Cambios guardados');
      onGuardado?.();
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudieron guardar los cambios'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Estado</TableHead>
              <TableHead>Código</TableHead>
              <TableHead className="min-w-56">Descripción</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="min-w-40">Detalles</TableHead>
              <TableHead>Referencias</TableHead>
              <TableHead className="min-w-32">Precio Unit.</TableHead>
              <TableHead className="min-w-44">Proveedor</TableHead>
              <TableHead>RUC</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.map((p) => {
              const completa = esCompleta(p);
              return (
                <TableRow
                  key={p.id}
                  className={cn(
                    'align-top transition-colors',
                    completa
                      ? 'bg-emerald-50/60 hover:bg-emerald-50 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15'
                      : 'bg-amber-50/50 hover:bg-amber-100/50 dark:bg-amber-500/10 dark:hover:bg-amber-500/15',
                  )}
                >
                  <TableCell>
                    <EstadoBadge
                      estado={completa ? 'COMPLETO' : 'INCOMPLETO'}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={val(p, 'codigo')}
                      onChange={(e) => setVal(p.id, 'codigo', e.target.value)}
                      placeholder="Código"
                      className="h-8 w-28 bg-background"
                    />
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal text-sm">
                    {p.descripcion}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {orDash(p.unidadMedida)}
                  </TableCell>
                  <TableCell className="max-w-48 whitespace-normal text-sm text-muted-foreground">
                    {orDash(p.detalles)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {orDash(p.referencias)}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={val(p, 'precioUnitario')}
                      onChange={(e) =>
                        setVal(p.id, 'precioUnitario', e.target.value)
                      }
                      inputMode="decimal"
                      placeholder="0.00"
                      className="h-8 w-24 bg-background"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={val(p, 'proveedor')}
                      onChange={(e) =>
                        setVal(p.id, 'proveedor', e.target.value)
                      }
                      placeholder="Empresa"
                      className="h-8 w-40 bg-background"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={val(p, 'ruc')}
                      onChange={(e) => setVal(p.id, 'ruc', e.target.value)}
                      placeholder="RUC"
                      className="h-8 w-32 bg-background"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Duplicar fila"
                        disabled={duplicar.isPending}
                        onClick={() =>
                          duplicar.mutate({
                            importacionId,
                            productoId: p.id,
                          })
                        }
                      >
                        <CopyIcon />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        aria-label="Eliminar fila"
                        disabled={eliminar.isPending}
                        onClick={() =>
                          eliminar.mutate({
                            importacionId,
                            productoId: p.id,
                          })
                        }
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {renderFooter?.({ guardarTodo, guardando, hayCambios })}
    </div>
  );
}
