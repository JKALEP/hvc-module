import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TipoPersonal } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { aIdOpcional } from '../../common/validacion';
import { AsignacionService } from './asignacion.service';
import { CalculoObraService } from './calculo-obra.service';
import { aFecha, aEntero, claveFecha } from './validacion';
import type { GuardarJornadaDto, EditarJornadaDto } from './dto';

@Injectable()
export class JornadaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asignacion: AsignacionService,
    private readonly calculo: CalculoObraService,
  ) {}

  /** Ids de participantes que llegan del cliente. */
  private aFichaIds(valor: unknown): number[] {
    if (valor === undefined || valor === null) return [];
    if (!Array.isArray(valor))
      throw new BadRequestException(
        'El campo "participantes" debe ser una lista.',
      );
    const ids = valor.map((v) => {
      const n = Number(
        typeof v === 'object' && v !== null
          ? (v as { fichaPersonalId?: unknown }).fichaPersonalId
          : v,
      );
      if (!Number.isInteger(n) || n <= 0)
        throw new BadRequestException('Hay un participante con id inválido.');
      return n;
    });
    return [...new Set(ids)];
  }

  /**
   * Congela a los participantes.
   *
   * Se guarda el nombre, el documento y la empresa TAL COMO ESTÁN AHORA.
   * Editar o borrar esa ficha en Gestión de personal más adelante no
   * puede alterar lo que dice la asistencia de un día ya cerrado: la FK
   * es solo para navegar, y por eso es SetNull.
   */
  private async snapshotDe(fichaIds: number[]) {
    if (fichaIds.length === 0) return [];
    const fichas = await this.prisma.fichaPersonal.findMany({
      where: { id: { in: fichaIds } },
      select: {
        id: true,
        nombres: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        numeroDocumento: true,
        grupo: { select: { nombre: true } },
      },
    });
    if (fichas.length !== fichaIds.length)
      throw new NotFoundException(
        'Alguna de las personas seleccionadas ya no está en la lista.',
      );
    return fichas.map((f) => ({
      fichaPersonalId: f.id,
      nombreCompleto: this.asignacion.nombreDe(f),
      documento: f.numeroDocumento,
      grupoNombre: f.grupo.nombre,
    }));
  }

  /** Supervisor o apoyo del día, con su snapshot. */
  private async personaDelDia(valor: unknown, campo: string) {
    const id = aIdOpcional(valor, `El ${campo} indicado no es válido.`);
    if (id === null) return { id: null, nombre: null };
    const p = await this.asignacion.resolverPersona(
      id,
      TipoPersonal.SUPERVISOR,
    );
    return { id: p.id, nombre: p.nombreCompleto };
  }

  /**
   * Crea o reemplaza la jornada de un día.
   *
   * Es un upsert por (proyecto, fecha): la grilla guarda columna a
   * columna y volver a mandar el mismo día tiene que actualizarlo, no
   * duplicarlo. Las asistencias se reemplazan enteras — la lista que
   * llega ES la del día.
   */
  async guardar(
    usuario: UsuarioAutenticado,
    proyectoId: number,
    dto: GuardarJornadaDto,
  ) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true, supervisorFichaId: true, supervisorNombre: true },
    });
    if (!proyecto) throw new NotFoundException('Ese proyecto ya no existe.');

    const fecha = aFecha(dto.fecha, 'fecha');
    const equiposEjecutados = aEntero(
      dto.equiposEjecutados,
      'equiposEjecutados',
    );
    const equiposProgramados = aEntero(
      dto.equiposProgramados,
      'equiposProgramados',
    );
    const contratistasProgramados = aEntero(
      dto.contratistasProgramados,
      'contratistasProgramados',
    );

    // Por defecto, el supervisor fijo de la obra.
    const supervisor =
      'supervisorFichaId' in dto
        ? await this.personaDelDia(dto.supervisorFichaId, 'supervisor')
        : {
            id: proyecto.supervisorFichaId,
            nombre: proyecto.supervisorNombre,
          };
    const apoyo = await this.personaDelDia(dto.apoyoFichaId, 'apoyo');
    const participantes = await this.snapshotDe(
      this.aFichaIds(dto.participantes),
    );

    return this.prisma.$transaction(async (tx) => {
      const jornada = await tx.jornada.upsert({
        where: { proyectoId_fecha: { proyectoId, fecha } },
        create: {
          proyectoId,
          fecha,
          equiposEjecutados,
          equiposProgramados,
          contratistasProgramados,
          supervisorFichaId: supervisor.id,
          supervisorNombre: supervisor.nombre,
          apoyoFichaId: apoyo.id,
          apoyoNombre: apoyo.nombre,
          creadoPorId: usuario.id,
        },
        update: {
          equiposEjecutados,
          equiposProgramados,
          contratistasProgramados,
          supervisorFichaId: supervisor.id,
          supervisorNombre: supervisor.nombre,
          apoyoFichaId: apoyo.id,
          apoyoNombre: apoyo.nombre,
        },
      });

      await tx.asistenciaJornada.deleteMany({
        where: { jornadaId: jornada.id },
      });
      if (participantes.length > 0)
        await tx.asistenciaJornada.createMany({
          data: participantes.map((p) => ({ ...p, jornadaId: jornada.id })),
        });

      return tx.jornada.findUnique({
        where: { id: jornada.id },
        include: { asistencias: true },
      });
    });
  }

  /** Edición de una celda suelta de la grilla. */
  async editar(id: number, dto: EditarJornadaDto) {
    const jornada = await this.prisma.jornada.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!jornada) throw new NotFoundException('Esa jornada ya no existe.');

    const data: Record<string, unknown> = {};
    if ('equiposEjecutados' in dto)
      data.equiposEjecutados = aEntero(
        dto.equiposEjecutados,
        'equiposEjecutados',
      );
    if ('equiposProgramados' in dto)
      data.equiposProgramados = aEntero(
        dto.equiposProgramados,
        'equiposProgramados',
      );
    if ('contratistasProgramados' in dto)
      data.contratistasProgramados = aEntero(
        dto.contratistasProgramados,
        'contratistasProgramados',
      );
    if ('supervisorFichaId' in dto) {
      const s = await this.personaDelDia(dto.supervisorFichaId, 'supervisor');
      data.supervisorFichaId = s.id;
      data.supervisorNombre = s.nombre;
    }
    if ('apoyoFichaId' in dto) {
      const a = await this.personaDelDia(dto.apoyoFichaId, 'apoyo');
      data.apoyoFichaId = a.id;
      data.apoyoNombre = a.nombre;
    }

    if (Object.keys(data).length === 0)
      return { ok: true, id, sinCambios: true };
    return this.prisma.jornada.update({ where: { id }, data: data as never });
  }

  /** Las jornadas de un proyecto, con lo derivado ya calculado. */
  async listar(proyectoId: number) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { totalEquipos: true },
    });
    if (!proyecto) throw new NotFoundException('Ese proyecto ya no existe.');

    const jornadas = await this.prisma.jornada.findMany({
      where: { proyectoId },
      orderBy: { fecha: 'asc' },
      include: {
        asistencias: {
          orderBy: { nombreCompleto: 'asc' },
          select: {
            id: true,
            fichaPersonalId: true,
            nombreCompleto: true,
            documento: true,
            grupoNombre: true,
          },
        },
      },
    });

    const serie = this.calculo.serie(jornadas, proyecto.totalEquipos);
    const porFecha = new Map(serie.map((s) => [s.fecha, s]));

    return jornadas.map((j) => {
      const clave = claveFecha(j.fecha);
      const calculado = porFecha.get(clave);
      return {
        id: j.id,
        fecha: clave,
        equiposEjecutados: j.equiposEjecutados,
        equiposProgramados: j.equiposProgramados,
        contratistasProgramados: j.contratistasProgramados,
        supervisorFichaId: j.supervisorFichaId,
        supervisorNombre: j.supervisorNombre,
        apoyoFichaId: j.apoyoFichaId,
        apoyoNombre: j.apoyoNombre,
        asistencias: j.asistencias,
        produccion: calculado?.produccion ?? null,
        avanceAcumulado: calculado?.avanceAcumulado ?? 0,
        contratistasTrabajando: j.asistencias.length,
        calificacionProveedor: calculado?.calificacionProveedor ?? null,
      };
    });
  }

  async eliminar(id: number) {
    const jornada = await this.prisma.jornada.findUnique({
      where: { id },
      select: { fecha: true },
    });
    if (!jornada) throw new NotFoundException('Esa jornada ya no existe.');
    await this.prisma.jornada.delete({ where: { id } });
    return { ok: true, id, fecha: claveFecha(jornada.fecha) };
  }
}
