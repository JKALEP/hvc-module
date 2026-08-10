import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { aFechaUTC, claveDia, rangoDeFechas } from '../common/fechas';

export interface FiltroIndicadoresDto {
  desde?: string;
  hasta?: string;
  empresaId?: number;
  proyectoId?: number;
  // Tope de filas de "menor participación". Las alertas necesitan la
  // lista completa: si se trunca, ocultarían trabajadores en silencio.
  tope?: number;
}

// Cuántas filas devolver en "personal con menor participación".
const TOPE_MENOR_PARTICIPACION = 20;

@Injectable()
export class IndicadoresService {
  constructor(private readonly prisma: PrismaService) {}

  /** Porcentaje con 2 decimales. Devuelve null si el denominador es 0. */
  private pct(numerador: number, denominador: number): number | null {
    if (denominador === 0) return null;
    return Number(((numerador / denominador) * 100).toFixed(2));
  }

  /**
   * Indicadores de participación de personal en un rango de fechas.
   *
   * Definiciones acordadas:
   * - utilizacionCobertura  = trabajadores que participaron / trabajadores
   *                           contratados (¿qué parte de la planilla se usó?)
   * - utilizacionIntensidad = participaciones / (contratados × días con
   *                           reporte) (¿con qué intensidad se usó?)
   * - Ranking: el % de cada trabajador se mide contra los días con reporte
   *   de LOS PROYECTOS en los que ese trabajador participó, no contra todo
   *   el rango. Por eso cada fila expone su propio `diasBase` y `proyectos`:
   *   sin ese contexto los porcentajes no son comparables entre sí.
   *
   * La agregación se hace en memoria a partir de una sola lectura de
   * participaciones. A los volúmenes actuales (miles de filas por mes) es
   * más simple y legible que N consultas agregadas; si la tabla crece mucho
   * el reemplazo natural es $queryRaw con COUNT(DISTINCT fecha).
   */
  async personal(filtro: FiltroIndicadoresDto) {
    const desde = filtro.desde ? aFechaUTC(filtro.desde, 'desde') : undefined;
    const hasta = filtro.hasta ? aFechaUTC(filtro.hasta, 'hasta') : undefined;
    const rangoFecha = rangoDeFechas(filtro.desde, filtro.hasta);

    const filtroProyecto =
      filtro.proyectoId !== undefined ? { proyectoId: filtro.proyectoId } : {};

    const whereParticipacion = {
      ...(rangoFecha ? { fecha: rangoFecha } : {}),
      ...(filtro.empresaId !== undefined
        ? { empresaId: filtro.empresaId }
        : {}),
      ...filtroProyecto,
    };

    const whereReporte = {
      ...(rangoFecha ? { fecha: rangoFecha } : {}),
      ...filtroProyecto,
    };

    const [participaciones, reportes, planilla, empresas, proyectos] =
      await Promise.all([
        this.prisma.participacion.findMany({
          where: whereParticipacion,
          select: {
            trabajadorId: true,
            empresaId: true,
            proyectoId: true,
            fecha: true,
          },
        }),
        this.prisma.reporteDiario.findMany({
          where: whereReporte,
          select: { fecha: true, proyectoId: true },
        }),
        // "Contratados" = planilla vigente. El filtro de proyecto NO la
        // recorta: un trabajador puede estar contratado y no haber sido
        // asignado nunca a ese proyecto — justamente lo que queremos medir.
        this.prisma.trabajador.findMany({
          where: {
            estado: 'ACTIVO',
            ...(filtro.empresaId !== undefined
              ? { empresaId: filtro.empresaId }
              : {}),
          },
          select: {
            id: true,
            dni: true,
            nombres: true,
            apellidos: true,
            empresaId: true,
          },
        }),
        this.prisma.empresaContratista.findMany({
          where: {
            estado: 'ACTIVO',
            ...(filtro.empresaId !== undefined ? { id: filtro.empresaId } : {}),
          },
          select: { id: true, nombre: true, ruc: true },
        }),
        this.prisma.proyecto.findMany({
          select: { id: true, nombre: true },
        }),
      ]);

    const nombreProyecto = new Map(proyectos.map((p) => [p.id, p.nombre]));

    // ── Días con reporte: global y por proyecto ──
    const diasGlobal = new Set<string>();
    const diasPorProyecto = new Map<number, Set<string>>();
    for (const r of reportes) {
      const dia = claveDia(r.fecha);
      diasGlobal.add(dia);
      let set = diasPorProyecto.get(r.proyectoId);
      if (!set) {
        set = new Set<string>();
        diasPorProyecto.set(r.proyectoId, set);
      }
      set.add(dia);
    }
    const diasConReporte = diasGlobal.size;

    // ── Agregación por trabajador ──
    interface AcumTrabajador {
      dias: Set<string>;
      proyectos: Set<number>;
      empresaId: number;
    }
    const porTrabajador = new Map<number, AcumTrabajador>();
    for (const p of participaciones) {
      let acum = porTrabajador.get(p.trabajadorId);
      if (!acum) {
        acum = {
          dias: new Set<string>(),
          proyectos: new Set<number>(),
          empresaId: p.empresaId,
        };
        porTrabajador.set(p.trabajadorId, acum);
      }
      acum.dias.add(claveDia(p.fecha));
      acum.proyectos.add(p.proyectoId);
    }

    // ── KPIs ──
    const personalContratado = planilla.length;
    // Se cuenta solo sobre la planilla vigente para que
    // contratado = participó + sin participación siempre cuadre.
    const enPlanillaQueParticipo = planilla.filter((t) =>
      porTrabajador.has(t.id),
    ).length;
    const personalSinParticipacion =
      personalContratado - enPlanillaQueParticipo;
    const participacionesRegistradas = participaciones.length;
    const capacidad = personalContratado * diasConReporte;

    const kpis = {
      personalContratado,
      personalQueParticipo: enPlanillaQueParticipo,
      personalSinParticipacion,
      participacionesRegistradas,
      diasConReporte,
      // ¿Qué parte de la planilla se usó al menos un día?
      utilizacionCobertura: this.pct(
        enPlanillaQueParticipo,
        personalContratado,
      ),
      // ¿Qué parte de la capacidad total (personas × días) se usó?
      utilizacionIntensidad: this.pct(participacionesRegistradas, capacidad),
      capacidadDiasPersona: capacidad,
      // Días promedio trabajados por quien sí participó.
      promedioParticipacion:
        enPlanillaQueParticipo === 0
          ? null
          : Number(
              (participacionesRegistradas / enPlanillaQueParticipo).toFixed(2),
            ),
    };

    // ── Ranking de trabajadores ──
    const infoPlanilla = new Map(planilla.map((t) => [t.id, t]));
    const nombreEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));

    // Trabajadores que participaron pero ya no están en la planilla vigente
    // (baja posterior). Se necesitan sus datos para nombrarlos en el ranking.
    const idsFueraDePlanilla = [...porTrabajador.keys()].filter(
      (id) => !infoPlanilla.has(id),
    );
    const fueraDePlanilla =
      idsFueraDePlanilla.length > 0
        ? await this.prisma.trabajador.findMany({
            where: { id: { in: idsFueraDePlanilla } },
            select: {
              id: true,
              dni: true,
              nombres: true,
              apellidos: true,
              empresaId: true,
              estado: true,
            },
          })
        : [];
    const infoFuera = new Map(fueraDePlanilla.map((t) => [t.id, t]));

    const ranking = [...porTrabajador.entries()]
      .map(([trabajadorId, acum]) => {
        const t = infoPlanilla.get(trabajadorId) ?? infoFuera.get(trabajadorId);
        const diasTrabajados = acum.dias.size;

        // Base = días con reporte de los proyectos donde este trabajador
        // participó. Se unen para no contar dos veces un día compartido.
        const base = new Set<string>();
        for (const proyectoId of acum.proyectos) {
          const dias = diasPorProyecto.get(proyectoId);
          if (dias) for (const d of dias) base.add(d);
        }
        const diasBase = base.size;

        return {
          trabajadorId,
          dni: t?.dni ?? '—',
          nombres: t?.nombres ?? '—',
          apellidos: t?.apellidos ?? '—',
          empresaId: acum.empresaId,
          empresa: nombreEmpresa.get(acum.empresaId) ?? null,
          enPlanilla: infoPlanilla.has(trabajadorId),
          diasTrabajados,
          diasBase,
          porcentajeParticipacion: this.pct(diasTrabajados, diasBase),
          proyectos: [...acum.proyectos].map((id) => ({
            id,
            nombre: nombreProyecto.get(id) ?? `Proyecto ${id}`,
          })),
        };
      })
      .sort(
        (a, b) =>
          b.diasTrabajados - a.diasTrabajados ||
          a.apellidos.localeCompare(b.apellidos),
      );

    // ── Personal con menor participación (incluye los de 0 días) ──
    const menorParticipacion = planilla
      .map((t) => {
        const acum = porTrabajador.get(t.id);
        return {
          trabajadorId: t.id,
          dni: t.dni,
          nombres: t.nombres,
          apellidos: t.apellidos,
          empresaId: t.empresaId,
          empresa: nombreEmpresa.get(t.empresaId) ?? null,
          diasTrabajados: acum ? acum.dias.size : 0,
          diasConReporte,
          porcentajeSobreRango: this.pct(
            acum ? acum.dias.size : 0,
            diasConReporte,
          ),
        };
      })
      .sort(
        (a, b) =>
          a.diasTrabajados - b.diasTrabajados ||
          a.apellidos.localeCompare(b.apellidos),
      )
      .slice(0, filtro.tope ?? TOPE_MENOR_PARTICIPACION);

    // ── Utilización por empresa contratista ──
    const contratadosPorEmpresa = new Map<number, number>();
    for (const t of planilla)
      contratadosPorEmpresa.set(
        t.empresaId,
        (contratadosPorEmpresa.get(t.empresaId) ?? 0) + 1,
      );

    const participacionesPorEmpresa = new Map<number, number>();
    for (const p of participaciones)
      participacionesPorEmpresa.set(
        p.empresaId,
        (participacionesPorEmpresa.get(p.empresaId) ?? 0) + 1,
      );

    const participantesPorEmpresa = new Map<number, number>();
    for (const t of planilla)
      if (porTrabajador.has(t.id))
        participantesPorEmpresa.set(
          t.empresaId,
          (participantesPorEmpresa.get(t.empresaId) ?? 0) + 1,
        );

    // ── Exposición: días realmente disponibles para cada empresa ──
    //
    // Comparar la utilización cruda de una empresa que estuvo en una obra
    // de 60 días activos contra otra de 10 días no es justo: la primera
    // tuvo seis veces más oportunidad de acumular participaciones.
    //
    // La exposición de una empresa son los días con reporte de LOS
    // PROYECTOS donde efectivamente participó — no el calendario del rango.
    // Es el mismo criterio del `diasBase` del ranking de trabajadores.
    const proyectosPorEmpresa = new Map<number, Set<number>>();
    for (const p of participaciones) {
      let set = proyectosPorEmpresa.get(p.empresaId);
      if (!set) {
        set = new Set<number>();
        proyectosPorEmpresa.set(p.empresaId, set);
      }
      set.add(p.proyectoId);
    }

    const diasExposicionPorEmpresa = new Map<number, number>();
    for (const [empresaId, proyectosDeEmpresa] of proyectosPorEmpresa) {
      // Unión de días: un día compartido entre dos obras cuenta una vez.
      const dias = new Set<string>();
      for (const proyectoId of proyectosDeEmpresa) {
        const delProyecto = diasPorProyecto.get(proyectoId);
        if (delProyecto) for (const d of delProyecto) dias.add(d);
      }
      diasExposicionPorEmpresa.set(empresaId, dias.size);
    }

    const porEmpresa = empresas
      .map((e) => {
        const contratados = contratadosPorEmpresa.get(e.id) ?? 0;
        const participaron = participantesPorEmpresa.get(e.id) ?? 0;
        const participacionesEmpresa = participacionesPorEmpresa.get(e.id) ?? 0;
        const capacidadEmpresa = contratados * diasConReporte;
        const diasExposicion = diasExposicionPorEmpresa.get(e.id) ?? 0;
        const capacidadExpuesta = contratados * diasExposicion;

        return {
          empresaId: e.id,
          empresa: e.nombre,
          ruc: e.ruc,
          contratados,
          participaron,
          sinParticipacion: contratados - participaron,
          participaciones: participacionesEmpresa,
          // ¿Qué parte de su planilla se usó al menos un día?
          utilizacionCobertura: this.pct(participaron, contratados),
          // ¿Qué parte de la capacidad total del RANGO se usó?
          utilizacionIntensidad: this.pct(
            participacionesEmpresa,
            capacidadEmpresa,
          ),
          // ¿Qué parte de la capacidad REALMENTE DISPONIBLE se usó?
          // Denominador = contratados × días activos de sus propias obras.
          // Es la única de las tres que permite comparar de igual a igual
          // una contratista de obra larga contra una de obra corta.
          utilizacionEfectiva: this.pct(
            participacionesEmpresa,
            capacidadExpuesta,
          ),
          // Se expone el denominador para que la cifra sea auditable,
          // igual que la columna "Base" del ranking.
          diasExposicion,
          capacidadExpuesta,
          proyectos: [...(proyectosPorEmpresa.get(e.id) ?? [])].map((id) => ({
            id,
            nombre: nombreProyecto.get(id) ?? `Proyecto ${id}`,
          })),
        };
      })
      .sort(
        (a, b) =>
          (b.utilizacionCobertura ?? -1) - (a.utilizacionCobertura ?? -1),
      );

    return {
      rango: {
        desde: desde ? claveDia(desde) : null,
        hasta: hasta ? claveDia(hasta) : null,
        diasConReporte,
      },
      kpis,
      ranking,
      menorParticipacion,
      porEmpresa,
    };
  }
}
