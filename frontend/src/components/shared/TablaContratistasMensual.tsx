import { useState } from 'react';
import { ChevronRightIcon, BuildingIcon, InfoIcon } from 'lucide-react';

import { EmptyState } from './EmptyState';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { useEmpresaMensual, type FiltrosMensual } from '@/hooks/useMensual';
import { formatPorcentaje } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { EmpresaMensual, MesEje } from '@/types/models';

const UMBRAL = 70;

/** Color de una celda de porcentaje según el umbral de utilización. */
function claseCelda(valor: number | null) {
  if (valor === null) return 'text-muted-foreground';
  if (valor >= UMBRAL) return 'text-emerald-600 dark:text-emerald-400';
  if (valor >= UMBRAL * 0.7) return 'text-amber-600 dark:text-amber-500';
  return 'text-red-600 dark:text-red-400';
}

/** Trabajadores de una contratista, con sus días por mes. */
function DetalleEmpresa({
  empresaId,
  filtros,
  meses,
}: {
  empresaId: number;
  filtros: FiltrosMensual;
  meses: MesEje[];
}) {
  const { data, isLoading } = useEmpresaMensual(empresaId, filtros, true);

  if (isLoading) {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Cargando trabajadores…
      </span>
    );
  }

  if (!data || data.trabajadores.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin trabajadores en el período.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Trabajadores ({data.trabajadores.length}) · días por mes
        </p>
        {!data.hayNomina && (
          <Badge variant="warning">Planilla del mes sin cargar</Badge>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Trabajador</TableHead>
              <TableHead>DNI</TableHead>
              {meses.map((m) => (
                <TableHead key={m.clave} className="text-center">
                  {m.etiqueta}
                </TableHead>
              ))}
              <TableHead>Total</TableHead>
              <TableHead>Meses sin actividad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.trabajadores.map((t) => (
              <TableRow key={t.trabajadorId}>
                <TableCell className="font-medium">
                  {t.apellidos}, {t.nombres}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {t.dni}
                </TableCell>
                {t.meses.map((m) => (
                  <TableCell
                    key={m.clave}
                    className={cn(
                      'text-center tabular-nums',
                      m.dias === 0 && 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {m.dias}
                  </TableCell>
                ))}
                <TableCell className="font-semibold tabular-nums">
                  {t.totalDias}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {t.mesesSinActividad}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilaEmpresaMensual({
  empresa,
  meses,
  filtros,
  metrica,
}: {
  empresa: EmpresaMensual;
  meses: MesEje[];
  filtros: FiltrosMensual;
  metrica: 'cobertura' | 'utilizacionEfectiva';
}) {
  const [abierto, setAbierto] = useState(false);
  const media =
    metrica === 'cobertura'
      ? empresa.coberturaMedia
      : empresa.utilizacionEfectivaMedia;

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <TableCell>
          <ChevronRightIcon
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              abierto && 'rotate-90',
            )}
          />
        </TableCell>
        <TableCell className="font-medium">{empresa.empresa}</TableCell>
        <TableCell className="tabular-nums">
          {empresa.contratadosPromedio}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {empresa.trabajadoresDistintos}
        </TableCell>
        {empresa.meses.map((m) => {
          const valor = m[metrica];
          return (
            <TableCell
              key={m.clave}
              className={cn('text-center tabular-nums', claseCelda(valor))}
              title={
                m.origen === 'PLANILLA_VIGENTE'
                  ? 'Estimado con la planilla actual: no hay nómina cargada de ese mes'
                  : undefined
              }
            >
              {valor === null ? '—' : `${valor}%`}
              {m.origen === 'PLANILLA_VIGENTE' && (
                <span className="text-muted-foreground">*</span>
              )}
            </TableCell>
          );
        })}
        <TableCell>
          <span className={cn('font-semibold tabular-nums', claseCelda(media))}>
            {formatPorcentaje(media)}
          </span>
        </TableCell>
      </TableRow>

      {abierto && (
        <TableRow className="hover:bg-transparent">
          <TableCell
            colSpan={meses.length + 5}
            className="bg-muted/30 whitespace-normal"
          >
            <DetalleEmpresa
              empresaId={empresa.empresaId}
              filtros={filtros}
              meses={meses}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * Utilización por contratista, mes a mes.
 *
 * Leída en fila es la tendencia de una empresa; leída en columna, la
 * comparación entre empresas en un mes. Es la misma tabla del modo
 * "Fechas", con las columnas de detalle del período cambiadas por una
 * columna por mes.
 */
export function TablaContratistasMensual({
  empresas,
  meses,
  filtros,
  metrica,
  mesesSinNomina,
}: {
  empresas: EmpresaMensual[];
  meses: MesEje[];
  filtros: FiltrosMensual;
  metrica: 'cobertura' | 'utilizacionEfectiva';
  mesesSinNomina: string[];
}) {
  if (empresas.length === 0) {
    return (
      <EmptyState
        icon={BuildingIcon}
        title="No hay contratistas activas"
        description="Carga la nómina por SQL para ver esta sección."
      />
    );
  }

  return (
    <div className="space-y-2">
      {mesesSinNomina.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-600/25 bg-amber-50 px-4 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <p className="text-sm whitespace-normal text-muted-foreground">
            Los meses marcados con <span className="font-medium">*</span> no
            tienen planilla cargada en <code>nomina_mensual</code>: el número de
            contratados se estimó con la planilla vigente, que puede no
            corresponder a ese mes. Meses afectados:{' '}
            <span className="font-medium text-foreground">
              {mesesSinNomina.join(', ')}
            </span>
            .
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-8" />
              <TableHead>Contratista</TableHead>
              <TableHead>Contratados prom.</TableHead>
              <TableHead>Distintos</TableHead>
              {meses.map((m) => (
                <TableHead key={m.clave} className="text-center">
                  {m.etiqueta}
                </TableHead>
              ))}
              <TableHead>Media</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.map((e) => (
              <FilaEmpresaMensual
                key={e.empresaId}
                empresa={e}
                meses={meses}
                filtros={filtros}
                metrica={metrica}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
