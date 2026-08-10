import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { aFechaUTC } from '../common/fechas';

const ESTADOS_PROYECTO = ['EN_EJECUCION', 'FINALIZADO', 'PAUSADO'] as const;
type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

export interface CrearProyectoDto {
  nombre?: string | null;
  cliente?: string | null;
  ubicacion?: string | null;
  estado?: string | null;
}

export type EditarProyectoDto = CrearProyectoDto;

export interface AjusteAvanceDto {
  fecha?: string | null;
  porcentaje?: number | string | null;
  observacion?: string | null;
}

@Injectable()
export class ProyectoService {
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

  /** Valida y normaliza el estado del proyecto. */
  private estadoValido(valor: unknown): EstadoProyecto {
    const s = this.limpiar(valor);
    if (!s) return 'EN_EJECUCION';
    const norm = s.toUpperCase().replace(/\s+/g, '_');
    if (!ESTADOS_PROYECTO.includes(norm as EstadoProyecto))
      throw new BadRequestException(
        `Estado inválido: "${s}". Valores permitidos: ${ESTADOS_PROYECTO.join(', ')}.`,
      );
    return norm as EstadoProyecto;
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

  private porcentajeValido(valor: unknown, campo: string): string {
    if (valor === null || valor === undefined || valor === '')
      throw new BadRequestException(`El campo "${campo}" es obligatorio.`);
    const n = Number(valor);
    if (isNaN(n))
      throw new BadRequestException(`El campo "${campo}" debe ser numérico.`);
    if (n < 0 || n > 100)
      throw new BadRequestException(
        `El campo "${campo}" debe estar entre 0 y 100. Recibido: ${n}.`,
      );
    return n.toFixed(2);
  }

  // ── Proyectos ──

  async listar(estado?: string, q?: string) {
    const termino = (q ?? '').trim();
    const filtroEstado = this.limpiar(estado);

    return this.prisma.proyecto.findMany({
      where: {
        ...(filtroEstado ? { estado: this.estadoValido(filtroEstado) } : {}),
        ...(termino
          ? {
              OR: [
                { nombre: { contains: termino, mode: 'insensitive' as const } },
                {
                  cliente: { contains: termino, mode: 'insensitive' as const },
                },
                {
                  ubicacion: {
                    contains: termino,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      include: {
        // Último ajuste manual, si lo hay. El avance por defecto NO sale de
        // aquí: se calcula en ProyectoAnaliticaService.avanceTotal().
        ajustes: { orderBy: [{ fecha: 'desc' }, { id: 'desc' }], take: 1 },
        _count: { select: { reportes: true } },
      },
    });
  }

  async detalle(id: number) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
      include: {
        ajustes: { orderBy: [{ fecha: 'asc' }, { id: 'asc' }] },
        _count: { select: { reportes: true, participaciones: true } },
      },
    });
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado.`);
    return proyecto;
  }

  async crear(dto: CrearProyectoDto) {
    const nombre = this.limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException('El nombre del proyecto es obligatorio.');

    return this.prisma.proyecto.create({
      data: {
        nombre,
        cliente: this.limpiar(dto.cliente),
        ubicacion: this.limpiar(dto.ubicacion),
        estado: this.estadoValido(dto.estado),
      },
    });
  }

  async editar(id: number, dto: EditarProyectoDto) {
    const existe = await this.prisma.proyecto.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException(`Proyecto ${id} no encontrado.`);

    const data: Record<string, unknown> = {};
    if ('nombre' in dto) {
      const nombre = this.limpiar(dto.nombre);
      if (!nombre)
        throw new BadRequestException('El nombre del proyecto es obligatorio.');
      data.nombre = nombre;
    }
    if ('cliente' in dto) data.cliente = this.limpiar(dto.cliente);
    if ('ubicacion' in dto) data.ubicacion = this.limpiar(dto.ubicacion);
    if ('estado' in dto) data.estado = this.estadoValido(dto.estado);

    return this.prisma.proyecto.update({
      where: { id },
      data: data as never,
    });
  }

  async eliminar(id: number) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
      select: { _count: { select: { reportes: true } } },
    });
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado.`);

    // La FK es Restrict a propósito: borrar un proyecto con reportes
    // destruiría el historial de indicadores.
    if (proyecto._count.reportes > 0)
      throw new BadRequestException(
        `No se puede eliminar el proyecto ${id}: tiene ${proyecto._count.reportes} reporte(s) diario(s). ` +
          'Cámbialo a estado FINALIZADO en su lugar.',
      );

    await this.prisma.proyecto.delete({ where: { id } });
    return { ok: true, id };
  }

  // ── Ajustes manuales de avance (EXCEPCIÓN, no rutina) ──
  //
  // El avance por defecto es calculado (ProyectoAnaliticaService.avanceTotal).
  // Estos ajustes solo aplican cuando el avance real incluye trabajo que no
  // se mide en equipos: planos, permisos, materiales.

  async listarAjustes(proyectoId: number) {
    const existe = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true },
    });
    if (!existe)
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado.`);

    return this.prisma.ajusteAvance.findMany({
      where: { proyectoId },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Registra un ajuste manual. Es un EVENTO, no un valor que se sobrescribe:
   * cada uno queda con su fecha y su justificación, y ninguno reemplaza al
   * cálculo en silencio. Por eso es `create` y no `upsert`, y por eso la
   * justificación es obligatoria.
   */
  async registrarAjuste(proyectoId: number, dto: AjusteAvanceDto) {
    const existe = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true },
    });
    if (!existe)
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado.`);

    const fecha = this.aFecha(dto.fecha);
    const porcentaje = this.porcentajeValido(dto.porcentaje, 'porcentaje');

    // Un override sin justificación es exactamente lo que hay que evitar:
    // el número calculado deja de cuadrar y nadie sabe por qué.
    const observacion = this.limpiar(dto.observacion);
    if (!observacion)
      throw new BadRequestException(
        'La justificación es obligatoria: un ajuste manual sobrescribe el ' +
          'avance calculado y tiene que quedar explicado (p. ej. trabajo no ' +
          'medible en equipos: planos, permisos, materiales).',
      );

    return this.prisma.ajusteAvance.create({
      data: { proyectoId, fecha, porcentaje, observacion },
    });
  }

  async eliminarAjuste(proyectoId: number, ajusteId: number) {
    const ajuste = await this.prisma.ajusteAvance.findFirst({
      where: { id: ajusteId, proyectoId },
      select: { id: true },
    });
    if (!ajuste)
      throw new NotFoundException(
        `Ajuste ${ajusteId} no encontrado en el proyecto ${proyectoId}.`,
      );

    await this.prisma.ajusteAvance.delete({ where: { id: ajusteId } });
    return { ok: true, id: ajusteId };
  }
}
