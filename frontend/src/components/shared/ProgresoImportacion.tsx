import { cn } from '@/lib/utils';

// Muestra "completas/total" con una mini barra de progreso.
export function ProgresoImportacion({
  completas,
  total,
  className,
}: {
  completas: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? Math.round((completas / total) * 100) : 0;
  const done = total > 0 && completas === total;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            done ? 'bg-emerald-500' : 'bg-amber-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        {completas}/{total}
      </span>
    </div>
  );
}
