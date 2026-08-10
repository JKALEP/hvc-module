import { useState } from 'react';
import { SearchIcon, XIcon, UserPlusIcon, UsersIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/useDebounce';
import { useTrabajadores, useEmpresas } from '@/hooks/usePersonal';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import type { Trabajador } from '@/types/models';

/**
 * Multi-select de trabajadores con autocompletado contra la nómina.
 *
 * Es el reemplazo del campo de texto libre del Excel: el supervisor no
 * escribe nombres, elige de la nómina. De aquí sale `tecnicosLaborando`
 * y una fila de Participacion por cada seleccionado.
 */
export function SelectorTrabajadores({
  seleccionados,
  onChange,
}: {
  seleccionados: Trabajador[];
  onChange: (trabajadores: Trabajador[]) => void;
}) {
  const [q, setQ] = useState('');
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const debouncedQ = useDebounce(q, SEARCH_DEBOUNCE_MS);

  const { data: empresas } = useEmpresas();
  const { data: resultados, isFetching } = useTrabajadores(
    debouncedQ,
    empresaId,
  );

  const idsSeleccionados = new Set(seleccionados.map((t) => t.id));
  const disponibles = (resultados ?? []).filter(
    (t) => !idsSeleccionados.has(t.id),
  );

  const agregar = (t: Trabajador) => onChange([...seleccionados, t]);
  const quitar = (id: number) =>
    onChange(seleccionados.filter((t) => t.id !== id));

  const hayBusqueda = debouncedQ.trim().length > 0 || empresaId !== null;

  return (
    <div className="space-y-3">
      {/* Buscador + filtro por empresa */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, apellido o DNI…"
            className="h-9 pl-9"
          />
          {isFetching && (
            <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
        <div className="w-56">
          <Select
            className="h-9"
            value={empresaId ?? ''}
            onChange={(e) =>
              setEmpresaId(e.target.value === '' ? null : Number(e.target.value))
            }
          >
            <option value="">Todas las contratistas</option>
            {(empresas ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Resultados del autocompletado */}
      {hayBusqueda && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          {disponibles.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {isFetching
                ? 'Buscando…'
                : 'Sin trabajadores disponibles para ese criterio.'}
            </p>
          )}
          {disponibles.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => agregar(t)}
              className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-0 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="font-medium text-foreground">
                  {t.apellidos}, {t.nombres}
                </span>
                <span className="ml-2 tabular-nums text-muted-foreground">
                  DNI {t.dni}
                </span>
                {t.empresa && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.empresa.nombre}
                  </span>
                )}
              </span>
              <UserPlusIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {!hayBusqueda && (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
          Escribe un nombre o DNI, o elige una contratista, para buscar
          personal.
        </p>
      )}

      {/* Seleccionados */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <UsersIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Personal presente
          </p>
          <Badge variant="secondary" className="tabular-nums">
            {seleccionados.length}
          </Badge>
          <span className="text-xs text-muted-foreground">
            → técnicos laborando
          </span>
        </div>

        {seleccionados.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no has agregado a nadie.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {seleccionados.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 py-1 pr-1 pl-2.5 text-sm"
              >
                <span className="font-medium">
                  {t.apellidos}, {t.nombres}
                </span>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {t.dni}
                </span>
                <button
                  type="button"
                  onClick={() => quitar(t.id)}
                  aria-label={`Quitar a ${t.nombres} ${t.apellidos}`}
                  className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <XIcon className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
