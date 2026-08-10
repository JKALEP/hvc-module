import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { claveDia, rangoDeFechas, redondear } from '../common/fechas';

export interface FiltroPeriodoDto {
  desde?: string;
  hasta?: string;
}

// Forma mínima de un reporte para los cálculos agregados.
interface ReporteCalculo {
  fecha: Date;
  equiposProgramados: number;
  equiposEjecutados: number;
  tecnicosProgramados: number;
  tecnicosLaborando: number;
  numeroContratistasProgramados?: number | null;
  numeroContratistasTrabajando?: number;
  produccion: { toString(): string } | null;
}

@Injectable()
export class ProyectoAnaliticaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Decimal de Prisma → number. null si no hay valor. */
  private aNumero(valor: { toString(): string } | null): number | null {
    if (valor === null || valor === undefined) return null;
    const n = Number(valor.toString());
    return isNaN(n) ? null : n;
  }

  private async existeProyecto(id: number) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        cliente: true,
        ubicacion: true,
        estado: true,
      },
    });
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado.`);
    return proyecto;
  }

  /**
   * AVANCE TOTAL — calculado, no declarado.
   *
   * Σ equiposEjecutados / Σ equiposProgramados sobre TODOS los reportes
   * diarios del proyecto. Verificado contra los Excel de HVC (UTP Trujillo
   * y Urbanova): coincide al céntimo con el "Avance Total" que muestran.
   *
   * Nunca se filtra por período: es un acumulado desde el inicio de la obra.
   *
   * Se calcula en lectura y no se almacena. Un SUM sobre una FK indexada no
   * necesita caché, y una columna denormalizada habría que resincronizarla
   * en los tres caminos de la transacción de reportes — y se desincroniza
   * igual en cuanto alguien escribe SQL directo, cosa que aquí se hace.
   */
  private async avanceTotal(proyectoId: number) {
    const agg = await this.prisma.reporteDiario.aggregate({
      where: { proyectoId },
      _sum: { equiposProgramados: true, equiposEjecutados: true },
      _count: { _all: true },
    });

    const programados = agg._sum.equiposProgramados ?? 0;
    const ejecutados = agg._sum.equiposEjecutados ?? 0;

    return {
      porcentaje:
        programados === 0 ? null : redondear((ejecutados / programados) * 100),
      equiposProgramados: programados,
      equiposEjecutados: ejecutados,
      reportes: agg._count._all,
    };
  }

  /**
   * Último ajuste manual, si existe. Es la EXCEPCIÓN, no el número por
   * defecto: solo aplica cuando el avance real incluye trabajo que no se
   * mide en equipos (planos, permisos, materiales).
   */
  private ultimoAjuste(proyectoId: number) {
    return this.prisma.ajusteAvance.findFirst({
      where: { proyectoId },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    });
  }

  /**
   * Agrega un conjunto de reportes. Devuelve las dos métricas de
   * desempeño, que NO son lo mismo:
   *
   * - produccionPromedio: media de los porcentajes diarios. Cada día pesa
   *   igual, sin importar cuántos equipos tuviera.
   * - cumplimiento: Σ ejecutados / Σ programados. Cada equipo pesa igual,
   *   así que los días grandes mandan.
   *
   * El promedio de razones no es la razón de sumas; se exponen las dos.
   */
  private agregar(reportes: ReporteCalculo[]) {
    const equiposProgramados = reportes.reduce(
      (a, r) => a + r.equiposProgramados,
      0,
    );
    const equiposEjecutados = reportes.reduce(
      (a, r) => a + r.equiposEjecutados,
      0,
    );

    // Solo los días con producción calculable entran al promedio: un día
    // sin equipos programados no es "0% de producción", es "no aplica".
    const produccionesValidas = reportes
      .map((r) => this.aNumero(r.produccion))
      .filter((p): p is number => p !== null);

    const produccionPromedio =
      produccionesValidas.length === 0
        ? null
        : redondear(
            produccionesValidas.reduce((a, p) => a + p, 0) /
              produccionesValidas.length,
          );

    const cumplimiento =
      equiposProgramados === 0
        ? null
        : redondear((equiposEjecutados / equiposProgramados) * 100);

    const tecnicosProgramados = reportes.reduce(
      (a, r) => a + r.tecnicosProgramados,
      0,
    );
    const tecnicosLaborando = reportes.reduce(
      (a, r) => a + r.tecnicosLaborando,
      0,
    );

    return {
      diasConReporte: new Set(reportes.map((r) => claveDia(r.fecha))).size,
      equiposProgramados,
      equiposEjecutados,
      produccionPromedio,
      cumplimiento,
      tecnicosPromedioProgramados:
        reportes.length === 0
          ? null
          : redondear(tecnicosProgramados / reportes.length, 1),
      tecnicosPromedioLaborando:
        reportes.length === 0
          ? null
          : redondear(tecnicosLaborando / reportes.length, 1),

      // Contratistas: promedio de empresas distintas en obra por jornada.
      // El programado solo promedia los reportes que lo declararon; los
      // históricos sin dato no cuentan como cero.
      contratistasPromedioTrabajando:
        reportes.length === 0
          ? null
          : redondear(
              reportes.reduce(
                (a, r) => a + (r.numeroContratistasTrabajando ?? 0),
                0,
              ) / reportes.length,
              1,
            ),
      contratistasPromedioProgramados: (() => {
        const declarados = reportes
          .map((r) => r.numeroContratistasProgramados)
          .filter((v): v is number => v !== null && v !== undefined);
        return declarados.length === 0
          ? null
          : redondear(
              declarados.reduce((a, v) => a + v, 0) / declarados.length,
              1,
            );
      })(),
    };
  }

  /**
   * Serie del CUMPLIMIENTO ACUMULADO día a día, para el gráfico.
   *
   * Cada punto es Σejecutados / Σprogramados de todos los reportes HASTA
   * esa fecha, desde el inicio del proyecto (no desde el inicio del filtro:
   * un acumulado que empieza a media obra no es un acumulado).
   *
   * OJO — esta línea PUEDE BAJAR. Es una razón corriente, no un progreso
   * monótono: una jornada mala arrastra el acumulado hacia abajo. Por eso
   * el gráfico se titula "Cumplimiento acumulado" y no "Avance".
   */
  async cumplimientoAcumulado(id: number, filtro: FiltroPeriodoDto) {
    await this.existeProyecto(id);

    const [reportes, ajustes] = await Promise.all([
      // Sin filtro de fecha: el acumulado necesita todo el historial.
      this.prisma.reporteDiario.findMany({
        where: { proyectoId: id },
        orderBy: { fecha: 'asc' },
        select: {
          fecha: true,
          equiposProgramados: true,
          equiposEjecutados: true,
        },
      }),
      this.prisma.ajusteAvance.findMany({
        where: { proyectoId: id },
        orderBy: { fecha: 'asc' },
        select: {
          id: true,
          fecha: true,
          porcentaje: true,
          observacion: true,
        },
      }),
    ]);

    let acumProgramados = 0;
    let acumEjecutados = 0;
    const serie = reportes.map((r) => {
      acumProgramados += r.equiposProgramados;
      acumEjecutados += r.equiposEjecutados;
      return {
        fecha: claveDia(r.fecha),
        equiposProgramados: r.equiposProgramados,
        equiposEjecutados: r.equiposEjecutados,
        acumuladoProgramados: acumProgramados,
        acumuladoEjecutados: acumEjecutados,
        cumplimientoAcumulado:
          acumProgramados === 0
            ? null
            : redondear((acumEjecutados / acumProgramados) * 100),
      };
    });

    // El rango solo recorta lo que se DIBUJA, no lo que se acumula.
    const rango = rangoDeFechas(filtro.desde, filtro.hasta);
    const enRango = (fecha: string) => {
      if (!rango) return true;
      const f = new Date(`${fecha}T00:00:00.000Z`);
      if (rango.gte && f < rango.gte) return false;
      if (rango.lte && f > rango.lte) return false;
      return true;
    };

    const visible = serie.filter((p) => enRango(p.fecha));
    // Los ajustes se recortan con el mismo criterio: uno fuera de la
    // ventana estiraría el eje X con un punto suelto y sin contexto.
    const ajustesVisibles = ajustes.filter((a) => enRango(claveDia(a.fecha)));

    return {
      serie: visible,
      // Se dibujan como puntos de otro color sobre la línea calculada:
      // así se ve de un vistazo cuándo alguien sobrescribió y cuánto se
      // apartó del cálculo.
      ajustes: ajustesVisibles.map((a) => ({
        id: a.id,
        fecha: claveDia(a.fecha),
        porcentaje: this.aNumero(a.porcentaje),
        observacion: a.observacion,
      })),
      // Para que la UI pueda avisar que hay overrides fuera de la ventana.
      ajustesFueraDePeriodo: ajustes.length - ajustesVisibles.length,
      // El acumulado real siempre corresponde al historial completo.
      totalHistorico:
        serie.length === 0
          ? null
          : serie[serie.length - 1].cumplimientoAcumulado,
      recortadoPorPeriodo: visible.length !== serie.length,
    };
  }

  /**
   * Tarjeta ejecutiva de un proyecto.
   * El avance acumulado ignora desde/hasta; el resto se calcula sobre el
   * período para que un mal arranque de hace meses no manche la vista.
   */
  async resumen(id: number, filtro: FiltroPeriodoDto) {
    const proyecto = await this.existeProyecto(id);
    const rango = rangoDeFechas(filtro.desde, filtro.hasta);
    const whereReporte = {
      proyectoId: id,
      ...(rango ? { fecha: rango } : {}),
    };

    const [avance, ajuste, reportes, participaciones] = await Promise.all([
      this.avanceTotal(id),
      this.ultimoAjuste(id),
      this.prisma.reporteDiario.findMany({
        where: whereReporte,
        orderBy: { fecha: 'asc' },
        select: {
          fecha: true,
          equiposProgramados: true,
          equiposEjecutados: true,
          tecnicosProgramados: true,
          tecnicosLaborando: true,
          numeroContratistasProgramados: true,
          numeroContratistasTrabajando: true,
          produccion: true,
          supervisor: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.participacion.findMany({
        where: { proyectoId: id, ...(rango ? { fecha: rango } : {}) },
        select: { trabajadorId: true, empresaId: true },
      }),
    ]);

    // Supervisores que efectivamente reportaron en el período, con cuántas
    // jornadas firmó cada uno.
    const porSupervisor = new Map<
      number,
      { nombre: string; reportes: number }
    >();
    for (const r of reportes) {
      const actual = porSupervisor.get(r.supervisor.id);
      if (actual) actual.reportes += 1;
      else
        porSupervisor.set(r.supervisor.id, {
          nombre: r.supervisor.nombre,
          reportes: 1,
        });
    }

    return {
      proyecto,
      // AVANCE TOTAL: calculado sobre TODO el historial, nunca filtrado.
      // Es el número por defecto de la obra.
      avanceAcumulado: {
        porcentaje: avance.porcentaje,
        equiposProgramados: avance.equiposProgramados,
        equiposEjecutados: avance.equiposEjecutados,
        reportes: avance.reportes,
        origen: 'CALCULADO' as const,
      },
      // Override manual, si lo hay. Siempre visible junto al calculado:
      // nunca reemplaza el número en silencio.
      ajusteManual: ajuste
        ? {
            id: ajuste.id,
            porcentaje: this.aNumero(ajuste.porcentaje),
            fecha: claveDia(ajuste.fecha),
            observacion: ajuste.observacion,
            // Cuánto se aparta el ajuste del cálculo.
            desviacion:
              avance.porcentaje === null
                ? null
                : redondear(
                    (this.aNumero(ajuste.porcentaje) ?? 0) - avance.porcentaje,
                  ),
          }
        : null,
      periodo: {
        desde: filtro.desde ?? null,
        hasta: filtro.hasta ?? null,
      },
      ...this.agregar(reportes),
      supervisores: [...porSupervisor.entries()]
        .map(([id, s]) => ({ id, nombre: s.nombre, reportes: s.reportes }))
        .sort((a, b) => b.reportes - a.reportes),
      personalDistinto: new Set(participaciones.map((p) => p.trabajadorId))
        .size,
      empresasDistintas: new Set(participaciones.map((p) => p.empresaId)).size,
      participaciones: participaciones.length,
    };
  }

  /** Serie diaria de un proyecto, ordenada por fecha. Base de los 3 gráficos. */
  private serie(id: number, filtro: FiltroPeriodoDto) {
    const rango = rangoDeFechas(filtro.desde, filtro.hasta);
    return this.prisma.reporteDiario.findMany({
      where: { proyectoId: id, ...(rango ? { fecha: rango } : {}) },
      orderBy: { fecha: 'asc' },
      select: {
        fecha: true,
        equiposProgramados: true,
        equiposEjecutados: true,
        tecnicosProgramados: true,
        tecnicosLaborando: true,
        numeroContratistasProgramados: true,
        numeroContratistasTrabajando: true,
        produccion: true,
      },
    });
  }

  /**
   * Producción diaria para el gráfico de línea.
   * `produccion` puede venir null (día sin equipos programados); se
   * conserva como null y el gráfico NO une el hueco: interpolarlo
   * inventaría un dato que nadie midió.
   */
  async produccionDiaria(id: number, filtro: FiltroPeriodoDto) {
    await this.existeProyecto(id);
    const reportes = await this.serie(id, filtro);
    return reportes.map((r) => ({
      fecha: claveDia(r.fecha),
      produccion: this.aNumero(r.produccion),
    }));
  }

  /** Equipos programados vs ejecutados, para el gráfico de barras agrupadas. */
  async equipos(id: number, filtro: FiltroPeriodoDto) {
    await this.existeProyecto(id);
    const reportes = await this.serie(id, filtro);
    return reportes.map((r) => ({
      fecha: claveDia(r.fecha),
      programados: r.equiposProgramados,
      ejecutados: r.equiposEjecutados,
    }));
  }

  /** Técnicos programados vs laborando. */
  async tecnicos(id: number, filtro: FiltroPeriodoDto) {
    await this.existeProyecto(id);
    const reportes = await this.serie(id, filtro);
    return reportes.map((r) => ({
      fecha: claveDia(r.fecha),
      programados: r.tecnicosProgramados,
      laborando: r.tecnicosLaborando,
      // Negativo = faltó gente respecto a lo planificado.
      diferencia: r.tecnicosLaborando - r.tecnicosProgramados,
    }));
  }

  /**
   * Comparación entre proyectos.
   * El avance total de cada uno se calcula sobre TODO su historial;
   * producción, cumplimiento y personal se miden sobre el rango.
   */
  async comparacion(filtro: FiltroPeriodoDto) {
    const rango = rangoDeFechas(filtro.desde, filtro.hasta);

    const [proyectos, reportes, participaciones, avances] = await Promise.all([
      this.prisma.proyecto.findMany({
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          nombre: true,
          cliente: true,
          ubicacion: true,
          estado: true,
        },
      }),
      this.prisma.reporteDiario.findMany({
        where: rango ? { fecha: rango } : {},
        select: {
          proyectoId: true,
          fecha: true,
          equiposProgramados: true,
          equiposEjecutados: true,
          tecnicosProgramados: true,
          tecnicosLaborando: true,
          numeroContratistasProgramados: true,
          numeroContratistasTrabajando: true,
          produccion: true,
        },
      }),
      this.prisma.participacion.findMany({
        where: rango ? { fecha: rango } : {},
        select: { proyectoId: true, trabajadorId: true },
      }),
      // Avance TOTAL por proyecto: acumulado de todo el historial, sin
      // filtro de fecha. Un groupBy basta, no hace falta N consultas.
      this.prisma.reporteDiario.groupBy({
        by: ['proyectoId'],
        _sum: { equiposProgramados: true, equiposEjecutados: true },
      }),
    ]);

    const reportesPorProyecto = new Map<number, ReporteCalculo[]>();
    for (const r of reportes) {
      const lista = reportesPorProyecto.get(r.proyectoId) ?? [];
      lista.push(r);
      reportesPorProyecto.set(r.proyectoId, lista);
    }

    const personalPorProyecto = new Map<number, Set<number>>();
    for (const p of participaciones) {
      let set = personalPorProyecto.get(p.proyectoId);
      if (!set) {
        set = new Set<number>();
        personalPorProyecto.set(p.proyectoId, set);
      }
      set.add(p.trabajadorId);
    }

    // Avance total calculado: Σejec / Σprog de todo el historial.
    const avancePorProyecto = new Map<number, number | null>();
    for (const a of avances) {
      const prog = a._sum.equiposProgramados ?? 0;
      const ejec = a._sum.equiposEjecutados ?? 0;
      avancePorProyecto.set(
        a.proyectoId,
        prog === 0 ? null : redondear((ejec / prog) * 100),
      );
    }

    return proyectos.map((p) => {
      const suyos = reportesPorProyecto.get(p.id) ?? [];
      return {
        ...p,
        // Calculado sobre todo el historial, no sobre el período.
        avanceAcumulado: avancePorProyecto.get(p.id) ?? null,
        ...this.agregar(suyos),
        personalDistinto: personalPorProyecto.get(p.id)?.size ?? 0,
        reportes: suyos.length,
      };
    });
  }
}
