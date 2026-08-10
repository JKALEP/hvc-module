import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import {
  aMes,
  listarMeses,
  claveMes,
  etiquetaMes,
  rangoDeMeses,
  type Mes,
} from '../common/meses';

export interface FiltroMensualDto {
  desdeMes?: string; // "YYYY-MM"
  hastaMes?: string;
  empresaId?: number;
  proyectoId?: number;
}

/** De dónde salió el headcount de un mes. */
export type OrigenHeadcount = 'NOMINA_MENSUAL' | 'PLANILLA_VIGENTE';

// ── Formas devueltas por las consultas crudas ──
interface FilaParticipacionMes {
  anio: number;
  mes: number;
  empresaId: number;
  participaron: number;
  participaciones: number;
}
interface FilaDiasMes {
  anio: number;
  mes: number;
  dias: number;
}
interface FilaTrabajadorMes {
  anio: number;
  mes: number;
  trabajadorId: number;
  empresaId: number;
  dias: number;
}

const TOPE_MENOR_PARTICIPACION = 20;

/**
 * Indicadores de personal agrupados por MES.
 *
 * ── Por qué aquí sí hay SQL crudo (el primero del repo) ──
 * Lo que se necesita es COUNT(DISTINCT "trabajadorId") y
 * COUNT(DISTINCT fecha) por (año, mes, empresa). Es justo lo que SQL hace
 * bien y JavaScript hace mal: en memoria significa un Set por cada bucket
 * y traerse TODAS las participaciones del rango solo para clasificarlas.
 * Es el punto que quedó anotado en indicadores.service.ts como "el
 * reemplazo natural cuando la tabla crezca"; esta vista es la que la hace
 * crecer.
 *
 * No hay riesgo de zona horaria: `fecha` es @db.Date, sin componente de
 * hora, así que EXTRACT(MONTH FROM fecha) no puede correrse de mes. Todos
 * los parámetros van interpolados por Prisma.sql, nunca concatenados.
 */
@Injectable()
export class IndicadoresMensualService {
  constructor(private readonly prisma: PrismaService) {}

  private pct(numerador: number, denominador: number): number | null {
    if (denominador === 0) return null;
    return Number(((numerador / denominador) * 100).toFixed(2));
  }

  private media(valores: (number | null)[]): number | null {
    const validos = valores.filter((v): v is number => v !== null);
    if (validos.length === 0) return null;
    return Number(
      (validos.reduce((a, v) => a + v, 0) / validos.length).toFixed(2),
    );
  }

  /** "YYYY-MM-DD" para interpolar como ::date, sin ambigüedad horaria. */
  private aTextoFecha(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** Meses del filtro. Por defecto, el mes en curso. */
  private mesesDelFiltro(filtro: FiltroMensualDto): Mes[] {
    const hoy = new Date();
    const actual: Mes = {
      anio: hoy.getFullYear(),
      mes: hoy.getMonth() + 1,
    };
    const desde = filtro.desdeMes ? aMes(filtro.desdeMes, 'desdeMes') : actual;
    const hasta = filtro.hastaMes ? aMes(filtro.hastaMes, 'hastaMes') : desde;
    return listarMeses(desde, hasta);
  }

  // ── Consultas crudas ──

  private participacionesPorMesEmpresa(
    desde: string,
    hasta: string,
    empresaId?: number,
    proyectoId?: number,
  ) {
    return this.prisma.$queryRaw<FilaParticipacionMes[]>(Prisma.sql`
      SELECT
        EXTRACT(YEAR  FROM p.fecha)::int       AS anio,
        EXTRACT(MONTH FROM p.fecha)::int       AS mes,
        p."empresaId"                          AS "empresaId",
        COUNT(DISTINCT p."trabajadorId")::int  AS participaron,
        COUNT(*)::int                          AS participaciones
      FROM participaciones p
      WHERE p.fecha >= ${desde}::date
        AND p.fecha <= ${hasta}::date
        ${empresaId !== undefined ? Prisma.sql`AND p."empresaId" = ${empresaId}` : Prisma.empty}
        ${proyectoId !== undefined ? Prisma.sql`AND p."proyectoId" = ${proyectoId}` : Prisma.empty}
      GROUP BY 1, 2, p."empresaId"
    `);
  }

  private diasConReportePorMes(
    desde: string,
    hasta: string,
    proyectoId?: number,
  ) {
    return this.prisma.$queryRaw<FilaDiasMes[]>(Prisma.sql`
      SELECT
        EXTRACT(YEAR  FROM r.fecha)::int  AS anio,
        EXTRACT(MONTH FROM r.fecha)::int  AS mes,
        COUNT(DISTINCT r.fecha)::int      AS dias
      FROM reportes_diarios r
      WHERE r.fecha >= ${desde}::date
        AND r.fecha <= ${hasta}::date
        ${proyectoId !== undefined ? Prisma.sql`AND r."proyectoId" = ${proyectoId}` : Prisma.empty}
      GROUP BY 1, 2
    `);
  }

  /**
   * Días con reporte por (mes, proyecto), a nivel de fecha.
   * Se necesita el detalle de días —no el conteo— para poder unir los días
   * de varios proyectos sin contar dos veces una fecha compartida.
   */
  private diasPorMesProyecto(
    desde: string,
    hasta: string,
    proyectoId?: number,
  ) {
    return this.prisma.$queryRaw<
      { anio: number; mes: number; proyectoId: number; fecha: Date }[]
    >(Prisma.sql`
      SELECT DISTINCT
        EXTRACT(YEAR  FROM r.fecha)::int  AS anio,
        EXTRACT(MONTH FROM r.fecha)::int  AS mes,
        r."proyectoId"                    AS "proyectoId",
        r.fecha                           AS fecha
      FROM reportes_diarios r
      WHERE r.fecha >= ${desde}::date
        AND r.fecha <= ${hasta}::date
        ${proyectoId !== undefined ? Prisma.sql`AND r."proyectoId" = ${proyectoId}` : Prisma.empty}
    `);
  }

  /** Proyectos que tocó cada empresa, por mes. */
  private proyectosPorMesEmpresa(
    desde: string,
    hasta: string,
    empresaId?: number,
    proyectoId?: number,
  ) {
    return this.prisma.$queryRaw<
      { anio: number; mes: number; empresaId: number; proyectoId: number }[]
    >(Prisma.sql`
      SELECT DISTINCT
        EXTRACT(YEAR  FROM p.fecha)::int  AS anio,
        EXTRACT(MONTH FROM p.fecha)::int  AS mes,
        p."empresaId"                     AS "empresaId",
        p."proyectoId"                    AS "proyectoId"
      FROM participaciones p
      WHERE p.fecha >= ${desde}::date
        AND p.fecha <= ${hasta}::date
        ${empresaId !== undefined ? Prisma.sql`AND p."empresaId" = ${empresaId}` : Prisma.empty}
        ${proyectoId !== undefined ? Prisma.sql`AND p."proyectoId" = ${proyectoId}` : Prisma.empty}
    `);
  }

  /**
   * Días trabajados por (trabajador, mes, empresa del snapshot).
   * Si alguien cambió de contrata a mitad de mes habrá DOS filas para ese
   * mes: es correcto y es lo que permite detectar el cambio.
   */
  private diasPorTrabajadorMes(
    desde: string,
    hasta: string,
    empresaId?: number,
    proyectoId?: number,
    trabajadorId?: number,
  ) {
    return this.prisma.$queryRaw<FilaTrabajadorMes[]>(Prisma.sql`
      SELECT
        EXTRACT(YEAR  FROM p.fecha)::int  AS anio,
        EXTRACT(MONTH FROM p.fecha)::int  AS mes,
        p."trabajadorId"                  AS "trabajadorId",
        p."empresaId"                     AS "empresaId",
        COUNT(DISTINCT p.fecha)::int      AS dias
      FROM participaciones p
      WHERE p.fecha >= ${desde}::date
        AND p.fecha <= ${hasta}::date
        ${empresaId !== undefined ? Prisma.sql`AND p."empresaId" = ${empresaId}` : Prisma.empty}
        ${proyectoId !== undefined ? Prisma.sql`AND p."proyectoId" = ${proyectoId}` : Prisma.empty}
        ${trabajadorId !== undefined ? Prisma.sql`AND p."trabajadorId" = ${trabajadorId}` : Prisma.empty}
      GROUP BY 1, 2, p."trabajadorId", p."empresaId"
    `);
  }

  /**
   * Headcount contratado por mes y empresa.
   *
   * Sale de NominaMensual si el mes está cargado. Si no, cae al roster
   * vigente y lo MARCA: un número estimado etiquetado como estimado, nunca
   * disfrazado de dato. Sin esto la vista saldría vacía hasta cargar meses
   * de planilla hacia atrás.
   */
  private async headcountPorMes(meses: Mes[], empresaId?: number) {
    const dondeMeses = {
      OR: meses.map((m) => ({ anio: m.anio, mes: m.mes })),
    };

    const [nomina, mesesCargados, roster] = await Promise.all([
      this.prisma.nominaMensual.groupBy({
        by: ['anio', 'mes', 'empresaId'],
        where: {
          ...dondeMeses,
          ...(empresaId !== undefined ? { empresaId } : {}),
        },
        _count: { _all: true },
      }),
      // Sin filtro de empresa: "¿está cargada la planilla de ese mes?" es
      // una pregunta sobre el mes, no sobre una contratista.
      this.prisma.nominaMensual.groupBy({
        by: ['anio', 'mes'],
        where: dondeMeses,
        _count: { _all: true },
      }),
      this.prisma.trabajador.groupBy({
        by: ['empresaId'],
        where: {
          estado: 'ACTIVO',
          ...(empresaId !== undefined ? { empresaId } : {}),
        },
        _count: { _all: true },
      }),
    ]);

    const cargados = new Set(
      mesesCargados.map((m) => claveMes({ anio: m.anio, mes: m.mes })),
    );

    // clave "AAAA-MM|empresaId" -> contratados
    const contratados = new Map<string, number>();
    for (const n of nomina)
      contratados.set(
        `${claveMes({ anio: n.anio, mes: n.mes })}|${n.empresaId}`,
        n._count._all,
      );

    const rosterPorEmpresa = new Map(
      roster.map((r) => [r.empresaId, r._count._all]),
    );

    return {
      /** Contratados de una empresa en un mes, con su origen. */
      obtener(m: Mes, idEmpresa: number) {
        const clave = claveMes(m);
        if (cargados.has(clave)) {
          return {
            contratados: contratados.get(`${clave}|${idEmpresa}`) ?? 0,
            origen: 'NOMINA_MENSUAL' as OrigenHeadcount,
          };
        }
        return {
          contratados: rosterPorEmpresa.get(idEmpresa) ?? 0,
          origen: 'PLANILLA_VIGENTE' as OrigenHeadcount,
        };
      },
      mesesConNomina: [...cargados],
      mesesSinNomina: meses.map(claveMes).filter((c) => !cargados.has(c)),
      hayNomina: cargados.size > 0,
    };
  }

  // ── Endpoint principal ──

  /**
   * Indicadores de personal mes a mes.
   *
   * Nota sobre el "% del mes" del ranking: aquí se mide contra los días
   * con reporte DEL MES (base común), no contra los días de los proyectos
   * de cada trabajador como en /indicadores/personal. En una grilla
   * mensual se comparan meses entre sí, y para eso el denominador tiene
   * que ser el mismo para todas las filas de una columna.
   */
  async personal(filtro: FiltroMensualDto) {
    const meses = this.mesesDelFiltro(filtro);
    const rango = rangoDeMeses(meses);
    const desde = this.aTextoFecha(rango.desde);
    const hasta = this.aTextoFecha(rango.hasta);

    const [
      participaciones,
      diasReporte,
      porTrabajador,
      diasMesProyecto,
      proyectosMesEmpresa,
      empresas,
      headcount,
    ] = await Promise.all([
      this.participacionesPorMesEmpresa(
        desde,
        hasta,
        filtro.empresaId,
        filtro.proyectoId,
      ),
      this.diasConReportePorMes(desde, hasta, filtro.proyectoId),
      this.diasPorTrabajadorMes(
        desde,
        hasta,
        filtro.empresaId,
        filtro.proyectoId,
      ),
      this.diasPorMesProyecto(desde, hasta, filtro.proyectoId),
      this.proyectosPorMesEmpresa(
        desde,
        hasta,
        filtro.empresaId,
        filtro.proyectoId,
      ),
      this.prisma.empresaContratista.findMany({
        where: {
          estado: 'ACTIVO',
          ...(filtro.empresaId !== undefined ? { id: filtro.empresaId } : {}),
        },
        select: { id: true, nombre: true, ruc: true },
        orderBy: { nombre: 'asc' },
      }),
      this.headcountPorMes(meses, filtro.empresaId),
    ]);

    // Índices para acceso por (mes, empresa)
    const partPorClave = new Map(
      participaciones.map((p) => [
        `${claveMes({ anio: p.anio, mes: p.mes })}|${p.empresaId}`,
        p,
      ]),
    );
    const diasPorMes = new Map(
      diasReporte.map((d) => [claveMes({ anio: d.anio, mes: d.mes }), d.dias]),
    );

    // "mesClave|proyectoId" -> días con reporte de ese proyecto ese mes
    const diasDeProyectoEnMes = new Map<string, Set<string>>();
    for (const d of diasMesProyecto) {
      const k = `${claveMes({ anio: d.anio, mes: d.mes })}|${d.proyectoId}`;
      const set = diasDeProyectoEnMes.get(k) ?? new Set<string>();
      set.add(d.fecha.toISOString().slice(0, 10));
      diasDeProyectoEnMes.set(k, set);
    }

    // "mesClave|empresaId" -> proyectos que tocó esa empresa ese mes
    const proyectosDeEmpresaEnMes = new Map<string, Set<number>>();
    for (const p of proyectosMesEmpresa) {
      const k = `${claveMes({ anio: p.anio, mes: p.mes })}|${p.empresaId}`;
      const set = proyectosDeEmpresaEnMes.get(k) ?? new Set<number>();
      set.add(p.proyectoId);
      proyectosDeEmpresaEnMes.set(k, set);
    }

    // ── Serie por empresa ──
    const porEmpresa = empresas.map((e) => {
      const serie = meses.map((m) => {
        const clave = claveMes(m);
        const { contratados, origen } = headcount.obtener(m, e.id);
        const p = partPorClave.get(`${clave}|${e.id}`);
        const participaron = p?.participaron ?? 0;
        const participacionesMes = p?.participaciones ?? 0;
        const dias = diasPorMes.get(clave) ?? 0;

        // Exposición: unión de los días activos de las obras donde esta
        // empresa realmente estuvo ese mes. Es lo que permite comparar de
        // igual a igual una contratista de obra larga contra una corta.
        const diasExpuestos = new Set<string>();
        for (const proyectoId of proyectosDeEmpresaEnMes.get(
          `${clave}|${e.id}`,
        ) ?? []) {
          for (const d of diasDeProyectoEnMes.get(`${clave}|${proyectoId}`) ??
            [])
            diasExpuestos.add(d);
        }
        const diasExposicion = diasExpuestos.size;

        return {
          clave,
          etiqueta: etiquetaMes(m),
          contratados,
          participaron,
          sinParticipacion: Math.max(contratados - participaron, 0),
          participaciones: participacionesMes,
          cobertura: this.pct(participaron, contratados),
          intensidad: this.pct(participacionesMes, contratados * dias),
          // Normalizada por exposición real, no por el calendario del rango.
          utilizacionEfectiva: this.pct(
            participacionesMes,
            contratados * diasExposicion,
          ),
          diasExposicion,
          diasConReporte: dias,
          origen,
        };
      });

      const contratadosValidos = serie.map((s) => s.contratados);
      return {
        empresaId: e.id,
        empresa: e.nombre,
        ruc: e.ruc,
        contratadosPromedio: Number(
          (
            contratadosValidos.reduce((a, v) => a + v, 0) /
            (contratadosValidos.length || 1)
          ).toFixed(1),
        ),
        // Trabajadores distintos de esta empresa que participaron en TODO
        // el rango — no es la suma de los mensuales (hay repetidos).
        trabajadoresDistintos: new Set(
          porTrabajador
            .filter((t) => t.empresaId === e.id)
            .map((t) => t.trabajadorId),
        ).size,
        coberturaMedia: this.media(serie.map((s) => s.cobertura)),
        intensidadMedia: this.media(serie.map((s) => s.intensidad)),
        utilizacionEfectivaMedia: this.media(
          serie.map((s) => s.utilizacionEfectiva),
        ),
        participacionesTotal: serie.reduce((a, s) => a + s.participaciones, 0),
        meses: serie,
      };
    });

    // ── Ranking de trabajadores, mes a mes ──
    const idsTrabajadores = [
      ...new Set(porTrabajador.map((t) => t.trabajadorId)),
    ];
    const datosTrabajadores =
      idsTrabajadores.length > 0
        ? await this.prisma.trabajador.findMany({
            where: { id: { in: idsTrabajadores } },
            select: {
              id: true,
              dni: true,
              nombres: true,
              apellidos: true,
              estado: true,
            },
          })
        : [];
    const infoTrabajador = new Map(datosTrabajadores.map((t) => [t.id, t]));
    const nombreEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));

    // trabajadorId -> mesClave -> { dias, empresas }
    const acumTrabajador = new Map<
      number,
      { porMes: Map<string, number>; empresas: Set<number> }
    >();
    for (const fila of porTrabajador) {
      let acum = acumTrabajador.get(fila.trabajadorId);
      if (!acum) {
        acum = { porMes: new Map(), empresas: new Set() };
        acumTrabajador.set(fila.trabajadorId, acum);
      }
      const clave = claveMes({ anio: fila.anio, mes: fila.mes });
      // Se suman las filas del mismo mes: un cambio de contrata a mitad de
      // mes produce dos filas y los días son la suma de ambas.
      acum.porMes.set(clave, (acum.porMes.get(clave) ?? 0) + fila.dias);
      acum.empresas.add(fila.empresaId);
    }

    const ranking = [...acumTrabajador.entries()]
      .map(([trabajadorId, acum]) => {
        const t = infoTrabajador.get(trabajadorId);
        const serie = meses.map((m) => {
          const clave = claveMes(m);
          const dias = acum.porMes.get(clave) ?? 0;
          const base = diasPorMes.get(clave) ?? 0;
          return {
            clave,
            etiqueta: etiquetaMes(m),
            dias,
            diasConReporte: base,
            porcentaje: this.pct(dias, base),
          };
        });

        const listaEmpresas = [...acum.empresas].map((id) => ({
          empresaId: id,
          nombre: nombreEmpresa.get(id) ?? `Empresa ${id}`,
        }));

        return {
          trabajadorId,
          dni: t?.dni ?? '—',
          nombres: t?.nombres ?? '—',
          apellidos: t?.apellidos ?? '—',
          estado: t?.estado ?? null,
          empresas: listaEmpresas,
          // Prueba visible de que el snapshot histórico funciona.
          cambioDeContrata: listaEmpresas.length > 1,
          totalDias: serie.reduce((a, s) => a + s.dias, 0),
          porcentajeMedio: this.media(serie.map((s) => s.porcentaje)),
          meses: serie,
        };
      })
      .sort(
        (a, b) =>
          b.totalDias - a.totalDias || a.apellidos.localeCompare(b.apellidos),
      );

    // ── KPIs del rango ──
    const contratadosPorMes = meses.map((m) =>
      empresas.reduce((a, e) => a + headcount.obtener(m, e.id).contratados, 0),
    );
    const participaronPorMes = meses.map((m) => {
      const clave = claveMes(m);
      return empresas.reduce(
        (a, e) => a + (partPorClave.get(`${clave}|${e.id}`)?.participaron ?? 0),
        0,
      );
    });
    const participacionesPorMes = meses.map((m) => {
      const clave = claveMes(m);
      return empresas.reduce(
        (a, e) =>
          a + (partPorClave.get(`${clave}|${e.id}`)?.participaciones ?? 0),
        0,
      );
    });

    const coberturaPorMes = meses.map((_, i) =>
      this.pct(participaronPorMes[i], contratadosPorMes[i]),
    );
    const intensidadPorMes = meses.map((m, i) =>
      this.pct(
        participacionesPorMes[i],
        contratadosPorMes[i] * (diasPorMes.get(claveMes(m)) ?? 0),
      ),
    );

    /** Mes con el valor mínimo/máximo de una serie, para el pie del KPI. */
    const extremo = (
      valores: (number | null)[],
      modo: 'min' | 'max',
    ): { clave: string; etiqueta: string; valor: number } | null => {
      let mejor: { clave: string; etiqueta: string; valor: number } | null =
        null;
      valores.forEach((v, i) => {
        if (v === null) return;
        if (
          mejor === null ||
          (modo === 'min' ? v < mejor.valor : v > mejor.valor)
        ) {
          mejor = {
            clave: claveMes(meses[i]),
            etiqueta: etiquetaMes(meses[i]),
            valor: v,
          };
        }
      });
      return mejor;
    };

    const promedio = (valores: number[]) =>
      valores.length === 0
        ? 0
        : Number(
            (valores.reduce((a, v) => a + v, 0) / valores.length).toFixed(1),
          );

    const sinParticipacionPorMes = meses.map((_, i) =>
      Math.max(contratadosPorMes[i] - participaronPorMes[i], 0),
    );
    const diasTotales = meses.reduce(
      (a, m) => a + (diasPorMes.get(claveMes(m)) ?? 0),
      0,
    );

    // ── Personal con menor participación en TODO el rango ──
    const menorParticipacion = ranking
      .map((t) => ({
        trabajadorId: t.trabajadorId,
        dni: t.dni,
        nombres: t.nombres,
        apellidos: t.apellidos,
        empresas: t.empresas,
        totalDias: t.totalDias,
        mesesSinActividad: t.meses.filter((m) => m.dias === 0).length,
        porcentajeMedio: t.porcentajeMedio,
      }))
      .sort((a, b) => a.totalDias - b.totalDias)
      .slice(0, TOPE_MENOR_PARTICIPACION);

    return {
      meses: meses.map((m) => ({
        anio: m.anio,
        mes: m.mes,
        clave: claveMes(m),
        etiqueta: etiquetaMes(m),
      })),
      esRango: meses.length > 1,
      kpis: {
        contratadoPromedio: promedio(contratadosPorMes),
        // No es la suma de los mensuales: hay repetidos entre meses.
        contratadosDistintos: idsTrabajadores.length,
        participoPromedio: promedio(participaronPorMes),
        sinParticipacionPromedio: promedio(sinParticipacionPorMes),
        peorMesSinParticipacion: extremo(sinParticipacionPorMes, 'max'),
        diasConReporteTotal: diasTotales,
        diasConReportePromedio: promedio(
          meses.map((m) => diasPorMes.get(claveMes(m)) ?? 0),
        ),
        utilizacionCoberturaMedia: this.media(coberturaPorMes),
        coberturaMin: extremo(coberturaPorMes, 'min'),
        coberturaMax: extremo(coberturaPorMes, 'max'),
        utilizacionIntensidadMedia: this.media(intensidadPorMes),
        intensidadMin: extremo(intensidadPorMes, 'min'),
        intensidadMax: extremo(intensidadPorMes, 'max'),
        participacionesTotal: participacionesPorMes.reduce((a, v) => a + v, 0),
      },
      porEmpresa,
      ranking,
      menorParticipacion,
      nomina: {
        hayNomina: headcount.hayNomina,
        mesesConNomina: headcount.mesesConNomina,
        mesesSinNomina: headcount.mesesSinNomina,
      },
    };
  }

  // ── Detalle de una empresa (fila expandible) ──

  async empresa(empresaId: number, filtro: FiltroMensualDto) {
    const empresa = await this.prisma.empresaContratista.findUnique({
      where: { id: empresaId },
      select: { id: true, nombre: true, ruc: true, estado: true },
    });
    if (!empresa)
      throw new NotFoundException(`Empresa ${empresaId} no encontrada.`);

    const meses = this.mesesDelFiltro(filtro);
    const rango = rangoDeMeses(meses);
    const desde = this.aTextoFecha(rango.desde);
    const hasta = this.aTextoFecha(rango.hasta);

    const [porTrabajador, diasReporte, nomina] = await Promise.all([
      this.diasPorTrabajadorMes(desde, hasta, empresaId, filtro.proyectoId),
      this.diasConReportePorMes(desde, hasta, filtro.proyectoId),
      // Contratados de esta empresa mes a mes, con nombre del trabajador.
      this.prisma.nominaMensual.findMany({
        where: {
          empresaId,
          OR: meses.map((m) => ({ anio: m.anio, mes: m.mes })),
        },
        select: {
          anio: true,
          mes: true,
          trabajadorId: true,
          trabajador: {
            select: { id: true, dni: true, nombres: true, apellidos: true },
          },
        },
      }),
    ]);

    const diasPorMes = new Map(
      diasReporte.map((d) => [claveMes({ anio: d.anio, mes: d.mes }), d.dias]),
    );

    // Universo de trabajadores: los que participaron + los que estaban en
    // planilla aunque no participaran (esos son justo los que interesan).
    const idsParticiparon = new Set(porTrabajador.map((t) => t.trabajadorId));
    const idsEnNomina = new Set(nomina.map((n) => n.trabajadorId));
    const ids = [...new Set([...idsParticiparon, ...idsEnNomina])];

    // Si no hay nómina cargada, se cae al roster vigente de la empresa.
    const rosterVigente =
      idsEnNomina.size === 0
        ? await this.prisma.trabajador.findMany({
            where: { empresaId, estado: 'ACTIVO' },
            select: { id: true, dni: true, nombres: true, apellidos: true },
          })
        : [];
    for (const t of rosterVigente) if (!ids.includes(t.id)) ids.push(t.id);

    const datos = await this.prisma.trabajador.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        dni: true,
        nombres: true,
        apellidos: true,
        estado: true,
      },
    });
    const info = new Map(datos.map((t) => [t.id, t]));

    // trabajadorId -> mesClave -> días
    const acum = new Map<number, Map<string, number>>();
    for (const fila of porTrabajador) {
      let porMes = acum.get(fila.trabajadorId);
      if (!porMes) {
        porMes = new Map();
        acum.set(fila.trabajadorId, porMes);
      }
      const clave = claveMes({ anio: fila.anio, mes: fila.mes });
      porMes.set(clave, (porMes.get(clave) ?? 0) + fila.dias);
    }

    // trabajadorId -> meses en que estuvo en la planilla de esta empresa
    const enNomina = new Map<number, Set<string>>();
    for (const n of nomina) {
      const clave = claveMes({ anio: n.anio, mes: n.mes });
      const set = enNomina.get(n.trabajadorId) ?? new Set<string>();
      set.add(clave);
      enNomina.set(n.trabajadorId, set);
    }

    const trabajadores = ids
      .map((id) => {
        const t = info.get(id);
        const porMes = acum.get(id) ?? new Map<string, number>();
        const serie = meses.map((m) => {
          const clave = claveMes(m);
          const dias = porMes.get(clave) ?? 0;
          const base = diasPorMes.get(clave) ?? 0;
          return {
            clave,
            etiqueta: etiquetaMes(m),
            dias,
            diasConReporte: base,
            porcentaje: this.pct(dias, base),
            enPlanilla: enNomina.get(id)?.has(clave) ?? null,
          };
        });
        return {
          trabajadorId: id,
          dni: t?.dni ?? '—',
          nombres: t?.nombres ?? '—',
          apellidos: t?.apellidos ?? '—',
          estado: t?.estado ?? null,
          totalDias: serie.reduce((a, s) => a + s.dias, 0),
          porcentajeMedio: this.media(serie.map((s) => s.porcentaje)),
          mesesSinActividad: serie.filter((s) => s.dias === 0).length,
          meses: serie,
        };
      })
      .sort(
        (a, b) =>
          b.totalDias - a.totalDias || a.apellidos.localeCompare(b.apellidos),
      );

    return {
      empresa,
      meses: meses.map((m) => ({
        anio: m.anio,
        mes: m.mes,
        clave: claveMes(m),
        etiqueta: etiquetaMes(m),
      })),
      hayNomina: idsEnNomina.size > 0,
      trabajadores,
    };
  }

  // ── Detalle de un trabajador (fila expandible del ranking) ──

  async trabajador(trabajadorId: number, filtro: FiltroMensualDto) {
    const trabajador = await this.prisma.trabajador.findUnique({
      where: { id: trabajadorId },
      select: {
        id: true,
        dni: true,
        nombres: true,
        apellidos: true,
        estado: true,
        empresaId: true,
        sede: true,
        tipoTrabajador: true,
        empresa: { select: { id: true, nombre: true, ruc: true } },
      },
    });
    if (!trabajador)
      throw new NotFoundException(`Trabajador ${trabajadorId} no encontrado.`);

    const meses = this.mesesDelFiltro(filtro);
    const rango = rangoDeMeses(meses);
    const desde = this.aTextoFecha(rango.desde);
    const hasta = this.aTextoFecha(rango.hasta);

    const [porMesEmpresa, diasReporte, nomina, proyectos] = await Promise.all([
      this.diasPorTrabajadorMes(
        desde,
        hasta,
        undefined,
        filtro.proyectoId,
        trabajadorId,
      ),
      this.diasConReportePorMes(desde, hasta, filtro.proyectoId),
      this.prisma.nominaMensual.findMany({
        where: {
          trabajadorId,
          OR: meses.map((m) => ({ anio: m.anio, mes: m.mes })),
        },
        select: {
          anio: true,
          mes: true,
          empresaId: true,
          remuneracion: true,
          moneda: true,
          sede: true,
          empresa: { select: { id: true, nombre: true } },
        },
      }),
      // En qué proyectos estuvo, mes a mes.
      this.prisma.$queryRaw<
        { anio: number; mes: number; proyectoId: number; dias: number }[]
      >(Prisma.sql`
        SELECT
          EXTRACT(YEAR  FROM p.fecha)::int AS anio,
          EXTRACT(MONTH FROM p.fecha)::int AS mes,
          p."proyectoId"                   AS "proyectoId",
          COUNT(DISTINCT p.fecha)::int     AS dias
        FROM participaciones p
        WHERE p."trabajadorId" = ${trabajadorId}
          AND p.fecha >= ${desde}::date
          AND p.fecha <= ${hasta}::date
        GROUP BY 1, 2, p."proyectoId"
      `),
    ]);

    const nombresProyecto = new Map(
      (
        await this.prisma.proyecto.findMany({
          select: { id: true, nombre: true },
        })
      ).map((p) => [p.id, p.nombre]),
    );
    const nombresEmpresa = new Map(
      (
        await this.prisma.empresaContratista.findMany({
          select: { id: true, nombre: true },
        })
      ).map((e) => [e.id, e.nombre]),
    );

    const diasPorMes = new Map(
      diasReporte.map((d) => [claveMes({ anio: d.anio, mes: d.mes }), d.dias]),
    );
    const nominaPorMes = new Map(
      nomina.map((n) => [claveMes({ anio: n.anio, mes: n.mes }), n]),
    );

    const serie = meses.map((m) => {
      const clave = claveMes(m);
      const filas = porMesEmpresa.filter(
        (f) => claveMes({ anio: f.anio, mes: f.mes }) === clave,
      );
      const dias = filas.reduce((a, f) => a + f.dias, 0);
      const base = diasPorMes.get(clave) ?? 0;
      const n = nominaPorMes.get(clave);

      return {
        clave,
        etiqueta: etiquetaMes(m),
        dias,
        diasConReporte: base,
        porcentaje: this.pct(dias, base),
        // Empresa(s) según el snapshot de las participaciones de ese mes.
        empresasTrabajadas: [...new Set(filas.map((f) => f.empresaId))].map(
          (id) => ({
            empresaId: id,
            nombre: nombresEmpresa.get(id) ?? `Empresa ${id}`,
          }),
        ),
        // Empresa según la planilla de ese mes (null si no está cargada).
        empresaEnPlanilla: n
          ? { empresaId: n.empresaId, nombre: n.empresa.nombre }
          : null,
        remuneracion: n?.remuneracion
          ? Number(n.remuneracion.toString())
          : null,
        moneda: n?.moneda ?? null,
        sede: n?.sede ?? null,
        proyectos: proyectos
          .filter((p) => claveMes({ anio: p.anio, mes: p.mes }) === clave)
          .map((p) => ({
            proyectoId: p.proyectoId,
            nombre:
              nombresProyecto.get(p.proyectoId) ?? `Proyecto ${p.proyectoId}`,
            dias: p.dias,
          })),
      };
    });

    const empresasDelRango = new Set(
      serie.flatMap((s) => s.empresasTrabajadas.map((e) => e.empresaId)),
    );

    return {
      trabajador,
      meses: meses.map((m) => ({
        anio: m.anio,
        mes: m.mes,
        clave: claveMes(m),
        etiqueta: etiquetaMes(m),
      })),
      cambioDeContrata: empresasDelRango.size > 1,
      totalDias: serie.reduce((a, s) => a + s.dias, 0),
      porcentajeMedio: this.media(serie.map((s) => s.porcentaje)),
      mesesSinActividad: serie.filter((s) => s.dias === 0).length,
      // `meses` es el eje; `detalle` es el dato de cada mes.
      detalle: serie,
    };
  }
}
