import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  InboxIcon,
  ChevronRightIcon,
  MessageSquareWarningIcon,
  FileTextIcon,
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

type Pestana = 'atender' | 'esperando' | 'finalizados';

/**
 * La bandeja del Gestor de cotizaciones (§59).
 *
 * ── Por qué tres pestañas y no las dos de §26 ────────────────────────
 * El Solicitante solo necesita saber si algo suyo sigue vivo, y por eso
 * su pantalla parte en Pendientes / Finalizados. El Gestor tiene otro
 * problema: de todo lo que está vivo, ¿qué está esperando a ÉL? Un
 * requerimiento que acaba de salir a proveedores está pendiente, pero no
 * es suyo hasta que alguien responda, y mezclarlo con lo que sí le toca
 * convierte la bandeja en una lista donde hay que ir mirando estado por
 * estado.
 *
 * El corte es `esTurnoDe('GESTOR_COTIZACIONES', …)`, el mismo criterio
 * que resalta las filas de «Mis requerimientos». Se hace AQUÍ y no con
 * un filtro del servidor porque las dos primeras pestañas salen de la
 * misma consulta —`grupo=pendientes`—: pedirlas por separado serían dos
 * viajes para partir en dos una lista que ya está en memoria.
 *
 * Lo que se puede HACER con cada uno no lo decide esta pantalla: eso es
 * `acciones`, que llega del backend en el detalle.
 */
export function BandejaGestor() {
  const navigate = useNavigate();
  const [pestana, setPestana] = useState<Pestana>('atender');

  const finalizados = pestana === 'finalizados';
  const { data, isError } = useRequerimientos(
    finalizados ? 'finalizados' : 'pendientes',
  );

  const { atender, esperando } = useMemo(() => {
    const pendientes = data ?? [];
    return {
      atender: pendientes.filter((r) =>
        esTurnoDe('GESTOR_COTIZACIONES', r.estado),
      ),
      esperando: pendientes.filter(
        (r) => !esTurnoDe('GESTOR_COTIZACIONES', r.estado),
      ),
    };
  }, [data]);

  const filas: Requerimiento[] = finalizados
    ? (data ?? [])
    : pestana === 'atender'
      ? atender
      : esperando;

  const cargando = !data && !isError;

  const PESTANAS: { id: Pestana; etiqueta: string; cuenta?: number }[] = [
    { id: 'atender', etiqueta: 'Por atender', cuenta: atender.length },
    { id: 'esperando', etiqueta: 'En curso', cuenta: esperando.length },
    { id: 'finalizados', etiqueta: 'Finalizados' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bandeja de cotizaciones"
        description="Los requerimientos que pasan por tus manos, y en cuál estás parado."
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
            {/* La cuenta se calla mientras carga: un 0 provisional se lee
                como «no hay nada», que es una afirmación que aún no sabemos. */}
            {p.cuenta !== undefined && !cargando && (
              <Badge variant={p.id === 'atender' && p.cuenta > 0 ? 'warning' : 'secondary'}>
                {p.cuenta}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {cargando && <TableSkeleton rows={6} cols={6} />}

      {isError && (
        <EmptyState
          icon={InboxIcon}
          title="No se pudo cargar la bandeja"
          description="Verifica que el backend esté corriendo en http://localhost:3000."
        />
      )}

      {data && filas.length === 0 && (
        <EmptyState
          icon={pestana === 'atender' ? InboxIcon : FileTextIcon}
          title={
            pestana === 'atender'
              ? 'Nada pendiente por tu parte'
              : pestana === 'esperando'
                ? 'Nada en curso'
                : 'Todavía no hay requerimientos terminados'
          }
          description={
            pestana === 'atender'
              ? 'Cuando alguien emita un requerimiento o llegue una cotización, aparecerá aquí.'
              : pestana === 'esperando'
                ? 'Aquí se ven los que ya moviste y están esperando a un proveedor o al aprobador.'
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
                const miTurno = esTurnoDe('GESTOR_COTIZACIONES', r.estado);
                return (
                  <TableRow
                    key={r.id}
                    className={cn(
                      'cursor-pointer',
                      miTurno &&
                        !finalizados &&
                        'border-l-2 border-l-warning bg-warning-soft/40 hover:bg-warning-soft/70',
                    )}
                    onClick={() => navigate(`/costos/gestion/${String(r.id)}`)}
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
                        {r.estado === 'OBSERVADO' &&
                          r._count.observaciones > 0 && (
                            <Badge variant="outline">
                              <MessageSquareWarningIcon />
                              {r._count.observaciones}
                            </Badge>
                          )}
                      </div>
                      {!finalizados && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {tareaDe('GESTOR_COTIZACIONES', r.estado) ??
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
