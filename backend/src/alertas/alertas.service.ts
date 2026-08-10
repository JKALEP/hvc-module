import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IndicadoresService } from '../indicadores/indicadores.service';
import { ProyectoAnaliticaService } from '../proyecto/proyecto-analitica.service';
import { claveDia, rangoDeFechas } from '../common/fechas';
import {
  UMBRALES,
  ORDEN_SEVERIDAD,
  alertaSinParticipacion,
  alertaPocaParticipacion,
  alertaUtilizacionEmpresa,
  alertaBrechaTecnicos,
  alertaExcedenteTecnicos,
  alertaProduccionProyecto,
  type Alerta,
  type Severidad,
} from './reglas';

const ESTADOS_PROYECTO = ['EN_EJECUCION', 'FINALIZADO', 'PAUSADO'] as const;
type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

export interface FiltroAlertasDto {
  desde?: string;
  hasta?: string;
  proyectoId?: number;
  empresaId?: number;
  trabajadorId?: number;
  supervisorId?: number;
  estadoProyecto?: string;
}

@Injectable()
export class AlertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly indicadores: IndicadoresService,
    private readonly analitica: ProyectoAnaliticaService,
  ) {}

  private estadoValido(valor?: string): EstadoProyecto | undefined {
    if (!valor || valor.trim() === '') return undefined;
    const norm = valor.trim().toUpperCase().replace(/\s+/g, '_');
    if (!ESTADOS_PROYECTO.includes(norm as EstadoProyecto))
      throw new BadRequestException(
        `Estado inválido: "${valor}". Valores permitidos: ${ESTADOS_PROYECTO.join(', ')}.`,
      );
    return norm as EstadoProyecto;
  }

  /**
   * Resuelve el alcance de proyectos a partir de los filtros que no son
   * de fecha ni de empresa.
   *
   * Semántica deliberada: `supervisorId` y `estadoProyecto` NO recortan los
   * reportes uno a uno — recortan el CONJUNTO DE PROYECTOS considerado. Un
   * filtro por supervisor responde "¿cómo van las obras de este supervisor?",
   * no "¿qué pasó solo los días que él firmó".
   *
   * Devuelve undefined cuando no hay filtro (todos los proyectos), para no
   * añadir un `IN` innecesario a las consultas.
   */
  private async alcanceProyectos(
    filtro: FiltroAlertasDto,
  ): Promise<number[] | undefined> {
    const estado = this.estadoValido(filtro.estadoProyecto);
    const hayFiltro =
      filtro.proyectoId !== undefined ||
      filtro.supervisorId !== undefined ||
      estado !== undefined;
    if (!hayFiltro) return undefined;

    const proyectos = await this.prisma.proyecto.findMany({
      where: {
        ...(filtro.proyectoId !== undefined ? { id: filtro.proyectoId } : {}),
        ...(estado !== undefined ? { estado } : {}),
        ...(filtro.supervisorId !== undefined
          ? { reportes: { some: { supervisorId: filtro.supervisorId } } }
          : {}),
      },
      select: { id: true },
    });
    return proyectos.map((p) => p.id);
  }

  /**
   * Indicadores de personal SIN acotar por proyecto, a propósito.
   *
   * "Este trabajador no participó" es una pregunta sobre la planilla, no
   * sobre una obra. Si se acotara al proyecto filtrado, todo el personal
   * que trabaja en las OTRAS obras aparecería como ocioso — y con un
   * alcance vacío (p. ej. estado FINALIZADO sin proyectos) saltaría la
   * planilla entera.
   *
   * De ahí la regla de las alertas: los filtros de proyecto/estado/supervisor
   * acotan las métricas y alertas DE PROYECTO; los de empresa/trabajador
   * acotan las DE PERSONAL. No se cruzan. El cruce explícito vive en
   * /alertas/cruce.
   */
  private indicadoresDePlanilla(filtro: FiltroAlertasDto) {
    return this.indicadores.personal({
      desde: filtro.desde,
      hasta: filtro.hasta,
      empresaId: filtro.empresaId,
      // Sin tope: truncar en 20 ocultaría trabajadores con problemas.
      tope: Number.MAX_SAFE_INTEGER,
    });
  }

  /**
   * Cruce Proyecto → Personal participante → Empresa → Utilización.
   *
   * La utilización que se adjunta a cada empresa es la GLOBAL del período
   * (toda su planilla, en todos los proyectos), no la de este proyecto: la
   * pregunta que responde es "¿estoy usando bien a esta contratista?", que
   * no se contesta mirando una sola obra.
   */
  async cruce(proyectoId: number, filtro: FiltroAlertasDto) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: {
        id: true,
        nombre: true,
        cliente: true,
        ubicacion: true,
        estado: true,
      },
    });
    if (!proyecto)
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado.`);

    const rango = rangoDeFechas(filtro.desde, filtro.hasta);

    const [resumenProyecto, indicadoresGlobales, participaciones] =
      await Promise.all([
        this.analitica.resumen(proyectoId, {
          desde: filtro.desde,
          hasta: filtro.hasta,
        }),
        // Sin alcance de proyecto: la utilización de empresa es global.
        this.indicadores.personal({
          desde: filtro.desde,
          hasta: filtro.hasta,
          tope: Number.MAX_SAFE_INTEGER,
        }),
        this.prisma.participacion.findMany({
          where: { proyectoId, ...(rango ? { fecha: rango } : {}) },
          select: {
            trabajadorId: true,
            empresaId: true,
            fecha: true,
            trabajador: {
              select: { id: true, dni: true, nombres: true, apellidos: true },
            },
            empresa: { select: { id: true, nombre: true, ruc: true } },
          },
        }),
      ]);

    const utilizacionEmpresa = new Map(
      indicadoresGlobales.porEmpresa.map((e) => [e.empresaId, e]),
    );

    // Días distintos que cada trabajador estuvo en ESTE proyecto.
    interface Acum {
      dias: Set<string>;
      trabajador: {
        id: number;
        dni: string;
        nombres: string;
        apellidos: string;
      };
      empresa: { id: number; nombre: string; ruc: string };
    }
    const porTrabajador = new Map<number, Acum>();
    for (const p of participaciones) {
      let acum = porTrabajador.get(p.trabajadorId);
      if (!acum) {
        acum = {
          dias: new Set<string>(),
          trabajador: p.trabajador,
          empresa: p.empresa,
        };
        porTrabajador.set(p.trabajadorId, acum);
      }
      acum.dias.add(claveDia(p.fecha));
    }

    const diasDelProyecto = resumenProyecto.diasConReporte;

    const personal = [...porTrabajador.values()]
      .map((a) => {
        const util = utilizacionEmpresa.get(a.empresa.id);
        return {
          trabajadorId: a.trabajador.id,
          dni: a.trabajador.dni,
          nombres: a.trabajador.nombres,
          apellidos: a.trabajador.apellidos,
          diasTrabajados: a.dias.size,
          diasDelProyecto,
          porcentajeParticipacion:
            diasDelProyecto === 0
              ? null
              : Number(((a.dias.size / diasDelProyecto) * 100).toFixed(2)),
          empresaId: a.empresa.id,
          empresa: a.empresa.nombre,
          ruc: a.empresa.ruc,
          // Utilización de la contratista en TODO el período, no solo aquí.
          empresaUtilizacionCobertura: util?.utilizacionCobertura ?? null,
          empresaUtilizacionIntensidad: util?.utilizacionIntensidad ?? null,
          empresaContratados: util?.contratados ?? null,
        };
      })
      .filter(
        (p) =>
          filtro.trabajadorId === undefined ||
          p.trabajadorId === filtro.trabajadorId,
      )
      .sort(
        (a, b) =>
          b.diasTrabajados - a.diasTrabajados ||
          a.apellidos.localeCompare(b.apellidos),
      );

    // Resumen por empresa dentro de este proyecto.
    const porEmpresa = new Map<
      number,
      {
        empresa: string;
        ruc: string;
        personas: number;
        participaciones: number;
      }
    >();
    for (const p of personal) {
      const actual = porEmpresa.get(p.empresaId);
      if (actual) {
        actual.personas += 1;
        actual.participaciones += p.diasTrabajados;
      } else {
        porEmpresa.set(p.empresaId, {
          empresa: p.empresa,
          ruc: p.ruc,
          personas: 1,
          participaciones: p.diasTrabajados,
        });
      }
    }

    return {
      proyecto,
      avanceAcumulado: resumenProyecto.avanceAcumulado,
      periodo: {
        desde: filtro.desde ?? null,
        hasta: filtro.hasta ?? null,
        diasConReporte: diasDelProyecto,
      },
      produccionPromedio: resumenProyecto.produccionPromedio,
      cumplimiento: resumenProyecto.cumplimiento,
      personal,
      empresas: [...porEmpresa.entries()]
        .map(([empresaId, e]) => {
          const util = utilizacionEmpresa.get(empresaId);
          return {
            empresaId,
            empresa: e.empresa,
            ruc: e.ruc,
            personasEnProyecto: e.personas,
            participacionesEnProyecto: e.participaciones,
            utilizacionCobertura: util?.utilizacionCobertura ?? null,
            utilizacionIntensidad: util?.utilizacionIntensidad ?? null,
            contratados: util?.contratados ?? null,
          };
        })
        .sort((a, b) => b.personasEnProyecto - a.personasEnProyecto),
      umbrales: UMBRALES,
    };
  }

  /**
   * Todas las alertas activas del período, ordenadas por severidad.
   */
  async alertas(filtro: FiltroAlertasDto) {
    const proyectoIds = await this.alcanceProyectos(filtro);
    const estado = this.estadoValido(filtro.estadoProyecto);
    const rango = rangoDeFechas(filtro.desde, filtro.hasta);

    const [indicadores, comparacion, reportes] = await Promise.all([
      // Alertas de personal (a, b) y de empresa (c): sobre la planilla, sin
      // acotar por proyecto. Ver el comentario de indicadoresDePlanilla.
      this.indicadoresDePlanilla(filtro),
      this.analitica.comparacion({ desde: filtro.desde, hasta: filtro.hasta }),
      this.prisma.reporteDiario.findMany({
        where: {
          ...(rango ? { fecha: rango } : {}),
          ...(proyectoIds !== undefined
            ? { proyectoId: { in: proyectoIds } }
            : {}),
          ...(filtro.supervisorId !== undefined
            ? { supervisorId: filtro.supervisorId }
            : {}),
        },
        orderBy: { fecha: 'desc' },
        select: {
          id: true,
          fecha: true,
          proyectoId: true,
          tecnicosProgramados: true,
          tecnicosLaborando: true,
          proyecto: { select: { nombre: true } },
          supervisor: { select: { nombre: true } },
        },
      }),
    ]);

    const alertas: Alerta[] = [];
    const diasConReporte = indicadores.kpis.diasConReporte;

    // ── (a) Sin participación · (b) Poca participación ──
    // La regla (b) solo se evalúa si el período tiene suficientes días:
    // con menos, TODOS caerían bajo el mínimo y sería ruido.
    const evaluaPocaParticipacion =
      diasConReporte >= UMBRALES.diasConReporteMinimos;

    for (const t of indicadores.menorParticipacion) {
      if (
        filtro.trabajadorId !== undefined &&
        t.trabajadorId !== filtro.trabajadorId
      )
        continue;

      if (t.diasTrabajados === 0) {
        alertas.push(
          alertaSinParticipacion({
            trabajadorId: t.trabajadorId,
            nombres: t.nombres,
            apellidos: t.apellidos,
            dni: t.dni,
            empresaId: t.empresaId,
            empresa: t.empresa,
            diasConReporte,
          }),
        );
      } else if (
        evaluaPocaParticipacion &&
        t.diasTrabajados < UMBRALES.diasMinimos
      ) {
        alertas.push(
          alertaPocaParticipacion({
            trabajadorId: t.trabajadorId,
            nombres: t.nombres,
            apellidos: t.apellidos,
            dni: t.dni,
            empresaId: t.empresaId,
            empresa: t.empresa,
            diasTrabajados: t.diasTrabajados,
            diasConReporte,
          }),
        );
      }
    }

    // ── (c) Utilización de empresa contratista ──
    for (const e of indicadores.porEmpresa) {
      if (filtro.empresaId !== undefined && e.empresaId !== filtro.empresaId)
        continue;
      if (
        e.utilizacionCobertura !== null &&
        e.utilizacionCobertura < UMBRALES.coberturaEmpresa
      ) {
        alertas.push(
          alertaUtilizacionEmpresa({
            empresaId: e.empresaId,
            empresa: e.empresa,
            cobertura: e.utilizacionCobertura,
            contratados: e.contratados,
            participaron: e.participaron,
          }),
        );
      }
    }

    // ── (d) Brecha / excedente de técnicos ──
    for (const r of reportes) {
      const diferencia = r.tecnicosLaborando - r.tecnicosProgramados;
      if (diferencia === 0) continue;

      const datos = {
        reporteId: r.id,
        proyectoId: r.proyectoId,
        proyecto: r.proyecto.nombre,
        fecha: claveDia(r.fecha),
        programados: r.tecnicosProgramados,
        laborando: r.tecnicosLaborando,
        supervisor: r.supervisor.nombre,
      };
      alertas.push(
        diferencia < 0
          ? alertaBrechaTecnicos(datos)
          : alertaExcedenteTecnicos(datos),
      );
    }

    // ── (e) Producción de proyecto bajo objetivo ──
    for (const p of comparacion) {
      if (proyectoIds !== undefined && !proyectoIds.includes(p.id)) continue;
      if (estado !== undefined && p.estado !== estado) continue;
      if (
        p.produccionPromedio !== null &&
        p.produccionPromedio < UMBRALES.produccionProyecto
      ) {
        alertas.push(
          alertaProduccionProyecto({
            proyectoId: p.id,
            proyecto: p.nombre,
            produccionPromedio: p.produccionPromedio,
            diasConReporte: p.diasConReporte,
          }),
        );
      }
    }

    alertas.sort(
      (a, b) =>
        ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad] ||
        a.tipo.localeCompare(b.tipo) ||
        a.titulo.localeCompare(b.titulo),
    );

    const conteo = alertas.reduce(
      (acc, a) => {
        acc[a.severidad] += 1;
        return acc;
      },
      { ALTA: 0, MEDIA: 0, BAJA: 0 } as Record<Severidad, number>,
    );

    return {
      periodo: {
        desde: filtro.desde ?? null,
        hasta: filtro.hasta ?? null,
        diasConReporte,
      },
      // La UI debe avisar cuando una regla se omitió: si no, un tablero
      // vacío parece "todo bien" cuando en realidad falta información.
      reglasOmitidas: evaluaPocaParticipacion
        ? []
        : [
            {
              tipo: 'POCA_PARTICIPACION',
              motivo:
                `El período tiene ${diasConReporte} día(s) con reporte y se ` +
                `necesitan al menos ${UMBRALES.diasConReporteMinimos} para que ` +
                `"menos de ${UMBRALES.diasMinimos} días trabajados" signifique algo. ` +
                'Amplía el rango de fechas para evaluar esta alerta.',
            },
          ],
      total: alertas.length,
      conteo,
      alertas,
      // Qué acotó cada grupo de filtros. Sin esto, filtrar por proyecto y
      // ver las mismas alertas de personal parece un bug.
      alcance: {
        proyectosAcotados: proyectoIds !== undefined,
        alertasDePersonalAcotadasAProyecto: false,
      },
      umbrales: UMBRALES,
    };
  }
}
