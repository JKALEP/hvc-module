import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

/** Un control del filtro con su etiqueta. */
export function CampoFiltro({
  label,
  ancho = 'w-56',
  children,
}: {
  label: string;
  ancho?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${ancho} space-y-1.5`}>
      <label className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Barra de filtros compartida por /personal, /proyectos y el detalle de
 * proyecto. El rango de fechas es fijo; los filtros extra (empresa,
 * proyecto, etc.) se pasan como children para que las tres vistas se vean
 * iguales sin obligarlas a tener los mismos campos.
 */
export function FiltroRango({
  desde,
  hasta,
  onDesde,
  onHasta,
  actualizando = false,
  encabezado,
  children,
}: {
  desde: string;
  hasta: string;
  onDesde: (valor: string) => void;
  onHasta: (valor: string) => void;
  actualizando?: boolean;
  /** Control que va antes de las fechas (p. ej. el conmutador de modo). */
  encabezado?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {encabezado}

      <CampoFiltro label="Desde" ancho="w-40">
        <Input
          type="date"
          value={desde}
          onChange={(e) => onDesde(e.target.value)}
          className="h-9"
        />
      </CampoFiltro>
      <CampoFiltro label="Hasta" ancho="w-40">
        <Input
          type="date"
          value={hasta}
          onChange={(e) => onHasta(e.target.value)}
          className="h-9"
        />
      </CampoFiltro>

      {children}

      {actualizando && (
        <span className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Actualizando…
        </span>
      )}
    </div>
  );
}
