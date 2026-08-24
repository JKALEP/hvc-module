import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardListIcon,
  PlusIcon,
  ChevronRightIcon,
  MessageSquareWarningIcon,
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
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { EstadoBadge } from '@/modules/costos/components/Campo';
import { useRequerimientos } from '@/modules/costos/hooks/useRequerimientos';
import { esTurnoDe } from '@/modules/costos/lib/estados';
import { formatFechaCorta } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

type Grupo = 'pendientes' | 'finalizados';

/**
 * Mis requerimientos (§26).
 *
 * §26 agrupa en Pendientes y Finalizados, pero cada fila muestra el
 * estado ESPECÍFICO de §11: agrupar es cosa de la pantalla, y enseñar
 * solo «pendiente» dejaría al solicitante sin saber si le toca a él o
 * está esperando a otro.
 *
 * Lo que le toca a él se destaca con un borde: §26 pide que las
 * observaciones se vean, y §46 que la tarea de registrar el costo salte
 * a la vista. Es el mismo problema —«¿qué tengo que hacer?»— y se
 * resuelve igual.
 */
export function MisRequerimientos() {
  const navigate = useNavigate();
  const [grupo, setGrupo] = useState<Grupo>('pendientes');
  const { data, isError } = useRequerimientos(grupo);

  const cargando = !data && !isError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis requerimientos"
        description="Lo que has pedido y en qué punto está cada cosa."
        actions={
          <Button onClick={() => navigate('/costos/emitir')}>
            <PlusIcon />
            Emitir requerimiento
          </Button>
        }
      />

      {/* El conmutador de §26. */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {(['pendientes', 'finalizados'] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGrupo(g)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              grupo === g
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {g}
          </button>
        ))}
      </div>

      {cargando && <TableSkeleton rows={6} cols={5} />}

      {isError && (
        <EmptyState
          icon={ClipboardListIcon}
          title="No se pudieron cargar los requerimientos"
          description="Verifica que el backend esté corriendo en http://localhost:3000."
        />
      )}

      {data && data.length === 0 && (
        <EmptyState
          icon={ClipboardListIcon}
          title={
            grupo === 'pendientes'
              ? 'No tienes requerimientos en curso'
              : 'Todavía no hay requerimientos terminados'
          }
          description={
            grupo === 'pendientes'
              ? 'Cuando emitas uno, aparecerá aquí con su estado.'
              : 'Aquí se guardan los finalizados, los cancelados y los cerrados sin acuerdo.'
          }
          action={
            grupo === 'pendientes' && (
              <Button onClick={() => navigate('/costos/emitir')}>
                <PlusIcon />
                Emitir requerimiento
              </Button>
            )
          }
        />
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>N.º</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="text-right">Ítems</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => {
                const miTurno = esTurnoDe('SOLICITANTE', r.estado);
                return (
                  <TableRow
                    key={r.id}
                    className={cn(
                      'cursor-pointer',
                      miTurno &&
                        'border-l-2 border-l-warning bg-warning-soft/40 hover:bg-warning-soft/70',
                    )}
                    onClick={() => navigate(`/costos/requerimiento/${r.id}`)}
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
                      {formatFechaCorta(r.fechaEmision)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFechaCorta(r.fechaEntrega)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.items.length}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EstadoBadge estado={r.estado} />
                        {r.estado === 'OBSERVADO' &&
                          r._count.observaciones > 0 && (
                            <Badge variant="warning">
                              <MessageSquareWarningIcon />
                              {r._count.observaciones}
                            </Badge>
                          )}
                      </div>
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
