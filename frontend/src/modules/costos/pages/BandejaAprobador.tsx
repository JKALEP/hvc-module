import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GavelIcon,
  ChevronRightIcon,
  FileTextIcon,
  RotateCcwIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/shared/ui/table';
import { Badge } from '@/shared/ui/badge';
import { EstadoBadge } from '@/modules/costos/components/Campo';
import { useRequerimientos } from '@/modules/costos/hooks/useRequerimientos';
import { esTurnoDe, tareaDe } from '@/modules/costos/lib/estados';
import { formatFechaCorta, orDash } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { Requerimiento } from '@/modules/costos/types';

type Pestana = 'decidir' | 'esperando' | 'finalizados';

/**
 * La bandeja del Aprobador (§59).
 *
 * Mismo reparto que la del Gestor y por la misma razón: de todo lo que
 * está vivo, lo primero es saber qué está esperando a uno. Para este
 * rol el turno es un solo estado —PENDIENTE_APROBACION—, así que
 * «Por decidir» es una lista corta y esa es justamente la gracia.
 *
 * «En curso» no es relleno: §45 deja cerrar sin acuerdo desde antes de
 * que haya nada que aprobar, así que ahí hay requerimientos sobre los
 * que el Aprobador todavía puede actuar aunque no le toque el turno.
 *
 * El corte lo hace `esTurnoDe`, la misma tabla que usa el Solicitante y
 * el Gestor. Lo que se puede HACER con cada uno sigue saliendo de
 * `acciones`, que llega del backend en el detalle.
 */
export function BandejaAprobador() {
  const navigate = useNavigate();
  const [pestana, setPestana] = useState<Pestana>('decidir');

  const finalizados = pestana === 'finalizados';
  const { data, isError } = useRequerimientos(
    finalizados ? 'finalizados' : 'pendientes',
  );

  const { decidir, esperando } = useMemo(() => {
    const pendientes = data ?? [];
    return {
      decidir: pendientes.filter((r) => esTurnoDe('APROBADOR', r.estado)),
      esperando: pendientes.filter((r) => !esTurnoDe('APROBADOR', r.estado)),
    };
  }, [data]);

  const filas: Requerimiento[] = finalizados
    ? (data ?? [])
    : pestana === 'decidir'
      ? decidir
      : esperando;

  const cargando = !data && !isError;

  const PESTANAS: { id: Pestana; etiqueta: string; cuenta?: number }[] = [
    { id: 'decidir', etiqueta: 'Por decidir', cuenta: decidir.length },
    { id: 'esperando', etiqueta: 'En curso', cuenta: esperando.length },
    { id: 'finalizados', etiqueta: 'Finalizados' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprobaciones"
        description="Lo que está esperando tu decisión, y lo que todavía se está cocinando."
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              pestana === p.id
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.etiqueta}
            {/* Se calla mientras carga: un 0 provisional se lee como
                «no hay nada», y eso todavía no se sabe. */}
            {p.cuenta !== undefined && !cargando && (
              <Badge
                variant={
                  p.id === 'decidir' && p.cuenta > 0 ? 'warning' : 'secondary'
                }
              >
                {p.cuenta}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {cargando && <TableSkeleton rows={6} cols={6} />}

      {isError && (
        <EmptyState
          icon={GavelIcon}
          title="No se pudieron cargar las aprobaciones"
          description="Verifica que el backend esté corriendo en http://localhost:3000."
        />
      )}

      {data && filas.length === 0 && (
        <EmptyState
          icon={pestana === 'decidir' ? GavelIcon : FileTextIcon}
          title={
            pestana === 'decidir'
              ? 'Nada esperando tu decisión'
              : pestana === 'esperando'
                ? 'Nada en curso'
                : 'Todavía no hay requerimientos terminados'
          }
          description={
            pestana === 'decidir'
              ? 'Cuando el gestor recomiende una cotización, aparecerá aquí con su justificación.'
              : pestana === 'esperando'
                ? 'Los que están pidiendo o comparando precios. Todavía no hay nada que aprobar.'
                : 'Aquí se guardan los finalizados, los cancelados y los cerrados sin acuerdo.'
          }
        />
      )}

      {data && filas.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>N.º</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="text-right">Ítems</TableHead>
                <TableHead className="text-right">Cotiz.</TableHead>
                <TableHead className="min-w-56">Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((r) => {
                const miTurno = esTurnoDe('APROBADOR', r.estado);
                return (
                  <TableRow
                    key={r.id}
                    className={cn(
                      'cursor-pointer',
                      miTurno &&
                        !finalizados &&
                        'border-l-2 border-l-amber-500 bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-500/5 dark:hover:bg-amber-500/10',
                    )}
                    onClick={() => navigate(`/costos/decision/${String(r.id)}`)}
                  >
                    <TableCell className="font-medium tabular-nums text-foreground">
                      {r.numero ?? (
                        <span className="text-muted-foreground italic">
                          sin emitir
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{r.clienteNombre}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {orDash(r.solicitante?.nombre)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFechaCorta(r.fechaEntrega)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.items.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r._count.cotizaciones > 0 ? (
                        r._count.cotizaciones
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EstadoBadge estado={r.estado} />
                        {/* §44: ya volvió del aprobador una vez. Que se
                            note desde la lista, porque cambia cómo se
                            lee lo que viene. */}
                        {r.estado === 'RECHAZADO' && (
                          <Badge variant="outline">
                            <RotateCcwIcon />
                            devuelto
                          </Badge>
                        )}
                      </div>
                      {!finalizados && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {tareaDe('APROBADOR', r.estado) ??
                            'Esperando a otra persona.'}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <ChevronRightIcon className="size-4" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
