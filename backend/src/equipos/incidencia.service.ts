import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoIncidencia,
  TipoEventoHistorial,
} from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import { aId, aIdOpcional } from '../common/validacion';
import { HistorialService } from './historial.service';

export interface CrearIncidenciaDto {
  equipoId?: number | string | null;
  tipo?: string | null;
  prioridad?: string | null;
  descripcion?: string | null;
  observacion?: string | null;
  recomendacion?: string | null;
  responsableId?: number | string | null;
}

export type EditarIncidenciaDto = Partial<CrearIncidenciaDto> & {
  estado?: string | null;
};

export interface FiltrosIncidencia {
  organizacionId: number;
  equipoId?: number | null;
  estado?: string | null;
  q?: string | null;
}

/** El orden en que avanza una incidencia. Un solo sitio lo sabe. */
const ORDEN_ESTADO: EstadoIncidencia[] = [
  EstadoIncidencia.ABIERTA,
  EstadoIncidencia.EN_ATENCION,
  EstadoIncidencia.CERRADA,
];

/**
 * Las incidencias de un equipo: lo que le pasó y qué se hizo.
 *
 * `tipo` y `prioridad` son texto libre a propósito — cada organización
 * tiene su vocabulario («Tipo de atención» vs «Tipo de servicio») y HVC
 * todavía no fijó su catálogo. Cuando lo haga, migrarlos a campos
 * configurables no rompe nada de lo demás.
 *
 * La bitácora la escribe `HistorialService`, el mismo que usa el equipo:
 * cada evento cuelga de UNO de los dos, nunca de ambos, y la base lo
 * exige con un CHECK.
 */
@Injectable()
export class IncidenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historial: HistorialService,
  ) {}

  /**
   * Correlativo legible: INC-2026-001.
   *
   * Se calcula del último del año en curso. Hay una carrera teórica si
   * dos usuarios crean a la vez, pero el `@unique` de la columna la
   * corta: fallaría la segunda con un 409 en vez de duplicar el código.
   */
  private async siguienteCodigo(): Promise<string> {
    const anio = new Date().getFullYear();
    const prefijo = `INC-${anio}-`;
    const ultima = await this.prisma.incidencia.findFirst({
      where: { codigo: { startsWith: prefijo } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });
    const n = ultima ? Number(ultima.codigo.slice(prefijo.length)) + 1 : 1;
    return `${prefijo}${String(n).padStart(3, '0')}`;
  }

  private aEstado(valor: unknown): EstadoIncidencia {
    const s = limpiar(valor)?.toUpperCase();
    const validos = Object.values(EstadoIncidencia) as string[];
    if (s && validos.includes(s)) return s as EstadoIncidencia;
    throw new BadRequestException(
      `Estado inválido: "${describir(valor)}". Valores permitidos: ${validos.join(', ')}.`,
    );
  }

  /** El equipo existe; se devuelve con su organización para filtrar. */
  private async exigirEquipo(id: number) {
    const equipo = await this.prisma.equipo.findUnique({
      where: { id },
      select: { id: true, codigoInterno: true, organizacionId: true },
    });
    if (!equipo) throw new NotFoundException('Ese equipo ya no existe.');
    return equipo;
  }

  /** Las incidencias de una organización, con sus filtros. */
  async listar(filtros: FiltrosIncidencia) {
    const q = limpiar(filtros.q);
    return this.prisma.incidencia.findMany({
      where: {
        equipo: { organizacionId: filtros.organizacionId },
        ...(filtros.equipoId ? { equipoId: filtros.equipoId } : {}),
        ...(filtros.estado ? { estado: this.aEstado(filtros.estado) } : {}),
        ...(q
          ? {
              OR: [
                { codigo: { contains: q, mode: 'insensitive' } },
                { descripcion: { contains: q, mode: 'insensitive' } },
                { tipo: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      // Abiertas primero, y dentro de cada estado lo más reciente arriba:
      // lo que falta por atender es lo que hay que ver.
      orderBy: [{ estado: 'asc' }, { creadoEn: 'desc' }],
      include: {
        equipo: {
          select: {
            id: true,
            codigoInterno: true,
            nodo: { select: { nombre: true } },
          },
        },
        responsable: { select: { id: true, nombre: true } },
        _count: {
          select: { fotos: true, cotizaciones: true, ordenesCompra: true },
        },
      },
      take: 300,
    });
  }

  async detalle(id: number) {
    const incidencia = await this.prisma.incidencia.findUnique({
      where: { id },
      include: {
        equipo: {
          select: {
            id: true,
            codigoInterno: true,
            organizacionId: true,
            nodo: { select: { id: true, nombre: true } },
          },
        },
        responsable: { select: { id: true, nombre: true } },
        creadoPor: { select: { id: true, nombre: true } },
        _count: {
          select: { fotos: true, cotizaciones: true, ordenesCompra: true },
        },
      },
    });
    if (!incidencia)
      throw new NotFoundException('Esa incidencia ya no existe.');
    return incidencia;
  }

  async crear(usuario: UsuarioAutenticado, dto: CrearIncidenciaDto) {
    const equipoId = aId(dto.equipoId, 'El equipo indicado no es válido.');
    await this.exigirEquipo(equipoId);

    const tipo = limpiar(dto.tipo);
    if (!tipo)
      throw new BadRequestException('El tipo de incidencia es obligatorio.');
    const descripcion = limpiar(dto.descripcion);
    if (!descripcion)
      throw new BadRequestException('La descripción es obligatoria.');

    const responsableId = aIdOpcional(
      dto.responsableId,
      'El responsable indicado no es válido.',
    );

    const codigo = await this.siguienteCodigo();

    return this.prisma.$transaction(async (tx) => {
      const incidencia = await tx.incidencia.create({
        data: {
          codigo,
          equipoId,
          tipo,
          prioridad: limpiar(dto.prioridad) ?? null,
          descripcion,
          observacion: limpiar(dto.observacion) ?? null,
          recomendacion: limpiar(dto.recomendacion) ?? null,
          responsableId,
          creadoPorId: usuario.id,
        },
      });

      // Dos eventos: uno en la incidencia y otro en el equipo. El del
      // equipo es lo que permite ver en su ficha «aquí pasó algo» sin
      // tener que abrir la lista de incidencias.
      await this.historial.registrar(tx, [
        {
          incidenciaId: incidencia.id,
          tipo: TipoEventoHistorial.CREACION,
          usuarioId: usuario.id,
          descripcion: `${codigo} abierta: ${tipo}.`,
        },
        {
          equipoId,
          tipo: TipoEventoHistorial.RELACION_INCIDENCIA,
          usuarioId: usuario.id,
          descripcion: `Se abrió la incidencia ${codigo} (${tipo}).`,
        },
      ]);

      return incidencia;
    });
  }

  /**
   * Edita campos y/o cambia el estado.
   *
   * El cierre no se pide aparte: mandar `estado: CERRADA` sella la fecha
   * de cierre, y reabrir la borra. Tener un endpoint «cerrar» además del
   * de editar daría dos caminos para el mismo cambio y uno de los dos
   * acabaría olvidándose de la fecha.
   */
  async editar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: EditarIncidenciaDto,
  ) {
    const actual = await this.prisma.incidencia.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        equipoId: true,
        tipo: true,
        prioridad: true,
        descripcion: true,
        observacion: true,
        recomendacion: true,
        responsableId: true,
        estado: true,
      },
    });
    if (!actual) throw new NotFoundException('Esa incidencia ya no existe.');

    const data: Record<string, unknown> = {};
    const eventos: Parameters<HistorialService['registrar']>[1] = [];

    const textos = [
      ['tipo', 'Tipo'],
      ['prioridad', 'Prioridad'],
      ['descripcion', 'Descripción'],
      ['observacion', 'Observación'],
      ['recomendacion', 'Recomendación'],
    ] as const;

    for (const [clave, etiqueta] of textos) {
      if (!(clave in dto)) continue;
      const valor = limpiar(dto[clave]);
      if ((clave === 'tipo' || clave === 'descripcion') && !valor)
        throw new BadRequestException(`${etiqueta} es obligatorio.`);
      const anterior = actual[clave];
      if ((valor ?? null) === anterior) continue;
      data[clave] = valor ?? null;
      eventos.push({
        incidenciaId: id,
        tipo: TipoEventoHistorial.CAMBIO_CAMPO,
        usuarioId: usuario.id,
        campoAfectado: clave,
        valorAnterior: anterior,
        valorNuevo: valor ?? null,
      });
    }

    if ('responsableId' in dto) {
      const nuevo = aIdOpcional(
        dto.responsableId,
        'El responsable indicado no es válido.',
      );
      if (nuevo !== actual.responsableId) {
        data.responsableId = nuevo;
        const [antes, despues] = await Promise.all([
          this.nombreDeUsuario(actual.responsableId),
          this.nombreDeUsuario(nuevo),
        ]);
        eventos.push({
          incidenciaId: id,
          tipo: TipoEventoHistorial.CAMBIO_CAMPO,
          usuarioId: usuario.id,
          campoAfectado: 'responsable',
          valorAnterior: antes,
          valorNuevo: despues,
        });
      }
    }

    if ('estado' in dto && dto.estado !== null && dto.estado !== undefined) {
      const estado = this.aEstado(dto.estado);
      if (estado !== actual.estado) {
        data.estado = estado;
        // La fecha de cierre la pone el sistema, no el usuario: es
        // cuándo pasó, no cuándo alguien dice que pasó.
        data.fechaCierre =
          estado === EstadoIncidencia.CERRADA ? new Date() : null;
        eventos.push({
          incidenciaId: id,
          tipo: TipoEventoHistorial.CAMBIO_ESTADO,
          usuarioId: usuario.id,
          valorAnterior: actual.estado,
          valorNuevo: estado,
        });
        eventos.push({
          equipoId: actual.equipoId,
          tipo: TipoEventoHistorial.CAMBIO_ESTADO,
          usuarioId: usuario.id,
          descripcion: `${actual.codigo} pasó a ${estado.replace('_', ' ').toLowerCase()}.`,
        });
      }
    }

    if (Object.keys(data).length === 0) return { ...actual, sinCambios: true };

    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.incidencia.update({
        where: { id },
        data: data as never,
      });
      await this.historial.registrar(tx, eventos);
      return actualizada;
    });
  }

  private async nombreDeUsuario(id: number | null): Promise<string | null> {
    if (id === null) return null;
    const u = await this.prisma.usuario.findUnique({
      where: { id },
      select: { nombre: true },
    });
    return u?.nombre ?? null;
  }

  /** Borra la incidencia con sus fotos y su historial. */
  async eliminar(id: number) {
    const incidencia = await this.prisma.incidencia.findUnique({
      where: { id },
      select: {
        codigo: true,
        _count: { select: { cotizaciones: true, ordenesCompra: true } },
      },
    });
    if (!incidencia)
      throw new NotFoundException('Esa incidencia ya no existe.');

    const atada =
      incidencia._count.cotizaciones + incidencia._count.ordenesCompra;
    if (atada > 0)
      throw new BadRequestException(
        `No se puede eliminar ${incidencia.codigo}: tiene ${atada} cotización(es) u orden(es) de compra asociadas.`,
      );

    await this.prisma.incidencia.delete({ where: { id } });
    return { ok: true, id, codigo: incidencia.codigo };
  }

  /** El siguiente estado del flujo, para el botón de avanzar. */
  siguienteEstado(estado: EstadoIncidencia): EstadoIncidencia | null {
    const i = ORDEN_ESTADO.indexOf(estado);
    return i >= 0 && i < ORDEN_ESTADO.length - 1 ? ORDEN_ESTADO[i + 1] : null;
  }

  /** La bitácora de la incidencia. */
  historialDe(id: number) {
    return this.historial.deIncidencia(id);
  }
}
