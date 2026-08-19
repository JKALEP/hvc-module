import {
  ChevronRightIcon,
  FolderIcon,
  HomeIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Select } from '@/shared/ui/select';
import {
  ATRASO_LEVE,
  ATRASO_SEVERO,
  type FiltroEstado,
  type FiltroAtraso,
} from '@/modules/personal/lib/obra';
import type { CarpetaObra } from '@/modules/personal/types';

/** Migas de pan del explorador. Mismo patrón que el de Fotos. */
export function RutaCarpetas({
  camino,
  onIr,
}: {
  camino: { id: number; nombre: string }[];
  onIr: (carpetaId: number | null) => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-0.5 text-sm">
      <button
        type="button"
        onClick={() => onIr(null)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <HomeIcon className="size-4" />
        Proyectos
      </button>
      {camino.map((c, i) => (
        <span key={c.id} className="flex items-center gap-0.5">
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          {i === camino.length - 1 ? (
            <span className="px-2 py-1 font-medium text-foreground">
              {c.nombre}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onIr(c.id)}
              className="rounded-md px-2 py-1 text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {c.nombre}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Una carpeta, con lo que hay en TODO su subárbol, no solo debajo. */
export function TarjetaCarpeta({
  carpeta,
  onAbrir,
  onRenombrar,
  onEliminar,
}: {
  carpeta: CarpetaObra;
  onAbrir: (id: number) => void;
  onRenombrar: (carpeta: CarpetaObra) => void;
  onEliminar: (carpeta: CarpetaObra) => void;
}) {
  const partes = [
    carpeta.subcarpetas
      ? `${carpeta.subcarpetas} carpeta${carpeta.subcarpetas === 1 ? '' : 's'}`
      : null,
    `${carpeta.proyectos ?? 0} proyecto${carpeta.proyectos === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return (
    <div className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-ring/40">
      <button
        type="button"
        onClick={() => onAbrir(carpeta.id)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <FolderIcon className="size-8 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">
            {carpeta.nombre}
          </span>
          <span className="block text-xs text-muted-foreground">
            {partes.join(' · ')}
          </span>
        </span>
      </button>

      {/* En absoluto, no con opacity sobre el flujo: si ocupara sitio,
          el nombre de la carpeta quedaría aplastado. */}
      <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Renombrar ${carpeta.nombre}`}
          onClick={() => onRenombrar(carpeta)}
        >
          <PencilIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar ${carpeta.nombre}`}
          onClick={() => onEliminar(carpeta)}
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  );
}

/** Los dos filtros se combinan con Y, no se excluyen. */
export function FiltrosProyectos({
  estado,
  atraso,
  onEstado,
  onAtraso,
  total,
  visibles,
}: {
  estado: FiltroEstado;
  atraso: FiltroAtraso;
  onEstado: (e: FiltroEstado) => void;
  onAtraso: (a: FiltroAtraso) => void;
  total: number;
  visibles: number;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">
          Estado
        </label>
        <Select
          className="h-9 w-40"
          value={estado}
          onChange={(e) => onEstado(e.target.value as FiltroEstado)}
        >
          <option value="TODOS">Todos</option>
          <option value="INICIO">Inicio</option>
          <option value="EN_PROCESO">En proceso</option>
          <option value="FINALIZADO">Finalizado</option>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">
          Atraso
        </label>
        <Select
          className="h-9 w-52"
          value={atraso}
          onChange={(e) => onAtraso(e.target.value as FiltroAtraso)}
        >
          <option value="TODOS">Todos</option>
          <option value="ALGUNO">Con algún atraso</option>
          <option value="LEVE">{ATRASO_LEVE}+ días de atraso</option>
          <option value="SEVERO">{ATRASO_SEVERO}+ días de atraso</option>
        </Select>
      </div>

      {visibles !== total && (
        <p className="pb-2 text-xs text-muted-foreground tabular-nums">
          {visibles} de {total} proyecto(s)
        </p>
      )}
    </div>
  );
}
