import type { ReactNode } from 'react';
import { CalendarIcon, CalendarRangeIcon } from 'lucide-react';

import { CampoFiltro } from './FiltroRango';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export type ModoPeriodo = 'fechas' | 'meses';

/**
 * Conmutador de período: o rango de fechas, o rango de meses. Nunca los dos
 * a la vez.
 *
 * Dos selectores de período visibles simultáneamente serían dos controles
 * peleando por definir lo mismo, y nadie sabría cuál manda. El modo
 * "fechas" es el de siempre; "meses" habilita el desglose mes a mes.
 */
export function ConmutadorPeriodo({
  modo,
  onModo,
}: {
  modo: ModoPeriodo;
  onModo: (modo: ModoPeriodo) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
      <Button
        variant={modo === 'fechas' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onModo('fechas')}
      >
        <CalendarIcon />
        Fechas
      </Button>
      <Button
        variant={modo === 'meses' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onModo('meses')}
      >
        <CalendarRangeIcon />
        Meses
      </Button>
    </div>
  );
}

/**
 * Barra de filtros con rango de MESES. Hermana de FiltroRango: mismo
 * layout, mismos CampoFiltro, para que las vistas se vean iguales.
 *
 * Si ambos meses coinciden es una foto; si difieren, una tendencia.
 */
export function FiltroRangoMeses({
  desdeMes,
  hastaMes,
  onDesdeMes,
  onHastaMes,
  actualizando = false,
  encabezado,
  children,
}: {
  desdeMes: string; // "YYYY-MM"
  hastaMes: string;
  onDesdeMes: (valor: string) => void;
  onHastaMes: (valor: string) => void;
  actualizando?: boolean;
  encabezado?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {encabezado}

      <CampoFiltro label="Desde mes" ancho="w-40">
        <Input
          type="month"
          value={desdeMes}
          onChange={(e) => onDesdeMes(e.target.value)}
          className="h-9"
        />
      </CampoFiltro>
      <CampoFiltro label="Hasta mes" ancho="w-40">
        <Input
          type="month"
          value={hastaMes}
          onChange={(e) => onHastaMes(e.target.value)}
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
