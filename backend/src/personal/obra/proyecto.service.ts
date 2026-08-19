import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TipoPersonal } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { aId, aIdOpcional } from '../../common/validacion';
import { CarpetaService } from './carpeta.service';
import { AsignacionService } from './asignacion.service';
import { CalculoObraService } from './calculo-obra.service';
import { aFecha, aTexto, aEnteroPositivo, claveFecha } from './validacion';
import type { CrearProyectoDto, EditarProyectoDto } from './dto';

@Injectable()
export class ProyectoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carpetas: CarpetaService,
    private readonly asignacion: AsignacionService,
    private readonly calculo: CalculoObraService,
  ) {}

  /** Lo que hace falta de cada jornada para calcular avance y serie. */
  private get selectJornadas() {
    return {
      orderBy: { fecha: 'asc' as const },
      select: {
        fecha: true,
        equiposEjecutados: true,
        equiposProgramados: true,
        contratistasProgramados: true,
        asistencias: { select: { id: true } },
      },
    };
  }

  /**
   * Valida el DTO contra las listas SCTR y arma los snapshots.
   *
   * El periodo del que salen encargado y supervisor lo determina la
   * FECHA DE INICIO, no el calendario de hoy: crear en diciembre una
   * obra que arrancó en marzo debe ofrecer la gente de marzo.
   */
  private async normalizar(dto: CrearProyectoDto) {
    const nombre = aTexto(dto.nombre, 'nombre');
    const sede = aTexto(dto.sede, 'sede');
    const fechaInicio = aFecha(dto.fechaInicio, 'fechaInicio');
    const fechaFinPrevista = aFecha(dto.fechaFinPrevista, 'fechaFinPrevista');
    const totalEquipos = aEnteroPositivo(dto.totalEquipos, 'totalEquipos');

    if (fechaFinPrevista < fechaInicio)
      throw new BadRequestException(
        'La fecha de fin prevista no puede ser anterior a la de inicio.',
      );

    const carpetaId = aIdOpcional(dto.carpetaId, 'La carpeta no es válida.');
    if (carpetaId !== null) await this.carpetas.exigir(carpetaId);

    const empresa = await this.asignacion.resolverEmpresa(
      aId(dto.encargadoGrupoId, 'Debes elegir la empresa encargada.'),
    );
    const supervisor = await this.asignacion.resolverPersona(
      aId(dto.supervisorFichaId, 'Debes elegir el supervisor.'),
      TipoPersonal.SUPERVISOR,
    );

    const apoyoId = aIdOpcional(dto.apoyoFichaId, 'El apoyo no es válido.');
    const apoyo =
      apoyoId === null
        ? null
        : await this.asignacion.resolverPersona(
            apoyoId,
            TipoPersonal.SUPERVISOR,
          );

    return {
      nombre,
      carpetaId,
      sede,
      fechaInicio,
      fechaFinPrevista,
      totalEquipos,
      encargadoGrupoId: empresa.id,
      encargadoNombre: empresa.nombre,
      supervisorFichaId: supervisor.id,
      supervisorNombre: supervisor.nombreCompleto,
      supervisorDocumento: supervisor.documento,
      apoyoFichaId: apoyo?.id ?? null,
      apoyoNombre: apoyo?.nombreCompleto ?? null,
      apoyoDocumento: apoyo?.documento ?? null,
    };
  }

  async crear(usuario: UsuarioAutenticado, dto: CrearProyectoDto) {
    const datos = await this.normalizar(dto);
    return this.prisma.proyecto.create({
      data: { ...datos, creadoPorId: usuario.id },
    });
  }

  /**
   * Edición parcial. Cambiar el encargado o el supervisor rehace su
   * snapshot: es una reasignación explícita, que es justo lo que debe
   * costar un clic y no pasar solo porque cambió la planilla del mes.
   */
  async editar(id: number, dto: EditarProyectoDto) {
    const actual = await this.prisma.proyecto.findUnique({
      where: { id },
      select: { id: true, fechaInicio: true, fechaFinPrevista: true },
    });
    if (!actual) throw new NotFoundException('Ese proyecto ya no existe.');

    const data: Record<string, unknown> = {};

    if ('nombre' in dto) data.nombre = aTexto(dto.nombre, 'nombre');
    if ('sede' in dto) data.sede = aTexto(dto.sede, 'sede');
    if ('totalEquipos' in dto)
      data.totalEquipos = aEnteroPositivo(dto.totalEquipos, 'totalEquipos');

    if ('carpetaId' in dto) {
      const carpetaId = aIdOpcional(dto.carpetaId, 'La carpeta no es válida.');
      if (carpetaId !== null) await this.carpetas.exigir(carpetaId);
      data.carpetaId = carpetaId;
    }

    const inicio =
      'fechaInicio' in dto
        ? aFecha(dto.fechaInicio, 'fechaInicio')
        : actual.fechaInicio;
    const fin =
      'fechaFinPrevista' in dto
        ? aFecha(dto.fechaFinPrevista, 'fechaFinPrevista')
        : actual.fechaFinPrevista;
    if (fin < inicio)
      throw new BadRequestException(
        'La fecha de fin prevista no puede ser anterior a la de inicio.',
      );
    if ('fechaInicio' in dto) data.fechaInicio = inicio;
    if ('fechaFinPrevista' in dto) data.fechaFinPrevista = fin;

    if ('encargadoGrupoId' in dto) {
      const e = await this.asignacion.resolverEmpresa(
        aId(dto.encargadoGrupoId, 'La empresa encargada no es válida.'),
      );
      data.encargadoGrupoId = e.id;
      data.encargadoNombre = e.nombre;
    }

    if ('supervisorFichaId' in dto) {
      const s = await this.asignacion.resolverPersona(
        aId(dto.supervisorFichaId, 'El supervisor no es válido.'),
        TipoPersonal.SUPERVISOR,
      );
      data.supervisorFichaId = s.id;
      data.supervisorNombre = s.nombreCompleto;
      data.supervisorDocumento = s.documento;
    }

    if ('apoyoFichaId' in dto) {
      const apoyoId = aIdOpcional(dto.apoyoFichaId, 'El apoyo no es válido.');
      if (apoyoId === null) {
        data.apoyoFichaId = null;
        data.apoyoNombre = null;
        data.apoyoDocumento = null;
      } else {
        const a = await this.asignacion.resolverPersona(
          apoyoId,
          TipoPersonal.SUPERVISOR,
        );
        data.apoyoFichaId = a.id;
        data.apoyoNombre = a.nombreCompleto;
        data.apoyoDocumento = a.documento;
      }
    }

    return this.prisma.proyecto.update({ where: { id }, data: data as never });
  }

  /** Ficha completa: cabecera con vigencia, serie y avance. */
  async detalle(id: number) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
      include: {
        carpeta: { select: { id: true, nombre: true, ruta: true } },
        jornadas: this.selectJornadas,
      },
    });
    if (!proyecto) throw new NotFoundException('Ese proyecto ya no existe.');

    const serie = this.calculo.serie(proyecto.jornadas, proyecto.totalEquipos);
    const avance = this.calculo.avanceTotal(
      proyecto.jornadas,
      proyecto.totalEquipos,
    );

    const [vigenciaSupervisor, vigenciaApoyo, vigenciaEmpresa] =
      await Promise.all([
        this.asignacion.vigenciaPersona(
          proyecto.supervisorDocumento,
          TipoPersonal.SUPERVISOR,
        ),
        this.asignacion.vigenciaPersona(
          proyecto.apoyoDocumento,
          TipoPersonal.SUPERVISOR,
        ),
        this.asignacion.vigenciaEmpresa(proyecto.encargadoNombre),
      ]);

    const camino = proyecto.carpetaId
      ? await this.carpetas.camino(proyecto.carpetaId)
      : [];

    return {
      ...proyecto,
      jornadas: undefined,
      camino,
      avance,
      estado: this.calculo.estado(avance),
      ...this.calculo.atraso(
        proyecto.fechaInicio,
        proyecto.fechaFinPrevista,
        avance,
      ),
      serie,
      vigencia: {
        supervisor: vigenciaSupervisor,
        apoyo: vigenciaApoyo,
        encargado: vigenciaEmpresa,
      },
    };
  }

  /**
   * Los proyectos de una carpeta (o de la raíz), con lo que necesita la
   * tarjeta: avance, estado, atraso y la línea de tendencia.
   */
  async listarEn(carpetaId: number | null) {
    const proyectos = await this.prisma.proyecto.findMany({
      where: { carpetaId },
      orderBy: [{ nombre: 'asc' }],
      include: { jornadas: this.selectJornadas },
    });

    return proyectos.map((p) => {
      const serie = this.calculo.serie(p.jornadas, p.totalEquipos);
      const avance = this.calculo.avanceTotal(p.jornadas, p.totalEquipos);
      return {
        id: p.id,
        nombre: p.nombre,
        sede: p.sede,
        carpetaId: p.carpetaId,
        encargadoNombre: p.encargadoNombre,
        supervisorNombre: p.supervisorNombre,
        fechaInicio: claveFecha(p.fechaInicio),
        fechaFinPrevista: claveFecha(p.fechaFinPrevista),
        totalEquipos: p.totalEquipos,
        avance,
        estado: this.calculo.estado(avance),
        ...this.calculo.atraso(p.fechaInicio, p.fechaFinPrevista, avance),
        // Solo el avance acumulado: la tarjeta dibuja una línea sin ejes.
        tendencia: serie.map((s) => s.avanceAcumulado),
        jornadas: serie.length,
      };
    });
  }

  /** Borra la obra y, con ella, sus jornadas y asistencias. */
  async eliminar(id: number) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
      select: { nombre: true, _count: { select: { jornadas: true } } },
    });
    if (!proyecto) throw new NotFoundException('Ese proyecto ya no existe.');
    await this.prisma.proyecto.delete({ where: { id } });
    return {
      ok: true,
      id,
      nombre: proyecto.nombre,
      jornadasEliminadas: proyecto._count.jornadas,
    };
  }
}
