import { useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  PowerIcon,
  ListChecksIcon,
} from 'lucide-react';

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
import { Badge } from '@/shared/ui/badge';
import { Spinner } from '@/shared/ui/spinner';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import { Campo } from './Campo';
import {
  useOpcionesCatalogo,
  useCrearOpcion,
  useEditarOpcion,
  useEliminarOpcion,
} from '@/modules/costos/hooks/useMaestros';
import { cn } from '@/shared/lib/utils';
import type {
  OpcionCatalogoCompleta,
  TipoCatalogo,
} from '@/modules/costos/types';

/**
 * Los tres catálogos de §58, con su nombre visible.
 *
 * Son catálogos y no enums porque §58 lo exige: añadir «Predictivo» a
 * los tipos de mantenimiento no puede ser una migración.
 */
const CATALOGOS: { tipo: TipoCatalogo; nombre: string; ayuda: string }[] = [
  {
    tipo: 'TIPO_MANTENIMIENTO',
    nombre: 'Tipos de mantenimiento',
    ayuda: 'Preventivo, Correctivo, Predictivo…',
  },
  {
    tipo: 'TIPO_REQUERIMIENTO',
    nombre: 'Tipos de requerimiento',
    ayuda: 'Emergencia, Programado, Stock…',
  },
  {
    tipo: 'UNIDAD_MEDIDA',
    nombre: 'Unidades de medida',
    ayuda: 'UND, MT, KG, ROLLO…',
  },
];

/**
 * Los catálogos configurables (§58).
 *
 * No usa `MaestroCrud` aunque se le parezca: aquí hay un `orden` que
 * decide cómo salen en el selector y un `tipo` que NO se puede cambiar
 * al editar —moverlo de catálogo dejaría a los requerimientos que ya lo
 * eligieron apuntando a algo que significa otra cosa, y por eso el
 * backend ni siquiera acepta el campo—. Meter esas dos reglas en el
 * componente genérico lo habría llenado de excepciones para un solo
 * caso.
 */
export function AdminCatalogos() {
  const [tipo, setTipo] = useState<TipoCatalogo>('TIPO_MANTENIMIENTO');
  const [enFormulario, setEnFormulario] = useState<
    OpcionCatalogoCompleta | 'nueva' | null
  >(null);
  const [porBorrar, setPorBorrar] = useState<OpcionCatalogoCompleta | null>(
    null,
  );

  const { data, isError } = useOpcionesCatalogo(tipo);
  const crear = useCrearOpcion();
  const editar = useEditarOpcion();
  const eliminar = useEliminarOpcion();

  const catalogo = CATALOGOS.find((c) => c.tipo === tipo) as (typeof CATALOGOS)[number];
  const opciones = data ?? [];
  const cargando = !data && !isError;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Catálogos</h2>
          <p className="text-sm text-muted-foreground">
            Los valores que se ofrecen al llenar un requerimiento. {catalogo.ayuda}
          </p>
        </div>
        <Button onClick={() => setEnFormulario('nueva')}>
          <PlusIcon />
          Nuevo valor
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {CATALOGOS.map((c) => (
          <button
            key={c.tipo}
            onClick={() => setTipo(c.tipo)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tipo === c.tipo
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {cargando && <TableSkeleton rows={5} cols={4} />}

      {isError && (
        <p className="rounded-xl border border-border p-6 text-center text-sm text-destructive">
          No se pudo cargar el catálogo.
        </p>
      )}

      {data && opciones.length === 0 && (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border p-8 text-center">
          <ListChecksIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Este catálogo está vacío
          </p>
          <p className="text-sm text-muted-foreground">
            Sin valores aquí, nadie puede emitir un requerimiento.
          </p>
        </div>
      )}

      {data && opciones.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-20 text-right">Orden</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-32 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opciones.map((o) => {
                const activo = o.estado === 'ACTIVO';
                return (
                  <TableRow key={o.id} className={cn(!activo && 'opacity-60')}>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {o.orden}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {o.valor}
                    </TableCell>
                    <TableCell>
                      <Badge variant={activo ? 'success' : 'outline'}>
                        {activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={activo ? 'Desactivar' : 'Activar'}
                          aria-label={activo ? 'Desactivar' : 'Activar'}
                          disabled={editar.isPending}
                          onClick={() =>
                            editar.mutate({
                              id: o.id,
                              payload: {
                                estado: activo ? 'INACTIVO' : 'ACTIVO',
                              },
                            })
                          }
                        >
                          <PowerIcon
                            className={
                              activo
                                ? 'text-muted-foreground'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => setEnFormulario(o)}
                        >
                          <PencilIcon className="text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Eliminar"
                          aria-label="Eliminar"
                          onClick={() => setPorBorrar(o)}
                        >
                          <Trash2Icon className="text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {enFormulario && (
        <FormularioOpcion
          catalogo={catalogo.nombre}
          opcion={enFormulario === 'nueva' ? undefined : enFormulario}
          ocupado={crear.isPending || editar.isPending}
          onGuardar={({ valor, orden }) => {
            if (enFormulario === 'nueva')
              crear.mutate(
                { tipo, valor, orden },
                { onSuccess: () => setEnFormulario(null) },
              );
            else
              editar.mutate(
                { id: enFormulario.id, payload: { valor, orden } },
                { onSuccess: () => setEnFormulario(null) },
              );
          }}
          onCerrar={() => setEnFormulario(null)}
        />
      )}

      {porBorrar && (
        <DialogoConfirmar
          titulo="Eliminar el valor"
          mensaje={`Se eliminará "${porBorrar.valor}" de ${catalogo.nombre.toLowerCase()}.`}
          detalle="Si algún requerimiento lo eligió no se podrá borrar: en ese caso desactívalo — lo ya registrado conserva el nombre con el que se emitió."
          textoConfirmar="Eliminar"
          destructivo
          ocupado={eliminar.isPending}
          onConfirmar={() =>
            eliminar.mutate(porBorrar.id, {
              onSuccess: () => setPorBorrar(null),
            })
          }
          onCerrar={() => setPorBorrar(null)}
        />
      )}
    </div>
  );
}

function FormularioOpcion({
  catalogo,
  opcion,
  ocupado,
  onGuardar,
  onCerrar,
}: {
  catalogo: string;
  opcion?: OpcionCatalogoCompleta;
  ocupado: boolean;
  onGuardar: (v: { valor: string; orden: number }) => void;
  onCerrar: () => void;
}) {
  const [valor, setValor] = useState(opcion?.valor ?? '');
  const [orden, setOrden] = useState(String(opcion?.orden ?? 0));

  const n = Number(orden);
  const ordenValido = orden.trim() !== '' && Number.isInteger(n) && n >= 0;
  const valido = valor.trim() !== '' && ordenValido;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{opcion ? 'Editar valor' : 'Nuevo valor'}</DialogTitle>
          <DialogDescription>
            En {catalogo.toLowerCase()}.
            {opcion
              ? ' El catálogo no se cambia: sería mover el valor a otro sitio y dejar a los requerimientos que ya lo eligieron apuntando a otra cosa.'
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Campo label="Valor" requerido>
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ej.: Preventivo"
              autoFocus
              aria-invalid={valor.trim() === ''}
            />
          </Campo>
          <Campo
            label="Orden"
            requerido
            ayuda="En qué posición sale dentro del selector. Empata por nombre."
          >
            <Input
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              inputMode="numeric"
              aria-invalid={!ordenValido}
            />
          </Campo>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button
            onClick={() => valido && onGuardar({ valor: valor.trim(), orden: n })}
            disabled={!valido || ocupado}
          >
            {ocupado ? <Spinner /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
