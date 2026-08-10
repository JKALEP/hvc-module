import { Link } from 'react-router-dom';
import {
  AlertTriangleIcon,
  AlertCircleIcon,
  InfoIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  type LucideIcon,
} from 'lucide-react';

import { EmptyState } from './EmptyState';
import { Badge } from '@/components/ui/badge';
import { ETIQUETAS_ALERTA, ETIQUETAS_SEVERIDAD } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Alerta, Severidad, RespuestaAlertas } from '@/types/models';

const ORDEN: Severidad[] = ['ALTA', 'MEDIA', 'BAJA'];

// Icono + color por severidad. El icono importa: el color no debe ser el
// único portador del significado.
const ESTILO: Record<
  Severidad,
  { icon: LucideIcon; borde: string; texto: string; badge: 'destructive' | 'warning' | 'secondary' }
> = {
  ALTA: {
    icon: AlertTriangleIcon,
    borde: 'border-l-red-600 dark:border-l-red-500',
    texto: 'text-red-600 dark:text-red-400',
    badge: 'destructive',
  },
  MEDIA: {
    icon: AlertCircleIcon,
    borde: 'border-l-amber-500',
    texto: 'text-amber-600 dark:text-amber-500',
    badge: 'warning',
  },
  BAJA: {
    icon: InfoIcon,
    borde: 'border-l-border',
    texto: 'text-muted-foreground',
    badge: 'secondary',
  },
};

/** Destino de navegación de la alerta, según a qué entidad apunte. */
function destino(a: Alerta): string | null {
  if (a.proyectoId !== undefined) return `/proyectos/${a.proyectoId}`;
  // Personal y empresas viven en la misma vista de indicadores.
  if (a.trabajadorId !== undefined || a.empresaId !== undefined)
    return '/personal';
  return null;
}

function FilaAlerta({ alerta }: { alerta: Alerta }) {
  const estilo = ESTILO[alerta.severidad];
  const Icono = estilo.icon;
  const to = destino(alerta);

  const contenido = (
    <div
      className={cn(
        'flex items-start gap-3 border-l-4 bg-card px-4 py-3 transition-colors',
        estilo.borde,
        to && 'group hover:bg-muted/40',
      )}
    >
      <Icono className={cn('mt-0.5 size-4 shrink-0', estilo.texto)} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{alerta.titulo}</span>
          <Badge variant="outline" className="font-normal">
            {ETIQUETAS_ALERTA[alerta.tipo]}
          </Badge>
        </div>
        <p className="text-sm whitespace-normal text-muted-foreground">
          {alerta.mensaje}
        </p>
      </div>
      {to && (
        <ArrowRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </div>
  );

  if (!to) return contenido;
  return (
    <Link
      to={to}
      className="block outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {contenido}
    </Link>
  );
}

/**
 * Alertas agrupadas por severidad, cada una con link al afectado.
 *
 * Si una regla no se pudo evaluar, se dice explícitamente: un tablero
 * vacío por falta de datos no debe leerse como "todo bien".
 */
export function ListaAlertas({ datos }: { datos: RespuestaAlertas }) {
  const grupos = ORDEN.map((severidad) => ({
    severidad,
    alertas: datos.alertas.filter((a) => a.severidad === severidad),
  })).filter((g) => g.alertas.length > 0);

  return (
    <div className="space-y-4">
      {/* Reglas que no se pudieron evaluar */}
      {datos.reglasOmitidas.map((r) => (
        <div
          key={r.tipo}
          className="flex items-start gap-3 rounded-lg border border-amber-600/25 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10"
        >
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              Una regla no se evaluó en este período
            </p>
            <p className="text-sm whitespace-normal text-muted-foreground">
              {r.motivo}
            </p>
          </div>
        </div>
      ))}

      {datos.alertas.length === 0 ? (
        <EmptyState
          icon={CheckCircle2Icon}
          title="Sin alertas en el período"
          description={
            datos.reglasOmitidas.length > 0
              ? 'Ojo: no todas las reglas se pudieron evaluar (ver aviso de arriba).'
              : 'Todos los indicadores están dentro de los umbrales configurados.'
          }
        />
      ) : (
        grupos.map((g) => (
          <section key={g.severidad} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={ESTILO[g.severidad].badge}>
                {ETIQUETAS_SEVERIDAD[g.severidad]}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {g.alertas.length} alerta(s)
              </span>
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {g.alertas.map((a) => (
                <FilaAlerta key={a.id} alerta={a} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
