import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { aFechaUTC } from '../common/fechas';
import type {
  CrearReporteDiarioDto,
  EditarReporteDiarioDto,
  FiltroReportesDto,
} from './dto';

// Datos ya validados y listos para escribir en la BD.
interface ReporteNormalizado {
  fecha: Date;
  proyectoId: number;
  supervisorId: number;
  equiposProgramados: number;
  equiposEjecutados: number;
  tecnicosProgramados: number;
  numeroContratistasProgramados: number | null;
  produccion: string | null;
  tecnicosLaborando: number;
  numeroContratistasTrabajando: number;
  calificacionProveedor: string | null;
  calificacionSupervisor: string | null;
  // Solo para mensajes de error legibles.
  nombreProyecto: string;
  // trabajadorId -> empresaId (snapshot al momento del reporte)
  trabajadores: { trabajadorId: number; empresaId: number }[];
}

@Injectable()
export class ReporteDiarioService {
  constructor(private readonly prisma: PrismaService) {}

  private limpiar(valor: unknown): string | null {
    if (typeof valor === 'string') {
      const s = valor.trim();
      return s === '' ? null : s;
    }
    if (typeof valor === 'number' || typeof valor === 'boolean')
      return String(valor);
    // null, undefined, objetos y arrays: no son texto válido.
    return null;
  }

  /** Representación segura de un valor para incluirlo en un mensaje de error. */
  private describir(valor: unknown): string {
    if (typeof valor === 'string') return valor;
    if (typeof valor === 'number' || typeof valor === 'boolean')
      return String(valor);
    return JSON.stringify(valor) ?? 'null';
  }

  /**
   * Fecha obligatoria del cuerpo de una petición.
   * El parseo vive en common/fechas.ts; aquí solo se exige que venga.
   */
  private aFecha(valor: unknown, campo = 'fecha'): Date {
    const s = this.limpiar(valor);
    if (!s)
      throw new BadRequestException(`El campo "${campo}" es obligatorio.`);
    return aFechaUTC(s, campo);
  }

  /** Entero >= 0 opcional. null si no viene. */
  private aEnteroOpcional(valor: unknown, campo: string): number | null {
    if (valor === null || valor === undefined || valor === '') return null;
    return this.aEntero(valor, campo);
  }

  /** Entero >= 0 obligatorio. */
  private aEntero(valor: unknown, campo: string): number {
    if (valor === null || valor === undefined || valor === '')
      throw new BadRequestException(`El campo "${campo}" es obligatorio.`);
    const n = Number(valor);
    if (!Number.isInteger(n))
      throw new BadRequestException(
        `El campo "${campo}" debe ser un número entero. Recibido: "${this.describir(valor)}".`,
      );
    if (n < 0)
      throw new BadRequestException(
        `El campo "${campo}" no puede ser negativo. Recibido: ${n}.`,
      );
    return n;
  }

  /** Id entero positivo obligatorio. */
  private aId(valor: unknown, campo: string): number {
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0)
      throw new BadRequestException(
        `El campo "${campo}" debe ser un id válido. Recibido: "${this.describir(valor)}".`,
      );
    return n;
  }

  /** Porcentaje 0–100 opcional, devuelto con 2 decimales (Decimal(5,2)). */
  private aPorcentajeOpcional(valor: unknown, campo: string): string | null {
    if (valor === null || valor === undefined || valor === '') return null;
    const n = Number(valor);
    if (isNaN(n))
      throw new BadRequestException(`El campo "${campo}" debe ser numérico.`);
    if (n < 0 || n > 100)
      throw new BadRequestException(
        `El campo "${campo}" debe estar entre 0 y 100. Recibido: ${n}.`,
      );
    return n.toFixed(2);
  }

  /**
   * CALCULADO — nunca lo digita el usuario.
   * produccion = equiposEjecutados / equiposProgramados * 100.
   * Devuelve null si no hay equipos programados: forzar 0 ensuciaría los
   * promedios de producción de la Fase 3.
   */
  private calcularProduccion(
    ejecutados: number,
    programados: number,
  ): string | null {
    if (programados === 0) return null;
    const pct = (ejecutados / programados) * 100;
    // La columna es Decimal(5,2): tope 999.99.
    if (pct > 999.99)
      throw new BadRequestException(
        `La producción calculada (${pct.toFixed(2)}%) excede el máximo admitido. ` +
          'Revisa equiposProgramados y equiposEjecutados.',
      );
    return pct.toFixed(2);
  }

  /**
   * Valida el DTO completo contra la BD y arma el objeto listo para escribir.
   * Resuelve el snapshot de empresa de cada trabajador.
   */
  private async normalizar(
    dto: CrearReporteDiarioDto,
  ): Promise<ReporteNormalizado> {
    const fecha = this.aFecha(dto.fecha);
    const proyectoId = this.aId(dto.proyectoId, 'proyectoId');
    const supervisorId = this.aId(dto.supervisorId, 'supervisorId');

    const equiposProgramados = this.aEntero(
      dto.equiposProgramados,
      'equiposProgramados',
    );
    const equiposEjecutados = this.aEntero(
      dto.equiposEjecutados,
      'equiposEjecutados',
    );
    const tecnicosProgramados = this.aEntero(
      dto.tecnicosProgramados,
      'tecnicosProgramados',
    );
    const numeroContratistasProgramados = this.aEnteroOpcional(
      dto.numeroContratistasProgramados,
      'numeroContratistasProgramados',
    );

    // Existencia de proyecto y supervisor (las FK son Restrict, pero un
    // mensaje claro es mejor que un error de constraint de Postgres).
    const [proyecto, supervisor] = await Promise.all([
      this.prisma.proyecto.findUnique({
        where: { id: proyectoId },
        select: { id: true, nombre: true },
      }),
      this.prisma.supervisor.findUnique({
        where: { id: supervisorId },
        select: { id: true },
      }),
    ]);
    if (!proyecto)
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado.`);
    if (!supervisor)
      throw new NotFoundException(`Supervisor ${supervisorId} no encontrado.`);

    // Trabajadores: se deduplican para no inflar tecnicosLaborando ni
    // chocar con @@unique([reporteId, trabajadorId]).
    const idsCrudos = Array.isArray(dto.trabajadoresIds)
      ? dto.trabajadoresIds
      : [];
    const ids = [
      ...new Set(idsCrudos.map((v) => this.aId(v, 'trabajadoresIds'))),
    ];

    const encontrados = await this.prisma.trabajador.findMany({
      where: { id: { in: ids } },
      select: { id: true, empresaId: true },
    });

    if (encontrados.length !== ids.length) {
      const hallados = new Set(encontrados.map((t) => t.id));
      const faltantes = ids.filter((id) => !hallados.has(id));
      throw new NotFoundException(
        `Trabajador(es) no encontrado(s): ${faltantes.join(', ')}.`,
      );
    }

    return {
      fecha,
      proyectoId,
      supervisorId,
      equiposProgramados,
      equiposEjecutados,
      tecnicosProgramados,
      produccion: this.calcularProduccion(
        equiposEjecutados,
        equiposProgramados,
      ),
      numeroContratistasProgramados,
      // CALCULADO: sale del conteo de trabajadores seleccionados.
      tecnicosLaborando: encontrados.length,
      // CALCULADO: empresas distintas entre esos trabajadores. Mismo
      // criterio que tecnicosLaborando — no se pide como input.
      numeroContratistasTrabajando: new Set(encontrados.map((t) => t.empresaId))
        .size,
      nombreProyecto: proyecto.nombre,
      calificacionProveedor: this.aPorcentajeOpcional(
        dto.calificacionProveedor,
        'calificacionProveedor',
      ),
      calificacionSupervisor: this.aPorcentajeOpcional(
        dto.calificacionSupervisor,
        'calificacionSupervisor',
      ),
      trabajadores: encontrados.map((t) => ({
        trabajadorId: t.id,
        empresaId: t.empresaId,
      })),
    };
  }

  /** Traduce la violación de @@unique([proyectoId, fecha]) a un mensaje útil. */
  private traducirDuplicado(error: unknown, n: ReporteNormalizado) {
    const codigo = (error as { code?: string })?.code;
    if (codigo === 'P2002')
      return new ConflictException(
        `Ya existe un reporte diario de ${n.nombreProyecto} para el ${n.fecha.toISOString().slice(0, 10)}. ` +
          'Edita el reporte existente en lugar de crear otro.',
      );
    return error;
  }

  private get includeCompleto() {
    return {
      proyecto: {
        select: { id: true, nombre: true, cliente: true, ubicacion: true },
      },
      supervisor: { select: { id: true, nombre: true } },
      participaciones: {
        orderBy: { id: 'asc' as const },
        include: {
          trabajador: {
            select: { id: true, dni: true, nombres: true, apellidos: true },
          },
          empresa: { select: { id: true, nombre: true, ruc: true } },
        },
      },
    };
  }

  /**
   * Crea el reporte y sus N participaciones en UNA sola transacción:
   * o queda todo o no queda nada.
   */
  async crear(dto: CrearReporteDiarioDto) {
    const n = await this.normalizar(dto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const reporte = await tx.reporteDiario.create({
          data: {
            fecha: n.fecha,
            proyectoId: n.proyectoId,
            supervisorId: n.supervisorId,
            equiposProgramados: n.equiposProgramados,
            equiposEjecutados: n.equiposEjecutados,
            tecnicosProgramados: n.tecnicosProgramados,
            produccion: n.produccion,
            numeroContratistasProgramados: n.numeroContratistasProgramados,
            tecnicosLaborando: n.tecnicosLaborando,
            numeroContratistasTrabajando: n.numeroContratistasTrabajando,
            calificacionProveedor: n.calificacionProveedor,
            calificacionSupervisor: n.calificacionSupervisor,
          },
        });

        if (n.trabajadores.length > 0) {
          await tx.participacion.createMany({
            data: n.trabajadores.map((t) => ({
              reporteId: reporte.id,
              trabajadorId: t.trabajadorId,
              empresaId: t.empresaId, // snapshot
              proyectoId: n.proyectoId, // redundante a propósito
              fecha: n.fecha, // redundante a propósito
            })),
          });
        }

        return tx.reporteDiario.findUnique({
          where: { id: reporte.id },
          include: this.includeCompleto,
        });
      });
    } catch (error) {
      throw this.traducirDuplicado(error, n);
    }
  }

  /**
   * Reescribe el reporte completo. Las participaciones se borran y se
   * recrean: si cambia fecha o proyecto, sus copias redundantes en
   * Participacion tienen que seguir el cambio o los indicadores mienten.
   */
  async editar(id: number, dto: EditarReporteDiarioDto) {
    const existe = await this.prisma.reporteDiario.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existe)
      throw new NotFoundException(`Reporte diario ${id} no encontrado.`);

    const n = await this.normalizar(dto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.reporteDiario.update({
          where: { id },
          data: {
            fecha: n.fecha,
            proyectoId: n.proyectoId,
            supervisorId: n.supervisorId,
            equiposProgramados: n.equiposProgramados,
            equiposEjecutados: n.equiposEjecutados,
            tecnicosProgramados: n.tecnicosProgramados,
            produccion: n.produccion,
            numeroContratistasProgramados: n.numeroContratistasProgramados,
            tecnicosLaborando: n.tecnicosLaborando,
            numeroContratistasTrabajando: n.numeroContratistasTrabajando,
            calificacionProveedor: n.calificacionProveedor,
            calificacionSupervisor: n.calificacionSupervisor,
          },
        });

        await tx.participacion.deleteMany({ where: { reporteId: id } });

        if (n.trabajadores.length > 0) {
          await tx.participacion.createMany({
            data: n.trabajadores.map((t) => ({
              reporteId: id,
              trabajadorId: t.trabajadorId,
              empresaId: t.empresaId,
              proyectoId: n.proyectoId,
              fecha: n.fecha,
            })),
          });
        }

        return tx.reporteDiario.findUnique({
          where: { id },
          include: this.includeCompleto,
        });
      });
    } catch (error) {
      throw this.traducirDuplicado(error, n);
    }
  }

  async listar(filtro: FiltroReportesDto) {
    const desde = filtro.desde ? this.aFecha(filtro.desde, 'desde') : undefined;
    const hasta = filtro.hasta ? this.aFecha(filtro.hasta, 'hasta') : undefined;

    return this.prisma.reporteDiario.findMany({
      where: {
        ...(filtro.proyectoId !== undefined
          ? { proyectoId: filtro.proyectoId }
          : {}),
        ...(filtro.supervisorId !== undefined
          ? { supervisorId: filtro.supervisorId }
          : {}),
        ...(desde || hasta
          ? {
              fecha: {
                ...(desde ? { gte: desde } : {}),
                ...(hasta ? { lte: hasta } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      include: {
        proyecto: { select: { id: true, nombre: true } },
        supervisor: { select: { id: true, nombre: true } },
        _count: { select: { participaciones: true } },
      },
    });
  }

  async detalle(id: number) {
    const reporte = await this.prisma.reporteDiario.findUnique({
      where: { id },
      include: this.includeCompleto,
    });
    if (!reporte)
      throw new NotFoundException(`Reporte diario ${id} no encontrado.`);
    return reporte;
  }

  /** Borra el reporte; sus participaciones caen por Cascade. */
  async eliminar(id: number) {
    const existe = await this.prisma.reporteDiario.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existe)
      throw new NotFoundException(`Reporte diario ${id} no encontrado.`);

    await this.prisma.reporteDiario.delete({ where: { id } });
    return { ok: true, id };
  }
}
