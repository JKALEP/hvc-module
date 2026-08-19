import { useMemo, useState } from 'react';
import {
  SearchIcon,
  SendIcon,
  MailWarningIcon,
  BuildingIcon,
} from 'lucide-react';

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
import { Badge } from '@/shared/ui/badge';
import { Spinner } from '@/shared/ui/spinner';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useProveedores } from '@/modules/costos/hooks/useProveedores';
import { cn } from '@/shared/lib/utils';
import type { Proveedor } from '@/modules/costos/types';

/**
 * A quién pedirle cotización (§30-33).
 *
 * Se busca por nombre, nombre comercial, RUC o correo — los criterios de
 * §30, resueltos en el backend, que es donde está el índice. Aquí solo
 * se retrasa la petición mientras se teclea.
 *
 * ── Por qué se marca al que no tiene correo ──────────────────────────
 * El backend rechaza la tanda ENTERA si alguno de los elegidos no tiene
 * dirección: es un dato que falta en su ficha, no un envío que salió
 * mal. Dejar que se seleccione para después devolver un 400 sería
 * esconder el problema hasta el peor momento, así que se ve desde la
 * lista y no se puede marcar.
 *
 * Se admite volver a elegir a un proveedor al que YA se le pidió: §33
 * avisa de que no todos responden y §44 admite una segunda vuelta. El
 * backend crea una fila por envío, no una por proveedor, así que
 * insistir queda registrado como lo que es.
 */
export function SelectorProveedores({
  yaSolicitados,
  ocupado,
  onCompartir,
  onCerrar,
}: {
  /** Ids a los que ya se les pidió, para avisar de que se está insistiendo. */
  yaSolicitados: Set<number>;
  ocupado: boolean;
  onCompartir: (proveedorIds: number[]) => void;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());

  const q = useDebounce(busqueda, 300);
  const { data, isError, isFetching } = useProveedores(q);

  const proveedores = useMemo(() => data ?? [], [data]);
  const cargando = !data && !isError;

  const alternar = (p: Proveedor) => {
    if (!p.correo) return;
    setElegidos((antes) => {
      const copia = new Set(antes);
      if (copia.has(p.id)) copia.delete(p.id);
      else copia.add(p.id);
      return copia;
    });
  };

  const repetidos = [...elegidos].filter((id) => yaSolicitados.has(id)).length;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Pedir cotización</DialogTitle>
          <DialogDescription>
            Elige a quién mandarle el requerimiento. Se envía por correo con
            la lista de ítems ya formateada.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, RUC o correo…"
            className="pl-8"
            autoFocus
          />
          {isFetching && (
            <Spinner className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>

        <div className="min-h-40 flex-1 overflow-y-auto rounded-xl border border-border">
          {cargando && (
            <p className="p-4 text-sm text-muted-foreground">
              Cargando proveedores…
            </p>
          )}

          {isError && (
            <p className="p-4 text-sm text-destructive">
              No se pudieron cargar los proveedores.
            </p>
          )}

          {data && proveedores.length === 0 && (
            <div className="flex flex-col items-center gap-1 p-8 text-center">
              <BuildingIcon className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                {q ? 'Ningún proveedor coincide' : 'No hay proveedores activos'}
              </p>
              <p className="text-sm text-muted-foreground">
                {q
                  ? 'Prueba con parte del nombre, el RUC o el correo.'
                  : 'Da de alta al menos uno antes de pedir cotización.'}
              </p>
            </div>
          )}

          <ul className="divide-y divide-border">
            {proveedores.map((p) => {
              const marcado = elegidos.has(p.id);
              const sinCorreo = !p.correo;
              return (
                <li key={p.id}>
                  <label
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5',
                      sinCorreo
                        ? 'cursor-not-allowed opacity-60'
                        : 'cursor-pointer hover:bg-muted/50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={sinCorreo}
                      onChange={() => alternar(p)}
                      className="mt-1 size-4 shrink-0 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {p.razonSocial}
                        </span>
                        {p.nombreComercial && (
                          <span className="text-xs text-muted-foreground">
                            ({p.nombreComercial})
                          </span>
                        )}
                        {yaSolicitados.has(p.id) && (
                          <Badge variant="secondary">ya se le pidió</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.ruc ? `RUC ${p.ruc}` : 'sin RUC'}
                        {' · '}
                        {p.correo ?? 'sin correo'}
                      </p>
                      {sinCorreo && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                          <MailWarningIcon className="size-3.5" />
                          Complétale el correo en su ficha para poder pedirle
                          cotización.
                        </p>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {elegidos.size === 0
              ? 'Nadie seleccionado.'
              : `${String(elegidos.size)} proveedor(es) seleccionados.`}
          </span>
          {repetidos > 0 && (
            <span className="text-amber-700 dark:text-amber-400">
              A {repetidos} ya se le había pedido: se le vuelve a mandar y
              queda registrado como un envío nuevo.
            </span>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button
            onClick={() => onCompartir([...elegidos])}
            disabled={elegidos.size === 0 || ocupado}
          >
            {ocupado ? <Spinner /> : <SendIcon />}
            Pedir cotización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
