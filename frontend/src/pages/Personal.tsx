import { useState } from 'react';
import {
  UsersIcon,
  UserCheckIcon,
  UserXIcon,
  GaugeIcon,
  ActivityIcon,
  CalendarDaysIcon,
  ListChecksIcon,
  BuildingIcon,
  TrendingDownIcon,
  UserCogIcon,
  BellIcon,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { KpiCard } from '@/components/shared/KpiCard';
import { FiltroRango, CampoFiltro } from '@/components/shared/FiltroRango';
import {
  FiltroRangoMeses,
  ConmutadorPeriodo,
  type ModoPeriodo,
} from '@/components/shared/FiltroRangoMeses';
import { TablaContratistasMensual } from '@/components/shared/TablaContratistasMensual';
import { TablaRankingMensual } from '@/components/shared/TablaRankingMensual';
import { TablaSupervisores } from '@/components/shared/TablaSupervisores';
import { GraficoUtilizacionMensual } from '@/components/shared/GraficoUtilizacionMensual';
import { ListaAlertas } from '@/components/shared/ListaAlertas';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { useIndicadoresPersonal } from '@/hooks/useIndicadoresPersonal';
import { useEmpresas, useProyectos } from '@/hooks/usePersonal';
import {
  useIndicadoresMensual,
  useComparacionSupervisores,
} from '@/hooks/useMensual';
import { useAlertas } from '@/hooks/useAlertas';
import {
  formatPorcentaje,
  formatEntero,
  hoyISO,
  inicioDeMesISO,
  mesActualISO,
  mesRelativoISO,
  finDeMes,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FiltrosPersonal } from '@/types/models';

const UMBRAL_UTILIZACION = 70;
type Pestana = 'contratistas' | 'trabajadores' | 'supervisores' | 'alertas';

function tonoPorcentaje(valor: number | null, umbral: number) {
  if (valor === null) return 'neutro' as const;
  if (valor >= umbral) return 'bueno' as const;
  if (valor >= umbral * 0.7) return 'alerta' as const;
  return 'malo' as const;
}

function badgePorcentaje(valor: number | null, umbral: number) {
  if (valor === null) return 'outline' as const;
  if (valor >= umbral) return 'success' as const;
  if (valor >= umbral * 0.7) return 'warning' as const;
  return 'destructive' as const;
}

function clase(valor: number | null, umbral: number) {
  if (valor === null) return 'text-muted-foreground';
  if (valor >= umbral) return 'text-emerald-600 dark:text-emerald-400';
  if (valor >= umbral * 0.7) return 'text-amber-600 dark:text-amber-500';
  return 'text-red-600 dark:text-red-400';
}

export function Personal() {
  const [modo, setModo] = useState<ModoPeriodo>('fechas');
  const [pestana, setPestana] = useState<Pestana>('contratistas');

  const [filtros, setFiltros] = useState<FiltrosPersonal>({
    desde: inicioDeMesISO(),
    hasta: hoyISO(),
    empresaId: null,
    proyectoId: null,
  });
  const [desdeMes, setDesdeMes] = useState(mesRelativoISO(2));
  const [hastaMes, setHastaMes] = useState(mesActualISO());

  const { data: empresas } = useEmpresas();
  const { data: proyectos } = useProyectos();

  const enMeses = modo === 'meses';
  const filtrosMensual = {
    desdeMes,
    hastaMes,
    empresaId: filtros.empresaId,
    proyectoId: filtros.proyectoId,
  };

  const porFechas = useIndicadoresPersonal(filtros);
  const porMeses = useIndicadoresMensual(filtrosMensual, enMeses);
  // Las alertas trabajan siempre con fechas. En modo Meses se derivan del
  // rango de meses para que la pestaña no cambie de semántica al conmutar.
  const periodoEfectivo = enMeses
    ? { desde: `${desdeMes}-01`, hasta: finDeMes(hastaMes) }
    : { desde: filtros.desde, hasta: filtros.hasta };

  const supervisores = useComparacionSupervisores(periodoEfectivo);
  const alertas = useAlertas(
    {
      ...periodoEfectivo,
      proyectoId: filtros.proyectoId,
      empresaId: filtros.empresaId,
    },
    pestana === 'alertas',
  );

  const cargando = enMeses ? porMeses.isLoading : porFechas.isLoading;
  const actualizando = enMeses ? porMeses.isFetching : porFechas.isFetching;
  const error = enMeses ? porMeses.isError : porFechas.isError;

  const set =
    <K extends keyof FiltrosPersonal>(campo: K) =>
    (valor: FiltrosPersonal[K]) =>
      setFiltros((f) => ({ ...f, [campo]: valor }));

  // Selectores comunes a los dos modos.
  const filtrosExtra = (
    <>
      <CampoFiltro label="Empresa contratista">
        <Select
          className="h-9"
          value={filtros.empresaId ?? ''}
          onChange={(e) =>
            set('empresaId')(
              e.target.value === '' ? null : Number(e.target.value),
            )
          }
        >
          <option value="">Todas</option>
          {(empresas ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </Select>
      </CampoFiltro>
      <CampoFiltro label="Proyecto">
        <Select
          className="h-9"
          value={filtros.proyectoId ?? ''}
          onChange={(e) =>
            set('proyectoId')(
              e.target.value === '' ? null : Number(e.target.value),
            )
          }
        >
          <option value="">Todos</option>
          {(proyectos ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
      </CampoFiltro>
    </>
  );

  const k = porFechas.data?.kpis;
  const km = porMeses.data?.kpis;
  const esRango = porMeses.data?.esRango ?? false;

  const PESTANAS: { id: Pestana; label: string; icon: typeof UsersIcon }[] = [
    { id: 'contratistas', label: 'Contratistas', icon: BuildingIcon },
    { id: 'trabajadores', label: 'Trabajadores', icon: UsersIcon },
    { id: 'supervisores', label: 'Supervisores', icon: UserCogIcon },
    { id: 'alertas', label: 'Alertas', icon: BellIcon },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal y contratistas"
        description="Indicadores de participación cruzando la nómina con los reportes diarios."
      />

      {/* Filtros: un solo control de período según el modo */}
      {enMeses ? (
        <FiltroRangoMeses
          desdeMes={desdeMes}
          hastaMes={hastaMes}
          onDesdeMes={setDesdeMes}
          onHastaMes={setHastaMes}
          actualizando={actualizando}
          encabezado={<ConmutadorPeriodo modo={modo} onModo={setModo} />}
        >
          {filtrosExtra}
        </FiltroRangoMeses>
      ) : (
        <FiltroRango
          desde={filtros.desde}
          hasta={filtros.hasta}
          onDesde={set('desde')}
          onHasta={set('hasta')}
          actualizando={actualizando}
          encabezado={<ConmutadorPeriodo modo={modo} onModo={setModo} />}
        >
          {filtrosExtra}
        </FiltroRango>
      )}

      {error && (
        <EmptyState
          icon={UsersIcon}
          title="No se pudieron cargar los indicadores"
          description="Verifica que el backend esté corriendo en http://localhost:3000."
        />
      )}

      {cargando && <TableSkeleton rows={6} cols={6} />}

      {/* ── KPIs: fuera de las pestañas, son el resumen de todo ── */}
      {!cargando && !error && !enMeses && k && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Personal contratado"
            valor={formatEntero(k.personalContratado)}
            detalle="Trabajadores activos en la nómina"
            icon={UsersIcon}
          />
          <KpiCard
            label="Personal que participó"
            valor={formatEntero(k.personalQueParticipo)}
            detalle={`De ${formatEntero(k.personalContratado)} contratados`}
            icon={UserCheckIcon}
          />
          <KpiCard
            label="Sin participación"
            valor={formatEntero(k.personalSinParticipacion)}
            detalle="No trabajaron ningún día del rango"
            icon={UserXIcon}
            tono={k.personalSinParticipacion > 0 ? 'alerta' : 'bueno'}
          />
          <KpiCard
            label="Días con reporte"
            valor={formatEntero(k.diasConReporte)}
            detalle="Días distintos con jornada cargada"
            icon={CalendarDaysIcon}
          />
          <KpiCard
            label="Utilización (cobertura)"
            valor={formatPorcentaje(k.utilizacionCobertura)}
            detalle={`${k.personalQueParticipo} de ${k.personalContratado} trabajadores`}
            icon={GaugeIcon}
            tono={tonoPorcentaje(k.utilizacionCobertura, UMBRAL_UTILIZACION)}
          />
          <KpiCard
            label="Utilización (intensidad)"
            valor={formatPorcentaje(k.utilizacionIntensidad)}
            detalle={`${formatEntero(k.participacionesRegistradas)} de ${formatEntero(k.capacidadDiasPersona)} días-persona`}
            icon={ActivityIcon}
            tono={tonoPorcentaje(k.utilizacionIntensidad, UMBRAL_UTILIZACION)}
          />
          <KpiCard
            label="Participaciones registradas"
            valor={formatEntero(k.participacionesRegistradas)}
            detalle="Un registro = un trabajador un día"
            icon={ListChecksIcon}
          />
          <KpiCard
            label="Promedio de participación"
            valor={
              k.promedioParticipacion === null
                ? '—'
                : `${k.promedioParticipacion.toFixed(1)} días`
            }
            detalle="Por trabajador que sí participó"
            icon={ActivityIcon}
          />
        </div>
      )}

      {/* KPIs del modo Meses: mismo formato, el pie absorbe la tendencia */}
      {!cargando && !error && enMeses && km && porMeses.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Personal contratado"
            valor={formatEntero(km.contratadoPromedio)}
            detalle={`Promedio mensual · ${km.contratadosDistintos} distintos en ${porMeses.data.meses.length} mes(es)`}
            icon={UsersIcon}
          />
          <KpiCard
            label="Personal que participó"
            valor={formatEntero(km.participoPromedio)}
            detalle={`Promedio mensual, de ${km.contratadoPromedio} contratados`}
            icon={UserCheckIcon}
          />
          <KpiCard
            label="Sin participación"
            valor={formatEntero(km.sinParticipacionPromedio)}
            detalle={
              km.peorMesSinParticipacion
                ? `Promedio mensual · peor mes: ${km.peorMesSinParticipacion.etiqueta} con ${km.peorMesSinParticipacion.valor}`
                : 'Promedio mensual'
            }
            icon={UserXIcon}
            tono={km.sinParticipacionPromedio > 0 ? 'alerta' : 'bueno'}
          />
          <KpiCard
            label="Días con reporte"
            valor={formatEntero(km.diasConReporteTotal)}
            detalle={`${porMeses.data.meses.length} mes(es) · ${km.diasConReportePromedio} días/mes`}
            icon={CalendarDaysIcon}
          />
          <KpiCard
            label="Utilización (cobertura)"
            valor={formatPorcentaje(km.utilizacionCoberturaMedia)}
            detalle={
              km.coberturaMin && km.coberturaMax
                ? `Media mensual · mín ${km.coberturaMin.valor}% (${km.coberturaMin.etiqueta}) · máx ${km.coberturaMax.valor}% (${km.coberturaMax.etiqueta})`
                : 'Media de las utilizaciones mensuales'
            }
            icon={GaugeIcon}
            tono={tonoPorcentaje(
              km.utilizacionCoberturaMedia,
              UMBRAL_UTILIZACION,
            )}
          />
          <KpiCard
            label="Utilización (intensidad)"
            valor={formatPorcentaje(km.utilizacionIntensidadMedia)}
            detalle={
              km.intensidadMin && km.intensidadMax
                ? `Media mensual · mín ${km.intensidadMin.valor}% (${km.intensidadMin.etiqueta}) · máx ${km.intensidadMax.valor}% (${km.intensidadMax.etiqueta})`
                : 'Media de las intensidades mensuales'
            }
            icon={ActivityIcon}
            tono={tonoPorcentaje(
              km.utilizacionIntensidadMedia,
              UMBRAL_UTILIZACION,
            )}
          />
          <KpiCard
            label="Participaciones registradas"
            valor={formatEntero(km.participacionesTotal)}
            detalle="Total del período · un registro = un trabajador un día"
            icon={ListChecksIcon}
          />
          <KpiCard
            label="Meses en el rango"
            valor={String(porMeses.data.meses.length)}
            detalle={
              porMeses.data.nomina.mesesSinNomina.length > 0
                ? `${porMeses.data.nomina.mesesSinNomina.length} sin planilla cargada`
                : 'Todos con planilla cargada'
            }
            icon={CalendarDaysIcon}
            tono={
              porMeses.data.nomina.mesesSinNomina.length > 0
                ? 'alerta'
                : 'bueno'
            }
          />
        </div>
      )}

      {/* ── Pestañas ── */}
      {!cargando && !error && (
        <>
          <div className="flex w-fit items-center gap-1 rounded-lg border border-border p-0.5">
            {PESTANAS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={pestana === id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPestana(id)}
              >
                <Icon />
                {label}
              </Button>
            ))}
          </div>

          {/* ── Contratistas ── */}
          {pestana === 'contratistas' &&
            (enMeses && porMeses.data ? (
              <div className="space-y-4">
                {esRango && (
                  <GraficoUtilizacionMensual
                    empresas={porMeses.data.porEmpresa}
                    metrica="cobertura"
                  />
                )}
                <TablaContratistasMensual
                  empresas={porMeses.data.porEmpresa}
                  meses={porMeses.data.meses}
                  filtros={filtrosMensual}
                  metrica="cobertura"
                  mesesSinNomina={porMeses.data.nomina.mesesSinNomina}
                />
              </div>
            ) : (
              porFechas.data && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    «Cobertura» es qué parte de la planilla se usó al menos un
                    día. «Intensidad» la mide contra todos los días del rango.
                    «Efectiva» la mide contra los días activos de las obras
                    donde esa contratista realmente estuvo — es la única que
                    compara de igual a igual una obra larga con una corta.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead>Empresa</TableHead>
                          <TableHead>RUC</TableHead>
                          <TableHead>Contratados</TableHead>
                          <TableHead>Participaron</TableHead>
                          <TableHead>Participaciones</TableHead>
                          <TableHead>Cobertura</TableHead>
                          <TableHead>Intensidad</TableHead>
                          <TableHead>Efectiva</TableHead>
                          <TableHead>Exposición</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {porFechas.data.porEmpresa.map((e) => (
                          <TableRow key={e.empresaId}>
                            <TableCell className="font-medium">
                              {e.empresa}
                            </TableCell>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {e.ruc}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {e.contratados}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {e.participaron}
                              {e.sinParticipacion > 0 && (
                                <span className="ml-1 text-amber-600 dark:text-amber-500">
                                  (−{e.sinParticipacion})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {formatEntero(e.participaciones)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={badgePorcentaje(
                                  e.utilizacionCobertura,
                                  UMBRAL_UTILIZACION,
                                )}
                                className="tabular-nums"
                              >
                                {formatPorcentaje(e.utilizacionCobertura)}
                              </Badge>
                            </TableCell>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {formatPorcentaje(e.utilizacionIntensidad)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  'font-medium tabular-nums',
                                  clase(
                                    e.utilizacionEfectiva,
                                    UMBRAL_UTILIZACION,
                                  ),
                                )}
                              >
                                {formatPorcentaje(e.utilizacionEfectiva)}
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-normal text-xs text-muted-foreground">
                              {e.diasExposicion} días ·{' '}
                              {e.proyectos.map((p) => p.nombre).join(', ') ||
                                '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )
            ))}

          {/* ── Trabajadores ── */}
          {pestana === 'trabajadores' &&
            (enMeses && porMeses.data ? (
              <TablaRankingMensual
                ranking={porMeses.data.ranking}
                meses={porMeses.data.meses}
                rango={{ desdeMes, hastaMes }}
                proyectoId={filtros.proyectoId}
              />
            ) : (
              porFechas.data && (
                <div className="space-y-6">
                  <section className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      El % se mide contra los días con reporte de los proyectos
                      donde cada trabajador participó. Por eso la columna «Base»
                      cambia entre filas: compara siempre días y base juntos.
                    </p>
                    <div className="overflow-hidden rounded-xl border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableHead>#</TableHead>
                            <TableHead>Trabajador</TableHead>
                            <TableHead>DNI</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Días trabajados</TableHead>
                            <TableHead>Base</TableHead>
                            <TableHead>% participación</TableHead>
                            <TableHead>Proyectos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {porFechas.data.ranking.map((t, i) => (
                            <TableRow key={t.trabajadorId}>
                              <TableCell className="tabular-nums text-muted-foreground">
                                {i + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                {t.apellidos}, {t.nombres}
                                {!t.enPlanilla && (
                                  <Badge variant="outline" className="ml-2">
                                    Fuera de planilla
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="tabular-nums text-muted-foreground">
                                {t.dni}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {t.empresa ?? '—'}
                              </TableCell>
                              <TableCell className="tabular-nums font-medium">
                                {t.diasTrabajados}
                              </TableCell>
                              <TableCell className="tabular-nums text-muted-foreground">
                                {t.diasBase}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={badgePorcentaje(
                                    t.porcentajeParticipacion,
                                    80,
                                  )}
                                  className="tabular-nums"
                                >
                                  {formatPorcentaje(t.porcentajeParticipacion)}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-normal text-muted-foreground">
                                {t.proyectos.map((p) => p.nombre).join(', ')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-foreground">
                      Personal con menor participación
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Aquí el % sí se mide contra todos los días con reporte,
                      para que las filas sean comparables entre sí.
                    </p>
                    {porFechas.data.menorParticipacion.length === 0 ? (
                      <EmptyState
                        icon={TrendingDownIcon}
                        title="No hay personal contratado en el filtro"
                      />
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead>Trabajador</TableHead>
                              <TableHead>DNI</TableHead>
                              <TableHead>Empresa</TableHead>
                              <TableHead>Días trabajados</TableHead>
                              <TableHead>Días con reporte</TableHead>
                              <TableHead>% del rango</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {porFechas.data.menorParticipacion.map((t) => (
                              <TableRow key={t.trabajadorId}>
                                <TableCell className="font-medium">
                                  {t.apellidos}, {t.nombres}
                                </TableCell>
                                <TableCell className="tabular-nums text-muted-foreground">
                                  {t.dni}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {t.empresa ?? '—'}
                                </TableCell>
                                <TableCell className="tabular-nums font-medium">
                                  {t.diasTrabajados === 0 ? (
                                    <span className="text-red-600 dark:text-red-400">
                                      0
                                    </span>
                                  ) : (
                                    t.diasTrabajados
                                  )}
                                </TableCell>
                                <TableCell className="tabular-nums text-muted-foreground">
                                  {t.diasConReporte}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={badgePorcentaje(
                                      t.porcentajeSobreRango,
                                      50,
                                    )}
                                    className="tabular-nums"
                                  >
                                    {formatPorcentaje(t.porcentajeSobreRango)}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </section>
                </div>
              )
            ))}

          {/* ── Supervisores ── */}
          {pestana === 'supervisores' && (
            <TablaSupervisores
              supervisores={supervisores.data ?? []}
              periodo={periodoEfectivo}
            />
          )}

          {/* ── Alertas ── */}
          {pestana === 'alertas' &&
            (alertas.isLoading || !alertas.data ? (
              <TableSkeleton rows={5} cols={3} />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Ordenadas por severidad. Los filtros de proyecto acotan las
                    alertas de obra; los de empresa, las de planilla.
                  </p>
                  <div className="flex gap-1.5">
                    <Badge variant="destructive">
                      {alertas.data.conteo.ALTA} alta(s)
                    </Badge>
                    <Badge variant="warning">
                      {alertas.data.conteo.MEDIA} media(s)
                    </Badge>
                    <Badge variant="secondary">
                      {alertas.data.conteo.BAJA} baja(s)
                    </Badge>
                  </div>
                </div>
                <ListaAlertas datos={alertas.data} />
              </div>
            ))}
        </>
      )}
    </div>
  );
}
