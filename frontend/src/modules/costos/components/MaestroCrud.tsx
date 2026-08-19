import { useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  PowerIcon,
  SearchIcon,
  HistoryIcon,
  InboxIcon,
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
import { orDash } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { EstadoCatalogo } from '@/modules/costos/types';

/** Un campo del maestro: cómo se pide y si se enseña en la tabla. */
export interface CampoMaestro {
  clave: string;
  etiqueta: string;
  requerido?: boolean;
  placeholder?: string;
  /** Si no, solo aparece en el formulario. La tabla no puede tener 8 columnas. */
  enTabla?: boolean;
}

/** Lo mínimo que un maestro tiene que ser para que esto lo sepa pintar. */
interface FilaMaestro {
  id: number;
  estado: EstadoCatalogo;
}

/**
 * La pantalla de un maestro: buscar, dar de alta, editar, activar o
 * desactivar, y borrar.
 *
 * ── Por qué es UNA y no tres ─────────────────────────────────────────
 * Clientes, supervisores y proveedores tienen exactamente la misma
 * forma: una lista con buscador, un formulario de campos de texto, un
 * interruptor de estado y un borrado que el backend puede rechazar si
 * está en uso. Lo ÚNICO que cambia entre los tres es qué campos se
 * piden, y eso es un parámetro, no una rama —el mismo criterio por el
 * que `OpcionService` es un solo service para los tres catálogos—.
 *
 * Escribirlas por separado habría dejado tres copias del mismo diálogo
 * divergiendo con el tiempo, que es la lección de `umbrales.ts`: seis
 * funciones con seis nombres para la misma escalera de color.
 *
 * ── Desactivar no es borrar, y son dos botones distintos ─────────────
 * Desactivar retira el valor de los selectores y conserva todo lo
 * registrado con él; borrar solo se admite si nadie lo usó nunca. El
 * backend lo hace cumplir con `exigirSinUso` y su mensaje ya explica
 * cuántos lo usan y que se puede desactivar en su lugar, así que aquí no
 * se adivina: se intenta y se muestra lo que responda.
 */
export function MaestroCrud<T extends FilaMaestro>({
  titulo,
  descripcion,
  singular,
  campos,
  filas,
  cargando,
  hayError,
  busqueda,
  onBuscar,
  nombreDe,
  guardando,
  borrando,
  onCrear,
  onEditar,
  onEliminar,
  onVerHistorial,
}: {
  titulo: string;
  descripcion: string;
  /** «el cliente», «el proveedor». Para los textos de los diálogos. */
  singular: string;
  campos: CampoMaestro[];
  filas: T[];
  cargando: boolean;
  hayError: boolean;
  busqueda: string;
  onBuscar: (q: string) => void;
  /** Cómo se llama una fila, para los mensajes. */
  nombreDe: (fila: T) => string;
  guardando: boolean;
  borrando: boolean;
  onCrear: (valores: Record<string, string>) => void;
  onEditar: (id: number, valores: Record<string, string>) => void;
  /** `alLograrlo` cierra el diálogo; si falla, se queda abierto. */
  onEliminar: (id: number, alLograrlo: () => void) => void;
  /** Abre la bitácora de esa fila (§64). Opcional. */
  onVerHistorial?: (fila: T) => void;
}) {
  const [enFormulario, setEnFormulario] = useState<T | 'nuevo' | null>(null);
  const [porBorrar, setPorBorrar] = useState<T | null>(null);

  const columnas = campos.filter((c) => c.enTabla);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
        <Button onClick={() => setEnFormulario('nuevo')}>
          <PlusIcon />
          Nuevo
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => onBuscar(e.target.value)}
          placeholder="Buscar…"
          className="pl-8"
        />
      </div>

      {cargando && <TableSkeleton rows={5} cols={columnas.length + 2} />}

      {hayError && (
        <p className="rounded-xl border border-border p-6 text-center text-sm text-destructive">
          No se pudo cargar la lista.
        </p>
      )}

      {!cargando && !hayError && filas.length === 0 && (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border p-8 text-center">
          <InboxIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {busqueda ? 'Nada coincide con la búsqueda' : 'Todavía no hay nada'}
          </p>
          <p className="text-sm text-muted-foreground">
            {busqueda
              ? 'Prueba con otras palabras.'
              : `Da de alta ${singular} con el botón «Nuevo».`}
          </p>
        </div>
      )}

      {!cargando && !hayError && filas.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {columnas.map((c) => (
                  <TableHead key={c.clave}>{c.etiqueta}</TableHead>
                ))}
                <TableHead>Estado</TableHead>
                <TableHead className="w-40 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => {
                const activo = fila.estado === 'ACTIVO';
                return (
                  <TableRow
                    key={fila.id}
                    className={cn(!activo && 'opacity-60')}
                  >
                    {columnas.map((c, i) => (
                      <TableCell
                        key={c.clave}
                        className={
                          i === 0 ? 'font-medium text-foreground' : undefined
                        }
                      >
                        {orDash(texto(fila, c.clave))}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Badge variant={activo ? 'success' : 'outline'}>
                        {activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {onVerHistorial && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ver su historial"
                            aria-label="Ver su historial"
                            onClick={() => onVerHistorial(fila)}
                          >
                            <HistoryIcon className="text-muted-foreground" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title={activo ? 'Desactivar' : 'Activar'}
                          aria-label={activo ? 'Desactivar' : 'Activar'}
                          disabled={guardando}
                          onClick={() =>
                            onEditar(fila.id, {
                              estado: activo ? 'INACTIVO' : 'ACTIVO',
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
                          onClick={() => setEnFormulario(fila)}
                        >
                          <PencilIcon className="text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Eliminar"
                          aria-label="Eliminar"
                          onClick={() => setPorBorrar(fila)}
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
        <FormularioMaestro
          singular={singular}
          campos={campos}
          inicial={
            enFormulario === 'nuevo'
              ? undefined
              : (enFormulario as unknown as Record<string, unknown>)
          }
          ocupado={guardando}
          onGuardar={(valores) => {
            if (enFormulario === 'nuevo') onCrear(valores);
            else onEditar(enFormulario.id, valores);
            setEnFormulario(null);
          }}
          onCerrar={() => setEnFormulario(null)}
        />
      )}

      {porBorrar && (
        <DialogoConfirmar
          titulo={`Eliminar ${singular}`}
          mensaje={`Se eliminará "${nombreDe(porBorrar)}".`}
          detalle="Si ya se usó en algún requerimiento no se podrá borrar: en ese caso, desactívalo — lo registrado se conserva."
          textoConfirmar="Eliminar"
          destructivo
          ocupado={borrando}
          // Se cierra al acertar, no al pulsar: si el backend lo rechaza
          // por estar en uso, el diálogo sigue delante mientras se lee el
          // aviso. Cerrarlo antes de saber el resultado daría por hecho
          // que salió bien.
          onConfirmar={() => onEliminar(porBorrar.id, () => setPorBorrar(null))}
          onCerrar={() => setPorBorrar(null)}
        />
      )}
    </div>
  );
}

/** El valor de un campo como texto, venga como venga. */
function texto(fila: unknown, clave: string): string | null {
  const valor = (fila as Record<string, unknown>)[clave];
  if (valor === null || valor === undefined || valor === '') return null;
  return String(valor);
}

/**
 * El formulario, igual para el alta y para la edición.
 *
 * Se manda SOLO lo que el usuario dejó escrito, y los vacíos van como
 * cadena vacía para que el backend los convierta en null: sus
 * `aTextoOpcional` ya hacen esa traducción, y decidirla aquí sería
 * duplicar la regla.
 */
function FormularioMaestro({
  singular,
  campos,
  inicial,
  ocupado,
  onGuardar,
  onCerrar,
}: {
  singular: string;
  campos: CampoMaestro[];
  inicial?: Record<string, unknown>;
  ocupado: boolean;
  onGuardar: (valores: Record<string, string>) => void;
  onCerrar: () => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const inicio: Record<string, string> = {};
    for (const c of campos) inicio[c.clave] = texto(inicial ?? {}, c.clave) ?? '';
    return inicio;
  });

  const completo = campos
    .filter((c) => c.requerido)
    .every((c) => (valores[c.clave] ?? '').trim() !== '');

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {inicial ? `Editar ${singular}` : `Nuevo ${singular.replace(/^el |^la /, '')}`}
          </DialogTitle>
          <DialogDescription>
            Los campos con asterisco son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {campos.map((c) => (
            <Campo key={c.clave} label={c.etiqueta} requerido={c.requerido}>
              <Input
                value={valores[c.clave] ?? ''}
                onChange={(e) =>
                  setValores((v) => ({ ...v, [c.clave]: e.target.value }))
                }
                placeholder={c.placeholder}
                aria-invalid={
                  c.requerido && (valores[c.clave] ?? '').trim() === ''
                }
              />
            </Campo>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button
            onClick={() => completo && onGuardar(valores)}
            disabled={!completo || ocupado}
          >
            {ocupado ? <Spinner /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
