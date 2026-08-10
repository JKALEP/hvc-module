import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  MapPinIcon,
  UserCogIcon,
  UsersIcon,
} from 'lucide-react';

import { EstadoProyectoBadge } from './EstadoProyectoBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useResumenProyecto } from '@/hooks/useProyectoAnalitica';
import { formatPorcentaje, formatEntero, orDash } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Periodo, Proyecto } from '@/types/models';

/** Barra de avance acumulado. Es el número más importante de la tarjeta. */
function BarraAvance({ porcentaje }: { porcentaje: number | null }) {
  const valor = porcentaje ?? 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Avance total
        </span>
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {formatPorcentaje(porcentaje, 0)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-[var(--serie-programado)] transition-[width]"
          style={{ width: `${Math.min(Math.max(valor, 0), 100)}%` }}
        />
      </div>
      {porcentaje === null && (
        <p className="text-xs text-muted-foreground">
          Sin jornadas cargadas todavía.
        </p>
      )}
    </div>
  );
}

/** Un dato secundario de la tarjeta. */
function Dato({
  label,
  valor,
  tono,
}: {
  label: string;
  valor: string;
  tono?: 'bueno' | 'alerta' | 'malo';
}) {
  const color = tono
    ? {
        bueno: 'text-emerald-600 dark:text-emerald-400',
        alerta: 'text-amber-600 dark:text-amber-500',
        malo: 'text-red-600 dark:text-red-400',
      }[tono]
    : 'text-foreground';

  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-semibold tabular-nums', color)}>{valor}</p>
    </div>
  );
}

function tonoProduccion(valor: number | null) {
  if (valor === null) return undefined;
  if (valor >= 90) return 'bueno' as const;
  if (valor >= 70) return 'alerta' as const;
  return 'malo' as const;
}

/**
 * Tarjeta ejecutiva de un proyecto.
 *
 * El avance total es CALCULADO (Σ ejecutados / Σ programados de todo el
 * historial) y no depende del período; la producción sí, para que un mal
 * arranque de hace meses no manche la vista.
 */
export function TarjetaProyecto({
  proyecto,
  periodo,
}: {
  proyecto: Proyecto;
  periodo: Periodo;
}) {
  const { data, isLoading } = useResumenProyecto(proyecto.id, periodo);

  return (
    <Link
      to={`/proyectos/${proyecto.id}`}
      className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate font-semibold text-foreground">
            {proyecto.nombre}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {orDash(proyecto.cliente)}
          </p>
          {proyecto.ubicacion && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon className="size-3" />
              {proyecto.ubicacion}
            </p>
          )}
        </div>
        <EstadoProyectoBadge estado={proyecto.estado} />
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <>
          <BarraAvance porcentaje={data.avanceAcumulado.porcentaje} />

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3">
            <Dato
              label="Producción promedio"
              valor={formatPorcentaje(data.produccionPromedio)}
              tono={tonoProduccion(data.produccionPromedio)}
            />
            <Dato
              label="Contratistas prom."
              valor={
                data.contratistasPromedioTrabajando === null
                  ? '—'
                  : String(data.contratistasPromedioTrabajando)
              }
            />
            <Dato
              label="Equipos ejec./prog."
              valor={`${formatEntero(data.equiposEjecutados)} / ${formatEntero(data.equiposProgramados)}`}
            />
            <Dato
              label="Técnicos promedio"
              valor={
                data.tecnicosPromedioLaborando === null
                  ? '—'
                  : `${data.tecnicosPromedioLaborando} / ${data.tecnicosPromedioProgramados ?? '—'}`
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <UserCogIcon className="size-3.5" />
              {data.supervisores.length === 0
                ? 'Sin reportes'
                : data.supervisores.map((s) => s.nombre).join(', ')}
            </span>
            <span className="flex items-center gap-1">
              <UsersIcon className="size-3.5" />
              {data.personalDistinto} persona(s) · {data.diasConReporte} día(s)
            </span>
          </div>
        </>
      )}

      <span className="flex items-center gap-1 text-sm font-medium text-foreground">
        Ver detalle
        <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
