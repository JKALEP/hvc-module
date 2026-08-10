import { useState } from 'react';
import { ChevronRightIcon, UsersIcon, ArrowLeftRightIcon } from 'lucide-react';

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
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { formatPorcentaje } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MesEje, TrabajadorMensual, RangoMeses } from '@/types/models';

/** Respuesta de /trabajador/:id/mensual. */
interface DetalleTrabajadorMensual {
  trabajador: {
    id: number;
    dni: string;
    nombres: string;
    apellidos: string;
    sede: string | null;
    tipoTrabajador: string | null;
    empresa: { id: number; nombre: string; ruc: string };
  };
  cambioDeContrata: boolean;
  totalDias: number;
  porcentajeMedio: number | null;
  mesesSinActividad: number;
  detalle: {
    clave: string;
    etiqueta: string;
    dias: number;
    diasConReporte: number;
    porcentaje: number | null;
    empresasTrabajadas: { empresaId: number; nombre: string }[];
    empresaEnPlanilla: { empresaId: number; nombre: string } | null;
    remuneracion: number | null;
    moneda: string | null;
    proyectos: { proyectoId: number; nombre: string; dias: number }[];
  }[];
}

/**
 * Detalle mes a mes de un trabajador.
 *
 * No existía ninguna vista de detalle de trabajador en la app: esta fila
 * expandible la crea, dentro de /personal, sin abrir una ruta nueva.
 */
function DetalleTrabajador({
  trabajadorId,
  rango,
  proyectoId,
}: {
  trabajadorId: number;
  rango: RangoMeses;
  proyectoId: number | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['trabajador-mensual', trabajadorId, rango, proyectoId],
    queryFn: async () => {
      const { data } = await api.get<DetalleTrabajadorMensual>(
        `/trabajador/${trabajadorId}/mensual`,
        {
          params: {
            ...(rango.desdeMes ? { desdeMes: rango.desdeMes } : {}),
            ...(rango.hastaMes ? { hastaMes: rango.hastaMes } : {}),
            ...(proyectoId !== null ? { proyectoId } : {}),
          },
        },
      );
      return data;
    },
  });

  if (isLoading) {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Cargando detalle…
      </span>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          Empresa vigente:{' '}
          <span className="font-medium text-foreground">
            {data.trabajador.empresa.nombre}
          </span>
        </span>
        {data.trabajador.sede && (
          <span className="text-muted-foreground">
            Sede: <span className="text-foreground">{data.trabajador.sede}</span>
          </span>
        )}
        {data.trabajador.tipoTrabajador && (
          <span className="text-muted-foreground">
            Tipo:{' '}
            <span className="text-foreground">
              {data.trabajador.tipoTrabajador}
            </span>
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Mes</TableHead>
              <TableHead>Días</TableHead>
              <TableHead>% del mes</TableHead>
              <TableHead>Contratista (jornadas)</TableHead>
              <TableHead>Contratista (planilla)</TableHead>
              <TableHead>Remuneración</TableHead>
              <TableHead>Proyectos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.detalle.map((m) => (
              <TableRow key={m.clave}>
                <TableCell className="font-medium">{m.etiqueta}</TableCell>
                <TableCell
                  className={cn(
                    'tabular-nums',
                    m.dias === 0 && 'text-red-600 dark:text-red-400',
                  )}
                >
                  {m.dias} de {m.diasConReporte}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatPorcentaje(m.porcentaje)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {m.empresasTrabajadas.length === 0
                    ? '—'
                    : m.empresasTrabajadas.map((e) => e.nombre).join(', ')}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {m.empresaEnPlanilla?.nombre ?? (
                    <span className="text-xs">sin planilla cargada</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {m.remuneracion === null
                    ? '—'
                    : `${m.moneda ?? ''} ${m.remuneracion.toLocaleString('es-PE')}`.trim()}
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  {m.proyectos.length === 0
                    ? '—'
                    : m.proyectos
                        .map((p) => `${p.nombre} (${p.dias}d)`)
                        .join(', ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilaRankingMensual({
  trabajador,
  meses,
  rango,
  proyectoId,
}: {
  trabajador: TrabajadorMensual;
  meses: MesEje[];
  rango: RangoMeses;
  proyectoId: number | null;
}) {
  const [abierto, setAbierto] = useState(false);

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
        <TableCell className="font-medium">
          {trabajador.apellidos}, {trabajador.nombres}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {trabajador.dni}
        </TableCell>
        <TableCell className="whitespace-normal text-muted-foreground">
          {trabajador.empresas.map((e) => e.nombre).join(' → ')}
          {/* Prueba visible de que el snapshot histórico funciona. */}
          {trabajador.cambioDeContrata && (
            <Badge variant="warning" className="ml-2">
              <ArrowLeftRightIcon />
              Cambió de contrata
            </Badge>
          )}
        </TableCell>
        {trabajador.meses.map((m) => (
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
          {trabajador.totalDias}
        </TableCell>
        <TableCell className="tabular-nums">
          {formatPorcentaje(trabajador.porcentajeMedio)}
        </TableCell>
      </TableRow>

      {abierto && (
        <TableRow className="hover:bg-transparent">
          <TableCell
            colSpan={meses.length + 6}
            className="bg-muted/30 whitespace-normal"
          >
            <DetalleTrabajador
              trabajadorId={trabajador.trabajadorId}
              rango={rango}
              proyectoId={proyectoId}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * Ranking de trabajadores con días por mes.
 *
 * Es la misma tabla del modo "Fechas" con las columnas «Base» y
 * «Proyectos» cambiadas por una columna por mes. El «% medio» se mide
 * contra los días con reporte de cada mes (base común por columna), no
 * contra los días de los proyectos de cada persona: en una grilla mensual
 * se comparan meses entre sí y el denominador tiene que ser el mismo.
 */
export function TablaRankingMensual({
  ranking,
  meses,
  rango,
  proyectoId,
}: {
  ranking: TrabajadorMensual[];
  meses: MesEje[];
  rango: RangoMeses;
  proyectoId: number | null;
}) {
  if (ranking.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Sin participaciones en los meses seleccionados"
        description="Carga reportes diarios para ver el ranking."
      />
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Días trabajados por mes. Haz clic en una fila para ver el detalle de esa
        persona: contratista de cada mes, remuneración y proyectos. El «% medio»
        se mide contra los días con reporte de cada mes.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-8" />
              <TableHead>Trabajador</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Contratista</TableHead>
              {meses.map((m) => (
                <TableHead key={m.clave} className="text-center">
                  {m.etiqueta}
                </TableHead>
              ))}
              <TableHead>Total</TableHead>
              <TableHead>% medio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.map((t) => (
              <FilaRankingMensual
                key={t.trabajadorId}
                trabajador={t}
                meses={meses}
                rango={rango}
                proyectoId={proyectoId}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
