import { Link } from 'react-router-dom';
import { ArrowRightIcon, MapPinIcon, BuildingIcon } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import {
  ETIQUETA_ESTADO,
  VARIANTE_ESTADO,
  etiquetaAtraso,
} from '@/modules/personal/lib/obra';
import type { ProyectoTarjeta } from '@/modules/personal/types';

/**
 * Tendencia del avance acumulado: una línea sin ejes ni números.
 *
 * Es deliberadamente ilegible como dato: su trabajo es decir «sube»,
 * «se estancó» o «no hay nada aún» de un vistazo. El número exacto está
 * al lado, en la barra y en el texto.
 */
function Tendencia({ valores }: { valores: number[] }) {
  if (valores.length < 2)
    return <div className="h-8" aria-hidden />;

  const ancho = 100;
  const alto = 28;
  const paso = ancho / (valores.length - 1);
  const puntos = valores
    .map((v, i) => `${(i * paso).toFixed(1)},${(alto - (v / 100) * alto).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="h-8 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={puntos}
        fill="none"
        stroke="var(--serie-ejecutado)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TarjetaProyecto({ proyecto }: { proyecto: ProyectoTarjeta }) {
  const atraso = etiquetaAtraso(proyecto.diasAtraso);

  return (
    <Link
      to={`/proyectos/${proyecto.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors outline-none hover:border-ring/40 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h3 className="truncate font-semibold text-foreground">
            {proyecto.nombre}
          </h3>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPinIcon className="size-3 shrink-0" />
            {proyecto.sede}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <BuildingIcon className="size-3 shrink-0" />
            {proyecto.encargadoNombre}
          </p>
        </div>
        <Badge variant={VARIANTE_ESTADO[proyecto.estado]}>
          {ETIQUETA_ESTADO[proyecto.estado]}
        </Badge>
      </div>

      <Tendencia valores={proyecto.tendencia} />

      <div className="space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              proyecto.avance >= 100
                ? 'bg-success'
                : 'bg-[var(--serie-ejecutado)]',
            )}
            style={{ width: `${Math.max(2, proyecto.avance)}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {proyecto.avance.toFixed(2)}%
          </span>
          <Badge variant={atraso.variante}>{atraso.texto}</Badge>
        </div>
      </div>

      <span className="flex items-center gap-1 text-sm font-medium text-foreground">
        Ver detalle
        <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
