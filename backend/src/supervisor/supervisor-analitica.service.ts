import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { claveDia, rangoDeFechas, redondear } from '../common/fechas';

export interface FiltroSupervisorDto {
  desde?: string;
  hasta?: string;
}

// Forma mínima de un reporte para las métricas de supervisor.
interface ReporteSupervisor {
  id: number;
  fecha: Date;
  proyectoId: number;
  supervisorId: number;
  equiposProgramados: number;
  equiposEjecutados: number;
  tecnicosProgramados: number;
  tecnicosLaborando: number;
  produccion: { toString(): string } | null;
  calificacionSupervisor: { toString(): string } | null;
}

/**
 * Seguimiento de supervisores de HVC.
 *
 * Responde "¿qué obras ha llevado esta persona y cómo le ha ido?", que no
 * se contesta mirando un proyecto aislado. El histórico NO se filtra por
 * período: un supervisor que dejó una obra hace tres meses sigue siendo
 * responsable de lo que pasó ahí. El período sí acota las métricas de
 * desempeño, igual que en el resto del sistema.
 */
@Injectable()
export class SupervisorAnaliticaService {
  constructor(private readonly prisma: PrismaService) {}

  private aNumero(valor: { toString(): string } | null): number | null {
    if (valor === null || valor === undefined) return null;
    const n = Number(valor.toString());
    return isNaN(n) ? null : n;
  }

  private media(valores: (number | null)[]): number | null {
    const validos = valores.filter((v): v is number => v !== null);
    if (validos.length === 0) return null;
    return redondear(validos.reduce((a, v) => a + v, 0) / validos.length);
  }

  /** Métricas de un conjunto de reportes de un supervisor. */
  private metricas(reportes: ReporteSupervisor[]) {
    const equiposProgramados = reportes.reduce(
      (a, r) => a + r.equiposProgramados,
      0,
    );
    const equiposEjecutados = reportes.reduce(
      (a, r) => a + r.equiposEjecutados,
      0,
    );
    const brechas = reportes.filter(
      (r) => r.tecnicosLaborando < r.tecnicosProgramados,
    ).length;

    return {
      reportes: reportes.length,
      diasReportados: new Set(reportes.map((r) => claveDia(r.fecha))).size,
      produccionPromedio: this.media(
        reportes.map((r) => this.aNumero(r.produccion)),
      ),
      cumplimiento:
        equiposProgramados === 0
          ? null
          : redondear((equiposEjecutados / equiposProgramados) * 100),
      equiposProgramados,
      equiposEjecutados,
      // Calificación que el supervisor RECIBIÓ en sus jornadas.
      calificacionPromedio: this.media(
        reportes.map((r) => this.aNumero(r.calificacionSupervisor)),
      ),
      calificacionesRegistradas: reportes.filter(
        (r) => r.calificacionSupervisor !== null,
      ).length,
      personalPromedioPorDia:
        reportes.length === 0
          ? null
          : redondear(
              reportes.reduce((a, r) => a + r.tecnicosLaborando, 0) /
                reportes.length,
              1,
            ),
      // Jornadas en las que gestionó menos gente de la planificada.
      jornadasConBrecha: brechas,
      porcentajeJornadasConBrecha:
        reportes.length === 0
          ? null
          : redondear((brechas / reportes.length) * 100),
    };
  }

  private seleccionReporte() {
    return {
      id: true,
      fecha: true,
      proyectoId: true,
      supervisorId: true,
      equiposProgramados: true,
      equiposEjecutados: true,
      tecnicosProgramados: true,
      tecnicosLaborando: true,
      produccion: true,
      calificacionSupervisor: true,
    };
  }

  /**
   * Panorama de un supervisor: sus obras históricas y su desempeño.
   */
  async resumen(id: number, filtro: FiltroSupervisorDto) {
    const supervisor = await this.prisma.supervisor.findUnique({
      where: { id },
      select: { id: true, nombre: true, estado: true },
    });
    if (!supervisor)
      throw new NotFoundException(`Supervisor ${id} no encontrado.`);

    const rango = rangoDeFechas(filtro.desde, filtro.hasta);

    const [todos, delPeriodo, proyectos] = await Promise.all([
      // Histórico completo: sin filtro de fecha, a propósito.
      this.prisma.reporteDiario.findMany({
        where: { supervisorId: id },
        orderBy: { fecha: 'asc' },
        select: this.seleccionReporte(),
      }),
      this.prisma.reporteDiario.findMany({
        where: { supervisorId: id, ...(rango ? { fecha: rango } : {}) },
        select: this.seleccionReporte(),
      }),
      this.prisma.proyecto.findMany({
        select: { id: true, nombre: true, cliente: true, estado: true },
      }),
    ]);

    const infoProyecto = new Map(proyectos.map((p) => [p.id, p]));

    // Un bloque por obra supervisada, con su ventana de fechas.
    const porProyecto = new Map<number, ReporteSupervisor[]>();
    for (const r of todos) {
      const lista = porProyecto.get(r.proyectoId) ?? [];
      lista.push(r);
      porProyecto.set(r.proyectoId, lista);
    }

    const proyectosSupervisados = [...porProyecto.entries()]
      .map(([proyectoId, suyos]) => {
        const p = infoProyecto.get(proyectoId);
        const fechas = suyos.map((r) => claveDia(r.fecha)).sort();
        return {
          proyectoId,
          nombre: p?.nombre ?? `Proyecto ${proyectoId}`,
          cliente: p?.cliente ?? null,
          estado: p?.estado ?? null,
          primerReporte: fechas[0],
          ultimoReporte: fechas[fechas.length - 1],
          ...this.metricas(suyos),
        };
      })
      .sort((a, b) => b.ultimoReporte.localeCompare(a.ultimoReporte));

    return {
      supervisor,
      periodo: { desde: filtro.desde ?? null, hasta: filtro.hasta ?? null },
      // Todo lo que ha llevado, sin importar el filtro de fechas.
      historico: this.metricas(todos),
      proyectosSupervisados,
      totalProyectos: proyectosSupervisados.length,
      // Desempeño acotado al período elegido.
      enPeriodo: this.metricas(delPeriodo),
    };
  }

  /**
   * Tabla comparativa de todos los supervisores.
   * Incluye los que no tienen reportes: un supervisor sin actividad es
   * información, no una fila que deba desaparecer.
   */
  async comparacion(filtro: FiltroSupervisorDto) {
    const rango = rangoDeFechas(filtro.desde, filtro.hasta);

    const [supervisores, reportes] = await Promise.all([
      this.prisma.supervisor.findMany({
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        select: { id: true, nombre: true, estado: true },
      }),
      this.prisma.reporteDiario.findMany({
        where: rango ? { fecha: rango } : {},
        select: this.seleccionReporte(),
      }),
    ]);

    // Proyectos históricos por supervisor (sin filtro de período).
    const historicos = await this.prisma.reporteDiario.groupBy({
      by: ['supervisorId', 'proyectoId'],
      _count: { _all: true },
    });
    const proyectosPorSupervisor = new Map<number, Set<number>>();
    for (const h of historicos) {
      const set = proyectosPorSupervisor.get(h.supervisorId) ?? new Set();
      set.add(h.proyectoId);
      proyectosPorSupervisor.set(h.supervisorId, set);
    }

    const porSupervisor = new Map<number, ReporteSupervisor[]>();
    for (const r of reportes) {
      const lista = porSupervisor.get(r.supervisorId) ?? [];
      lista.push(r);
      porSupervisor.set(r.supervisorId, lista);
    }

    return supervisores.map((s) => ({
      ...s,
      // Histórico: cuántas obras distintas ha llevado en total.
      proyectosHistoricos: proyectosPorSupervisor.get(s.id)?.size ?? 0,
      // Del período: en cuántas estuvo activo.
      proyectosEnPeriodo: new Set(
        (porSupervisor.get(s.id) ?? []).map((r) => r.proyectoId),
      ).size,
      ...this.metricas(porSupervisor.get(s.id) ?? []),
    }));
  }
}
