import { useMemo, useState } from 'react';
import { PlusIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { ColumnaJornada } from './ColumnaJornada';
import {
  diasEntre,
  FILAS_GRILLA,
  ALTO_FILA,
} from '@/modules/personal/lib/obra';
import type { Jornada, ProyectoDetalle } from '@/modules/personal/types';

/**
 * Columnas de resumen, ancladas a la izquierda.
 *
 * Van fijas para que el avance total siga visible por muy a la derecha
 * que se haya llegado con el scroll: en una obra de cuatro meses son
 * 120 columnas de fecha.
 */
function ResumenFijo({ proyecto }: { proyecto: ProyectoDetalle }) {
  const datos = [
    { etiqueta: 'Sede', valor: proyecto.sede },
    { etiqueta: 'Avance total', valor: `${proyecto.avance.toFixed(2)}%`, fuerte: true },
    { etiqueta: 'Total de equipos', valor: String(proyecto.totalEquipos) },
  ];

  return (
    <div className="sticky left-0 z-10 flex shrink-0 bg-card">
      {/* Nombres de fila */}
      <div className="w-48 border-r border-border">
        <div
          className={cn(
            ALTO_FILA,
            'flex items-center border-b border-border bg-muted/40 px-3 text-xs font-medium',
          )}
        >
          Campo
        </div>
        {FILAS_GRILLA.map((f) => (
          <div
            key={f.clave}
            className={cn(
              ALTO_FILA,
              'flex items-center border-b border-border px-3 text-sm',
              !f.editable && 'bg-muted/50 text-muted-foreground',
            )}
          >
            {f.etiqueta}
          </div>
        ))}
      </div>

      {/* Resumen del proyecto: no depende de la fecha */}
      {datos.map((d) => (
        <div key={d.etiqueta} className="w-32 border-r border-border">
          <div
            className={cn(
              ALTO_FILA,
              'flex items-center justify-center border-b border-border bg-muted/40 px-2 text-center text-xs font-medium',
            )}
          >
            {d.etiqueta}
          </div>
          <div
            className={cn(
              'flex items-center justify-center border-b border-border px-2 text-center text-sm tabular-nums',
              d.fuerte && 'font-semibold',
            )}
            style={{ height: `calc(2.5rem * ${FILAS_GRILLA.length})` }}
          >
            {d.valor}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Registro diario en grilla TRANSPUESTA: filas = campos, columnas =
 * fechas.
 *
 * Las columnas se generan del cronograma (inicio → fin prevista) más
 * cualquier jornada que exista fuera de él, porque la fecha de fin es
 * prevista y no un límite. «Agregar día» extiende por el final.
 */
export function GrillaJornadas({
  proyecto,
  jornadas,
  onNumero,
  onAbrirParticipantes,
  onAbrirPersonas,
}: {
  proyecto: ProyectoDetalle;
  jornadas: Jornada[];
  onNumero: (
    fecha: string,
    campo: 'equiposEjecutados' | 'equiposProgramados' | 'contratistasProgramados',
    valor: number,
  ) => void;
  onAbrirParticipantes: (fecha: string) => void;
  onAbrirPersonas: (fecha: string) => void;
}) {
  const [extra, setExtra] = useState(0);

  const porFecha = useMemo(
    () => new Map(jornadas.map((j) => [j.fecha, j])),
    [jornadas],
  );

  const fechas = useMemo(() => {
    const delCronograma = diasEntre(
      proyecto.fechaInicio,
      proyecto.fechaFinPrevista,
    );
    // Una jornada registrada más allá del fin previsto no puede quedar
    // fuera de la grilla: se añade aunque el cronograma no la contemple.
    const todas = new Set([...delCronograma, ...jornadas.map((j) => j.fecha)]);

    const ordenadas = [...todas].sort();
    if (extra > 0) {
      const ultima = ordenadas[ordenadas.length - 1];
      const d = new Date(`${ultima}T00:00:00.000Z`);
      for (let i = 0; i < extra; i++) {
        d.setUTCDate(d.getUTCDate() + 1);
        ordenadas.push(d.toISOString().slice(0, 10));
      }
    }
    return ordenadas;
  }, [proyecto.fechaInicio, proyecto.fechaFinPrevista, jornadas, extra]);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-foreground">Registro diario</h2>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-3 rounded-sm bg-muted/50 ring-1 ring-border" />
            Celdas calculadas
          </span>
          <Button variant="outline" size="sm" onClick={() => setExtra((n) => n + 1)}>
            <PlusIcon />
            Agregar día
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="flex min-w-fit">
          <ResumenFijo proyecto={proyecto} />
          {fechas.map((f) => (
            <ColumnaJornada
              key={f}
              fecha={f}
              jornada={porFecha.get(f)}
              onNumero={(campo, valor) => onNumero(f, campo, valor)}
              onAbrirParticipantes={() => onAbrirParticipantes(f)}
              onAbrirPersonas={() => onAbrirPersonas(f)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
