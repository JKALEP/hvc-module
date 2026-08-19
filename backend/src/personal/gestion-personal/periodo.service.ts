import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { TipoPersonal } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { aAnio, aMes, aTipo, aColor, COLOR_POR_TIPO } from './validacion';
import type { CrearPeriodoDto, CopiarPeriodoDto } from './dto';

/**
 * Un periodo es la lista de un mes para un tipo: año + mes + SUPERVISOR
 * o CONTRATISTA. Es la unidad que se abre, se edita, se importa y se
 * exporta.
 */
@Injectable()
export class PeriodoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Todos los periodos, para poblar los selectores de año y mes. */
  async listar(tipoCrudo?: string) {
    const tipo = tipoCrudo ? aTipo(tipoCrudo) : undefined;
    const periodos = await this.prisma.periodoPersonal.findMany({
      where: tipo ? { tipo } : {},
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
      select: {
        id: true,
        anio: true,
        mes: true,
        tipo: true,
        colorGrupo: true,
        actualizadoEn: true,
        creadoPor: { select: { id: true, nombre: true } },
        _count: { select: { grupos: true, fichas: true } },
      },
    });
    return periodos.map((p) => ({
      ...p,
      grupos: p._count.grupos,
      personas: p._count.fichas,
    }));
  }

  /**
   * El contenido completo de un periodo: grupos con su gente dentro.
   *
   * Sin paginar a propósito. El mes más grande de HVC tiene 86 personas
   * y la pantalla es una hoja de cálculo: paginarla rompería justo lo
   * que la hace útil, que es verlo todo de una.
   */
  async detalle(anioCrudo: unknown, mesCrudo: unknown, tipoCrudo: unknown) {
    const anio = aAnio(anioCrudo);
    const mes = aMes(mesCrudo);
    const tipo = aTipo(tipoCrudo);

    const periodo = await this.prisma.periodoPersonal.findUnique({
      where: { anio_mes_tipo: { anio, mes, tipo } },
      include: {
        creadoPor: { select: { id: true, nombre: true } },
        grupos: {
          orderBy: [{ orden: 'asc' }, { id: 'asc' }],
          include: {
            fichas: {
              orderBy: [{ orden: 'asc' }, { id: 'asc' }],
              include: {
                actualizadoPor: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    });

    // No es un error: la pantalla ofrece crearlo vacío o copiar del mes
    // anterior, y necesita saber si hay de dónde copiar.
    if (!periodo) {
      const anterior = await this.ultimoAnterior(anio, mes, tipo);
      return {
        existe: false as const,
        anio,
        mes,
        tipo,
        puedeCopiarDe: anterior
          ? { id: anterior.id, anio: anterior.anio, mes: anterior.mes }
          : null,
      };
    }

    return { existe: true as const, ...periodo };
  }

  /** El periodo más reciente ANTERIOR a uno dado, del mismo tipo. */
  private ultimoAnterior(anio: number, mes: number, tipo: TipoPersonal) {
    return this.prisma.periodoPersonal.findFirst({
      where: {
        tipo,
        OR: [{ anio: { lt: anio } }, { anio, mes: { lt: mes } }],
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
      select: { id: true, anio: true, mes: true },
    });
  }

  /** Periodo vacío: solo la cabecera, sin grupos. */
  async crear(usuario: UsuarioAutenticado, dto: CrearPeriodoDto) {
    const anio = aAnio(dto.anio);
    const mes = aMes(dto.mes);
    const tipo = aTipo(dto.tipo);

    const existe = await this.prisma.periodoPersonal.findUnique({
      where: { anio_mes_tipo: { anio, mes, tipo } },
      select: { id: true },
    });
    if (existe)
      throw new ConflictException(
        'Ese periodo ya existe. Ábrelo en lugar de crearlo otra vez.',
      );

    return this.prisma.periodoPersonal.create({
      data: {
        anio,
        mes,
        tipo,
        colorGrupo: aColor(dto.colorGrupo, COLOR_POR_TIPO[tipo]),
        creadoPorId: usuario.id,
      },
    });
  }

  /**
   * Clona el último periodo anterior del mismo tipo.
   *
   * Es el arranque normal de mes: la plantilla cambia poco de un mes al
   * siguiente, así que se parte de lo que había y se corrige. El origen
   * NO se toca — se leen sus filas y se insertan copias nuevas.
   */
  async copiar(usuario: UsuarioAutenticado, dto: CopiarPeriodoDto) {
    const anio = aAnio(dto.anio);
    const mes = aMes(dto.mes);
    const tipo = aTipo(dto.tipo);

    const destinoExiste = await this.prisma.periodoPersonal.findUnique({
      where: { anio_mes_tipo: { anio, mes, tipo } },
      select: { id: true },
    });
    if (destinoExiste)
      throw new ConflictException(
        'Ese periodo ya existe. Para volver a copiar, elimínalo primero.',
      );

    const origen =
      dto.desdePeriodoId !== undefined && dto.desdePeriodoId !== null
        ? await this.prisma.periodoPersonal.findUnique({
            where: { id: Number(dto.desdePeriodoId) },
            include: {
              grupos: {
                orderBy: [{ orden: 'asc' }, { id: 'asc' }],
                include: {
                  fichas: { orderBy: [{ orden: 'asc' }, { id: 'asc' }] },
                },
              },
            },
          })
        : await this.buscarAnteriorCompleto(anio, mes, tipo);

    if (!origen)
      throw new NotFoundException(
        'No hay ningún periodo anterior de ese tipo del que copiar.',
      );
    if (origen.tipo !== tipo)
      throw new BadRequestException(
        'Solo se puede copiar desde un periodo del mismo tipo.',
      );

    return this.prisma.$transaction(async (tx) => {
      const nuevo = await tx.periodoPersonal.create({
        data: {
          anio,
          mes,
          tipo,
          colorGrupo: aColor(dto.colorGrupo, origen.colorGrupo),
          creadoPorId: usuario.id,
        },
      });

      for (const grupo of origen.grupos) {
        const copia = await tx.grupoPersonal.create({
          data: {
            periodoId: nuevo.id,
            nombre: grupo.nombre,
            orden: grupo.orden,
          },
        });
        if (grupo.fichas.length === 0) continue;
        await tx.fichaPersonal.createMany({
          data: grupo.fichas.map((f) => ({
            periodoId: nuevo.id,
            grupoId: copia.id,
            orden: f.orden,
            nombres: f.nombres,
            apellidoPaterno: f.apellidoPaterno,
            apellidoMaterno: f.apellidoMaterno,
            tipoTrabajador: f.tipoTrabajador,
            paisNacimiento: f.paisNacimiento,
            tipoDocumento: f.tipoDocumento,
            numeroDocumento: f.numeroDocumento,
            sexo: f.sexo,
            fechaNacimiento: f.fechaNacimiento,
            moneda: f.moneda,
            remuneracion: f.remuneracion,
            estadoCivil: f.estadoCivil,
            sede: f.sede,
            actualizadoPorId: usuario.id,
          })),
        });
      }

      return tx.periodoPersonal.findUnique({
        where: { id: nuevo.id },
        include: { _count: { select: { grupos: true, fichas: true } } },
      });
    });
  }

  private buscarAnteriorCompleto(
    anio: number,
    mes: number,
    tipo: TipoPersonal,
  ) {
    return this.prisma.periodoPersonal.findFirst({
      where: {
        tipo,
        OR: [{ anio: { lt: anio } }, { anio, mes: { lt: mes } }],
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
      include: {
        grupos: {
          orderBy: [{ orden: 'asc' }, { id: 'asc' }],
          include: { fichas: { orderBy: [{ orden: 'asc' }, { id: 'asc' }] } },
        },
      },
    });
  }

  /** Cambia el color con el que se pintan las filas de grupo al exportar. */
  async editarColor(id: number, colorCrudo: unknown) {
    const periodo = await this.prisma.periodoPersonal.findUnique({
      where: { id },
      select: { tipo: true },
    });
    if (!periodo) throw new NotFoundException('Ese periodo ya no existe.');
    return this.prisma.periodoPersonal.update({
      where: { id },
      data: { colorGrupo: aColor(colorCrudo, COLOR_POR_TIPO[periodo.tipo]) },
    });
  }

  /** Borra el periodo entero. Sus grupos y fichas caen por Cascade. */
  async eliminar(id: number) {
    const periodo = await this.prisma.periodoPersonal.findUnique({
      where: { id },
      select: { _count: { select: { fichas: true } } },
    });
    if (!periodo) throw new NotFoundException('Ese periodo ya no existe.');
    await this.prisma.periodoPersonal.delete({ where: { id } });
    return { ok: true, id, personasEliminadas: periodo._count.fichas };
  }
}
