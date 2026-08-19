import { useState } from 'react';
import { UsersIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import {
  claseSiBaja,
  UMBRAL_PRODUCCION,
  UMBRAL_CALIFICACION,
  fechaCorta,
} from '@/modules/personal/lib/obra';
import { ALTO_FILA } from '@/modules/personal/lib/obra';
import type { Jornada } from '@/modules/personal/types';

/**
 * Toda celda calculada se distingue por FONDO, no por una leyenda que
 * haya que recordar. Es la regla de la especificación y se aplica en un
 * solo sitio para que ninguna fila se salga.
 */
const FONDO_CALCULADA = 'bg-muted/50';

function Celda({
  children,
  calculada,
  className,
}: {
  children: React.ReactNode;
  calculada?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        ALTO_FILA,
        'flex items-center justify-center border-b border-border px-1.5 text-sm tabular-nums',
        calculada && FONDO_CALCULADA,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Número editable: guarda al salir del foco, no en cada tecla. */
function CeldaNumero({
  valor,
  onGuardar,
}: {
  valor: number;
  onGuardar: (n: number) => void;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);
  const mostrado = borrador ?? String(valor);

  const confirmar = () => {
    if (borrador !== null && borrador !== String(valor)) {
      const n = Number(borrador);
      if (Number.isInteger(n) && n >= 0) onGuardar(n);
    }
    setBorrador(null);
  };

  return (
    <Celda>
      <input
        value={mostrado}
        inputMode="numeric"
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setBorrador(null);
            e.currentTarget.blur();
          }
        }}
        className="h-7 w-full rounded-md border border-transparent bg-transparent px-1 text-center outline-none hover:border-input focus:border-ring focus:bg-background focus:ring-3 focus:ring-ring/30"
      />
    </Celda>
  );
}

const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}%`);

/**
 * Una fecha de la obra: la columna entera de la grilla.
 *
 * Vive en su propio archivo porque es la pieza que más crece —diez
 * filas, tres de ellas editables y una que abre un selector— y mezclarla
 * con el armazón de la tabla era la vía directa a un componente de 600
 * líneas.
 */
export function ColumnaJornada({
  fecha,
  jornada,
  onNumero,
  onAbrirParticipantes,
  onAbrirPersonas,
}: {
  fecha: string;
  jornada?: Jornada;
  onNumero: (campo: 'equiposEjecutados' | 'equiposProgramados' | 'contratistasProgramados', valor: number) => void;
  onAbrirParticipantes: () => void;
  onAbrirPersonas: () => void;
}) {
  const j = jornada;

  return (
    <div className="w-28 shrink-0 border-r border-border">
      <div
        className={cn(
          ALTO_FILA,
          'flex items-center justify-center border-b border-border bg-muted/40 text-xs font-medium',
          !j && 'text-muted-foreground',
        )}
      >
        {fechaCorta(fecha)}
      </div>

      <CeldaNumero
        valor={j?.equiposEjecutados ?? 0}
        onGuardar={(n) => onNumero('equiposEjecutados', n)}
      />
      <CeldaNumero
        valor={j?.equiposProgramados ?? 0}
        onGuardar={(n) => onNumero('equiposProgramados', n)}
      />

      <Celda calculada className={claseSiBaja(j?.produccion ?? null, UMBRAL_PRODUCCION)}>
        {pct(j?.produccion ?? null)}
      </Celda>
      <Celda calculada>{j ? `${j.avanceAcumulado.toFixed(1)}%` : '—'}</Celda>

      <Celda>
        <button
          type="button"
          onClick={onAbrirPersonas}
          className="w-full truncate rounded px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          title={j?.supervisorNombre ?? 'Sin asignar'}
        >
          {j?.supervisorNombre ?? '—'}
        </button>
      </Celda>
      <Celda>
        <button
          type="button"
          onClick={onAbrirPersonas}
          className="w-full truncate rounded px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          title={j?.apoyoNombre ?? 'Sin asignar'}
        >
          {j?.apoyoNombre ?? '—'}
        </button>
      </Celda>

      <Celda>
        <button
          type="button"
          onClick={onAbrirParticipantes}
          className="flex h-7 w-full items-center justify-center gap-1 rounded-md border border-input text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <UsersIcon className="size-3.5" />
          {j?.asistencias.length ?? 0}
        </button>
      </Celda>

      <CeldaNumero
        valor={j?.contratistasProgramados ?? 0}
        onGuardar={(n) => onNumero('contratistasProgramados', n)}
      />
      <Celda calculada>{j?.contratistasTrabajando ?? 0}</Celda>
      <Celda
        calculada
        className={claseSiBaja(j?.calificacionProveedor ?? null, UMBRAL_CALIFICACION)}
      >
        {pct(j?.calificacionProveedor ?? null)}
      </Celda>
    </div>
  );
}
