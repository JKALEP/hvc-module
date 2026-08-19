import { CalendarIcon, CopyPlusIcon, FilePlus2Icon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { MESES } from '@/modules/personal/lib/sctr';
import type { ResumenPeriodo } from '@/modules/personal/types';

/** Años ofrecidos: los que ya tienen datos, más el actual y el siguiente. */
function anosDisponibles(periodos: ResumenPeriodo[]): number[] {
  const actual = new Date().getFullYear();
  const set = new Set<number>([actual, actual + 1, actual - 1]);
  for (const p of periodos) set.add(p.anio);
  return [...set].sort((a, b) => b - a);
}

export function SelectorPeriodo({
  anio,
  mes,
  onAnio,
  onMes,
  periodos,
  actualizando,
}: {
  anio: number;
  mes: number;
  onAnio: (a: number) => void;
  onMes: (m: number) => void;
  periodos: ResumenPeriodo[];
  actualizando?: boolean;
}) {
  // Qué meses del año elegido ya tienen lista cargada: evita ir mes a
  // mes buscando dónde hay algo.
  const conDatos = new Set(
    periodos.filter((p) => p.anio === anio).map((p) => p.mes),
  );

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">
          Año
        </label>
        <Select
          className="h-9 w-28"
          value={anio}
          onChange={(e) => onAnio(Number(e.target.value))}
        >
          {anosDisponibles(periodos).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">
          Mes
        </label>
        <Select
          className="h-9 w-44"
          value={mes}
          onChange={(e) => onMes(Number(e.target.value))}
        >
          {MESES.map((nombre, i) => (
            <option key={nombre} value={i + 1}>
              {nombre}
              {conDatos.has(i + 1) ? ' ·' : ''}
            </option>
          ))}
        </Select>
      </div>

      <p className="pb-2 text-xs text-muted-foreground">
        Los meses con «·» ya tienen lista cargada.
      </p>

      {actualizando && (
        <span className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
          <Spinner className="size-3.5" />
          Actualizando…
        </span>
      )}
    </div>
  );
}

/**
 * Lo que se ve cuando el mes elegido todavía no existe.
 *
 * No es un error ni un estado vacío cualquiera: son las dos únicas
 * formas de empezar un mes, y copiar del anterior es la normal.
 */
export function PeriodoVacio({
  anio,
  mes,
  puedeCopiarDe,
  onCrear,
  onCopiar,
  ocupado,
}: {
  anio: number;
  mes: number;
  puedeCopiarDe: { anio: number; mes: number } | null;
  onCrear: () => void;
  onCopiar: () => void;
  ocupado: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <CalendarIcon className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground">
          No hay lista de {MESES[mes - 1]} {anio}
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">
          {puedeCopiarDe
            ? `Puedes partir de la lista de ${MESES[puedeCopiarDe.mes - 1]} ${puedeCopiarDe.anio} y corregir lo que haya cambiado, o empezar en blanco.`
            : 'Todavía no hay ninguna lista anterior de la que copiar. Empieza en blanco o importa un Excel.'}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {puedeCopiarDe && (
          <Button onClick={onCopiar} disabled={ocupado}>
            {ocupado ? <Spinner /> : <CopyPlusIcon />}
            Copiar de {MESES[puedeCopiarDe.mes - 1]} {puedeCopiarDe.anio}
          </Button>
        )}
        <Button variant="outline" onClick={onCrear} disabled={ocupado}>
          <FilePlus2Icon />
          Crear vacío
        </Button>
      </div>
    </div>
  );
}
