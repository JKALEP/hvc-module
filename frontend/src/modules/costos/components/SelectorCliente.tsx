import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon, PlusIcon } from 'lucide-react';

import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { cn } from '@/shared/lib/utils';
import type { ClienteCostos } from '@/modules/costos/types';

/**
 * El campo «Cliente» de §13: se escribe, y lo que se escribe busca.
 *
 * Era un `<select>` cerrado contra el maestro, y eso dejaba atascado a
 * quien emite un requerimiento para un cliente que todavía nadie dio de
 * alta: o paraba a pedírselo al SuperAdmin, o —lo que pasaba de verdad—
 * elegía uno parecido con tal de seguir. Ahora, si lo escrito no
 * coincide con nada, se ofrece crearlo desde aquí.
 *
 * ⚠️ Sigue guardando un **id**, no el texto. `Requerimiento.clienteId` es
 * una FK real con `onDelete: Restrict` y de ella cuelgan la pantalla de
 * Clientes y los reportes por cliente; un campo de texto libre los habría
 * roto los dos. Lo que cambia es cómo se ELIGE, no lo que se guarda.
 *
 * No pide nada al servidor para buscar: la lista activa ya viene entera
 * en `GET /costos/requerimiento/opciones`, que es la misma llamada que
 * llena los demás selectores del formulario. Filtrar en memoria evita una
 * petición por tecla sobre una lista que en HVC son decenas de filas.
 */
export function SelectorCliente({
  clienteId,
  clientes,
  deshabilitado,
  creando,
  onElegir,
  onCrear,
}: {
  /** Id en texto, como el resto de `Cabecera`. Vacío = sin elegir. */
  clienteId: string;
  clientes: ClienteCostos[];
  deshabilitado?: boolean;
  /** Hay un alta en vuelo: bloquea el botón para no crear dos veces. */
  creando?: boolean;
  onElegir: (id: string) => void;
  /**
   * Se pide el alta; quien la resuelve decide a quién seleccionar.
   *
   * Opcional: sin él el combobox solo BUSCA. Es lo que usa la pantalla de
   * detalle, donde se corrige un requerimiento existente y dar de alta un
   * cliente no viene a cuento.
   */
  onCrear?: (nombre: string) => void;
}) {
  const elegido = useMemo(
    () => clientes.find((c) => String(c.id) === clienteId) ?? null,
    [clientes, clienteId],
  );

  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const caja = useRef<HTMLDivElement>(null);

  /**
   * Con el desplegable cerrado, el input enseña al cliente elegido.
   *
   * Se sincroniza desde `elegido` y no al pulsar, porque la selección
   * puede venir de fuera: al cargar un borrador ya guardado, o cuando un
   * alta recién creada llega en la lista y hay que reflejarla.
   */
  useEffect(() => {
    if (!abierto) setTexto(elegido?.nombre ?? '');
  }, [elegido, abierto]);

  // Clic fuera: se cierra y se descarta lo tecleado a medias. Sin esto, el
  // input se quedaría con un texto que no corresponde a lo seleccionado.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const consulta = texto.trim().toLowerCase();

  const coincidencias = useMemo(() => {
    if (consulta === '') return clientes;
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(consulta) ||
        (c.ruc ?? '').toLowerCase().includes(consulta),
    );
  }, [clientes, consulta]);

  /**
   * ¿Ofrecer el alta?
   *
   * Solo si lo escrito no es YA el nombre de alguien, comparando sin
   * mayúsculas ni espacios de sobra. Ofrecer «crear Alicorp» teniendo
   * Alicorp delante es la vía corta al maestro duplicado, que es
   * justamente lo que este campo tiene que evitar.
   */
  const nombreNuevo = texto.trim();
  const existeIgual = clientes.some(
    (c) => c.nombre.trim().toLowerCase() === nombreNuevo.toLowerCase(),
  );
  const puedeCrear = !!onCrear && nombreNuevo !== '' && !existeIgual;

  const elegir = (c: ClienteCostos) => {
    onElegir(String(c.id));
    setTexto(c.nombre);
    setAbierto(false);
  };

  const crear = () => {
    if (!puedeCrear || creando || !onCrear) return;
    onCrear(nombreNuevo);
    setAbierto(false);
  };

  return (
    <div ref={caja} className="relative">
      <Input
        value={texto}
        disabled={deshabilitado}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAbierto(false);
          // Enter con una sola coincidencia la toma; si no hay ninguna y
          // se puede crear, crea. Es el atajo de quien ya sabe qué quiere.
          if (e.key === 'Enter') {
            e.preventDefault();
            if (coincidencias.length === 1) elegir(coincidencias[0]);
            else if (coincidencias.length === 0 && puedeCrear) crear();
          }
        }}
        placeholder="Escribe para buscar…"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        className="pr-8"
      />

      <ChevronDownIcon
        className={cn(
          'pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground transition-transform',
          abierto && 'rotate-180',
        )}
      />

      {abierto && !deshabilitado && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
          <ul className="divide-y divide-border">
            {coincidencias.map((c) => {
              const marcado = String(c.id) === clienteId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => elegir(c)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                      marcado && 'bg-accent/60',
                    )}
                  >
                    <CheckIcon
                      className={cn(
                        'size-4 shrink-0',
                        marcado ? 'text-brand' : 'invisible',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                    {c.ruc && (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {c.ruc}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}

            {puedeCrear && (
              <li>
                <button
                  type="button"
                  onClick={crear}
                  disabled={creando}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-brand hover:bg-accent disabled:opacity-60"
                >
                  {creando ? (
                    <Spinner className="size-4 shrink-0" />
                  ) : (
                    <PlusIcon className="size-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    Crear «{nombreNuevo}»
                  </span>
                </button>
              </li>
            )}

            {coincidencias.length === 0 && !puedeCrear && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                {clientes.length === 0
                  ? 'No hay clientes activos todavía.'
                  : 'Ningún cliente coincide.'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
