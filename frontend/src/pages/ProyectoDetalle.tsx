import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  MapPinIcon,
  FolderKanbanIcon,
  UserCogIcon,
  ClipboardPlusIcon,
  XIcon,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { FiltroRango } from '@/components/shared/FiltroRango';
import { KpiCard } from '@/components/shared/KpiCard';
import { EstadoProyectoBadge } from '@/components/shared/EstadoProyectoBadge';
import { GraficoProduccionDiaria } from '@/components/shared/GraficoProduccionDiaria';
import { GraficoEquipos } from '@/components/shared/GraficoEquipos';
import { GraficoTecnicos } from '@/components/shared/GraficoTecnicos';
import { GraficoCumplimientoAcumulado } from '@/components/shared/GraficoCumplimientoAcumulado';
import { FormularioAjusteAvance } from '@/components/shared/FormularioAjusteAvance';
import { BitacoraProyecto } from '@/components/shared/BitacoraProyecto';
import { CruceProyecto } from '@/components/shared/CruceProyecto';
import {
  FormularioReporteDiario,
  type ControlFormularioReporte,
} from '@/components/shared/FormularioReporteDiario';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useResumenProyecto,
  useProduccionDiaria,
  useEquiposProyecto,
  useTecnicosProyecto,
  useCumplimientoAcumulado,
  useAjustes,
} from '@/hooks/useProyectoAnalitica';
import {
  formatPorcentaje,
  formatEntero,
  hoyISO,
  inicioDeMesISO,
  orDash,
} from '@/lib/format';
import type { Periodo } from '@/types/models';

function tonoProduccion(valor: number | null) {
  if (valor === null) return 'neutro' as const;
  if (valor >= 90) return 'bueno' as const;
  if (valor >= 70) return 'alerta' as const;
  return 'malo' as const;
}

export function ProyectoDetalle() {
  const { id } = useParams<{ id: string }>();
  const proyectoId = Number(id);
  const idValido = Number.isInteger(proyectoId) && proyectoId > 0;

  const [periodo, setPeriodo] = useState<Periodo>({
    desde: inicioDeMesISO(),
    hasta: hoyISO(),
  });
  const [formAbierto, setFormAbierto] = useState(false);
  const formulario = useRef<ControlFormularioReporte>(null);

  const {
    data: resumen,
    isLoading,
    isError,
    isFetching,
  } = useResumenProyecto(idValido ? proyectoId : null, periodo);
  const { data: produccion } = useProduccionDiaria(
    idValido ? proyectoId : null,
    periodo,
  );
  const { data: equipos } = useEquiposProyecto(
    idValido ? proyectoId : null,
    periodo,
  );
  const { data: tecnicos } = useTecnicosProyecto(
    idValido ? proyectoId : null,
    periodo,
  );
  const { data: cumplimiento } = useCumplimientoAcumulado(
    idValido ? proyectoId : null,
    periodo,
  );
  // Los ajustes no dependen del período: son eventos del proyecto.
  const { data: ajustes } = useAjustes(idValido ? proyectoId : null);

  if (!idValido) {
    return (
      <EmptyState
        icon={FolderKanbanIcon}
        title="Proyecto inválido"
        description="La dirección no corresponde a un proyecto."
      />
    );
  }

  const avance = resumen?.avanceAcumulado;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/proyectos"
          className="mb-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeftIcon className="size-4" />
          Volver a proyectos
        </Link>

        <PageHeader
          title={resumen?.proyecto.nombre ?? 'Proyecto'}
          description={
            resumen
              ? [orDash(resumen.proyecto.cliente), resumen.proyecto.ubicacion]
                  .filter(Boolean)
                  .join(' · ')
              : undefined
          }
          actions={
            resumen && (
              <div className="flex items-center gap-2">
                <EstadoProyectoBadge estado={resumen.proyecto.estado} />
                <Button
                  variant={formAbierto ? 'outline' : 'default'}
                  onClick={() => {
                    formulario.current?.limpiar();
                    setFormAbierto((v) => !v);
                  }}
                >
                  {formAbierto ? <XIcon /> : <ClipboardPlusIcon />}
                  {formAbierto ? 'Cerrar' : 'Registrar jornada'}
                </Button>
              </div>
            )
          }
        />
      </div>

      {/* Formulario inline: mismo componente que /reporte-diario, con el
          proyecto ya fijado. No se duplica ninguna validación. */}
      {formAbierto && (
        <Card>
          <CardContent>
            <FormularioReporteDiario
              proyectoFijo={proyectoId}
              control={formulario}
              onGuardado={() => setFormAbierto(false)}
              onCancelar={() => setFormAbierto(false)}
            />
          </CardContent>
        </Card>
      )}

      <FiltroRango
        desde={periodo.desde}
        hasta={periodo.hasta}
        onDesde={(desde) => setPeriodo((p) => ({ ...p, desde }))}
        onHasta={(hasta) => setPeriodo((p) => ({ ...p, hasta }))}
        actualizando={isFetching}
      />

      {isError && (
        <EmptyState
          icon={FolderKanbanIcon}
          title="No se pudo cargar el proyecto"
          description="Verifica que el backend esté corriendo y que el proyecto exista."
        />
      )}

      {isLoading && <TableSkeleton rows={4} cols={4} />}

      {!isLoading && !isError && resumen && avance && (
        <>
          {/* ── Tarjeta ejecutiva ── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Avance total"
              valor={formatPorcentaje(avance.porcentaje)}
              detalle={`${formatEntero(avance.equiposEjecutados)} de ${formatEntero(avance.equiposProgramados)} equipos · ${avance.reportes} jornadas · histórico completo`}
              tono={tonoProduccion(avance.porcentaje)}
            />
            <KpiCard
              label="Producción promedio"
              valor={formatPorcentaje(resumen.produccionPromedio)}
              detalle={`Media de los % diarios · ${resumen.diasConReporte} día(s) del período`}
              tono={tonoProduccion(resumen.produccionPromedio)}
            />
            <KpiCard
              label="Técnicos promedio"
              valor={
                resumen.tecnicosPromedioLaborando === null
                  ? '—'
                  : String(resumen.tecnicosPromedioLaborando)
              }
              detalle={`Programados: ${resumen.tecnicosPromedioProgramados ?? '—'}`}
            />
            <KpiCard
              label="Contratistas promedio"
              valor={
                resumen.contratistasPromedioTrabajando === null
                  ? '—'
                  : String(resumen.contratistasPromedioTrabajando)
              }
              detalle={`Programadas: ${resumen.contratistasPromedioProgramados ?? '—'} · empresas distintas por jornada`}
            />
          </div>

          {/* Ajuste manual vigente, si lo hay: siempre junto al calculado */}
          {resumen.ajusteManual && (
            <div className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-600/25 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  Hay un ajuste manual vigente:{' '}
                  {formatPorcentaje(resumen.ajusteManual.porcentaje)} (
                  {resumen.ajusteManual.desviacion !== null &&
                    `${resumen.ajusteManual.desviacion > 0 ? '+' : ''}${resumen.ajusteManual.desviacion} pts vs el calculado`}
                  )
                </p>
                <p className="text-sm whitespace-normal text-muted-foreground">
                  {resumen.ajusteManual.observacion}
                </p>
              </div>
            </div>
          )}

          {/* Supervisores y personal del período */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-5 py-3 text-sm">
            <span className="flex items-center gap-2">
              <UserCogIcon className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Supervisores:</span>
              <span className="font-medium text-foreground">
                {resumen.supervisores.length === 0
                  ? '—'
                  : resumen.supervisores
                      .map((s) => `${s.nombre} (${s.reportes})`)
                      .join(', ')}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">Personal distinto:</span>
              <span className="font-medium tabular-nums text-foreground">
                {resumen.personalDistinto}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">Contratistas:</span>
              <span className="font-medium tabular-nums text-foreground">
                {resumen.empresasDistintas}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">Participaciones:</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatEntero(resumen.participaciones)}
              </span>
            </span>
            {resumen.proyecto.ubicacion && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MapPinIcon className="size-4" />
                {resumen.proyecto.ubicacion}
              </span>
            )}
          </div>

          {/* ── Gráficos ── */}
          <div className="grid gap-4 xl:grid-cols-2">
            <GraficoProduccionDiaria datos={produccion ?? []} />
            <GraficoEquipos datos={equipos ?? []} />
            <GraficoTecnicos datos={tecnicos ?? []} />
            {cumplimiento && (
              <GraficoCumplimientoAcumulado datos={cumplimiento} />
            )}
          </div>

          {/* ── Ajuste manual (excepción) ── */}
          <FormularioAjusteAvance
            proyectoId={proyectoId}
            ajustes={ajustes ?? []}
            avanceCalculado={avance.porcentaje}
          />

          {/* ── Personal y contratistas de la obra ── */}
          <CruceProyecto proyectoId={proyectoId} periodo={periodo} />

          {/* ── Bitácora ── */}
          <BitacoraProyecto
            proyectoId={proyectoId}
            periodo={periodo}
            onEditar={(reporteId) => {
              setFormAbierto(true);
              void formulario.current?.abrirParaEditar(reporteId);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}
    </div>
  );
}
