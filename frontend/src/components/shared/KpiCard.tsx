import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

// Tarjeta de KPI: valor grande, etiqueta y un pie con el detalle del
// cálculo. El pie importa: sin él un porcentaje no se puede auditar.
export function KpiCard({
  label,
  valor,
  detalle,
  icon: Icon,
  tono = 'neutro',
}: {
  label: string;
  valor: string;
  detalle?: string;
  icon?: LucideIcon;
  tono?: 'neutro' | 'bueno' | 'alerta' | 'malo';
}) {
  const tonoValor = {
    neutro: 'text-foreground',
    bueno: 'text-emerald-600 dark:text-emerald-400',
    alerta: 'text-amber-600 dark:text-amber-500',
    malo: 'text-red-600 dark:text-red-400',
  }[tono];

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      </div>
      <p className={cn('text-2xl font-semibold tabular-nums', tonoValor)}>
        {valor}
      </p>
      {detalle && (
        <p className="text-xs text-muted-foreground">{detalle}</p>
      )}
    </div>
  );
}
