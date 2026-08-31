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
import type { DestinoCotizacion, Proveedor } from '@/modules/costos/types';

/** Formato laxo: solo descarta lo que NO puede ser una dirección. */
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * A quién pedirle cotización (§30-33).
 *
 * Se busca por nombre, nombre comercial, RUC o correo — los criterios de
 * §30, resueltos en el backend, que es donde está el índice. Aquí solo
 * se retrasa la petición mientras se teclea.
 *
 * ── El correo se puede escribir aquí ────────────────────────────────
 * Antes, al proveedor sin correo en su ficha no se le podía ni marcar:
 * había que salir a Administración, completarlo y volver. Ahora la
 * dirección se escribe en la propia fila.
 *
 * Lo escrito PISA a lo de la ficha para este envío, que resuelve también
 * al proveedor cuyo correo guardado ya no responde. Y si la ficha estaba
 * vacía, el backend lo guarda ahí para no volver a pedirlo.
 *
 * Lo que NO cambia es a quién se le pide: se elige un PROVEEDOR, no una
 * dirección suelta. De ese id cuelgan la solicitud, la cotización que
 * llegue y el costo que se registre al final.
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
  onCompartir: (destinos: DestinoCotizacion[]) => void;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  /** Lo tecleado por proveedor. Vacío = usar el de su ficha. */
  const [correos, setCorreos] = useState<Record<number, string>>({});

  const q = useDebounce(busqueda, 300);
  const { data, isError, isFetching } = useProveedores(q);

  const proveedores = useMemo(() => data ?? [], [data]);
  const cargando = !data && !isError;

  const alternar = (p: Proveedor) => {
    setElegidos((antes) => {
      const copia = new Set(antes);
      if (copia.has(p.id)) copia.delete(p.id);
      else copia.add(p.id);
      return copia;
    });
  };

  const repetidos = [...elegidos].filter((id) => yaSolicitados.has(id)).length;

  /** La dirección con la que saldría este proveedor: la escrita o la suya. */
  const direccionDe = (p: Proveedor) => (correos[p.id] ?? '').trim() || p.correo;

  /**
   * ¿Falta algo para poder mandar?
   *
   * Se comprueba aquí Y en el backend. Aquí para que el botón diga la
   * verdad antes de pulsarlo; allí porque es donde la regla se cumple.
   */
  const incompletos = proveedores.filter((p) => {
    if (!elegidos.has(p.id)) return false;
    const d = direccionDe(p);
    return !d || !FORMATO_CORREO.test(d);
  });

  const destinos = (): DestinoCotizacion[] =>
    [...elegidos].map((id) => {
      const escrito = (correos[id] ?? '').trim();
      return escrito ? { proveedorId: id, correo: escrito } : { proveedorId: id };
    });

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
                      'cursor-pointer hover:bg-muted/50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
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
                      {/* El campo solo aparece al marcarlo: enseñar un
                          input por fila convertiría la lista en un
                          formulario de veinte campos. */}
                      {marcado && (
                        <div className="mt-2">
                          <Input
                            value={correos[p.id] ?? ''}
                            onChange={(e) =>
                              setCorreos((antes) => ({
                                ...antes,
                                [p.id]: e.target.value,
                              }))
                            }
                            onClick={(e) => e.stopPropagation()}
                            placeholder={
                              p.correo ?? 'Escribe el correo del proveedor…'
                            }
                            aria-label={`Correo para ${p.razonSocial}`}
                            aria-invalid={
                              !direccionDe(p) ||
                              !FORMATO_CORREO.test(direccionDe(p) as string)
                            }
                            className="h-8 text-sm"
                          />
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MailWarningIcon className="size-3.5 shrink-0" />
                            {sinCorreo
                              ? 'No tiene correo en su ficha. El que escribas se guardará ahí.'
                              : 'Vacío usa el de su ficha. Lo que escribas vale solo para este envío.'}
                          </p>
                        </div>
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
          {incompletos.length > 0 && (
            <span className="text-warning-soft-foreground">
              Falta un correo válido en {incompletos.length} de los
              seleccionados.
            </span>
          )}
          {repetidos > 0 && incompletos.length === 0 && (
            <span className="text-warning-soft-foreground">
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
            onClick={() => onCompartir(destinos())}
            disabled={elegidos.size === 0 || incompletos.length > 0 || ocupado}
          >
            {ocupado ? <Spinner /> : <SendIcon />}
            Pedir cotización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
