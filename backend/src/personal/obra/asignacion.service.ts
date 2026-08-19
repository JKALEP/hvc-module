import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TipoPersonal } from '../../../generated/prisma/enums';
import type { Vigencia } from './dto';

/**
 * De dónde salen las personas y las empresas de una obra.
 *
 * Todo viene de las listas SCTR: un supervisor es una `FichaPersonal` de
 * un periodo SUPERVISOR, y una empresa encargada es un `GrupoPersonal`
 * de un periodo CONTRATISTA. Este módulo no tiene tablas propias de
 * gente.
 *
 * Dos reglas que conviene tener juntas:
 *
 * — **Qué periodo se usa.** El que corresponde a una FECHA, no "el más
 *   reciente". Para el encargado y el supervisor del proyecto, la fecha
 *   de inicio de la obra; para los participantes de un día, la fecha de
 *   esa jornada. Así, registrar hoy una jornada de marzo ofrece a la
 *   gente que estaba en marzo.
 *
 * — **Qué se guarda.** La FK sirve para navegar; lo que se muestra es el
 *   snapshot del nombre. La vigencia frente al periodo actual se calcula
 *   aquí, en lectura, y no se almacena en ninguna columna.
 */
@Injectable()
export class AsignacionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * El periodo que cubre una fecha: el más reciente que no sea
   * posterior a ella. Si la fecha es anterior a todo lo cargado, se cae
   * al más antiguo que exista — es mejor ofrecer la lista más cercana
   * que no ofrecer ninguna.
   */
  async periodoPara(fecha: Date, tipo: TipoPersonal) {
    const anio = fecha.getUTCFullYear();
    const mes = fecha.getUTCMonth() + 1;

    const cubre = await this.prisma.periodoPersonal.findFirst({
      where: {
        tipo,
        OR: [{ anio: { lt: anio } }, { anio, mes: { lte: mes } }],
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
      select: { id: true, anio: true, mes: true },
    });
    if (cubre) return cubre;

    return this.prisma.periodoPersonal.findFirst({
      where: { tipo },
      orderBy: [{ anio: 'asc' }, { mes: 'asc' }],
      select: { id: true, anio: true, mes: true },
    });
  }

  /** El periodo vigente hoy. Contra éste se mide si una asignación sigue viva. */
  private periodoActual(tipo: TipoPersonal) {
    return this.periodoPara(new Date(), tipo);
  }

  /**
   * Empresas contratistas que se pueden elegir como encargadas para una
   * fecha dada.
   */
  async empresasPara(fecha: Date) {
    const periodo = await this.periodoPara(fecha, TipoPersonal.CONTRATISTA);
    if (!periodo) return { periodo: null, empresas: [] };

    const empresas = await this.prisma.grupoPersonal.findMany({
      where: { periodoId: periodo.id },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        _count: { select: { fichas: true } },
      },
    });
    return {
      periodo,
      empresas: empresas.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        personas: e._count.fichas,
      })),
    };
  }

  /**
   * Personas elegibles para una fecha. Sin restricción de empresa: el
   * buscador de participantes es abierto a propósito, porque a una obra
   * puede venir gente de cualquier contrata.
   */
  async personasPara(fecha: Date, tipo: TipoPersonal, busqueda?: string) {
    const periodo = await this.periodoPara(fecha, tipo);
    if (!periodo) return { periodo: null, personas: [] };

    const q = busqueda?.trim();
    const fichas = await this.prisma.fichaPersonal.findMany({
      where: {
        periodoId: periodo.id,
        ...(q
          ? {
              OR: [
                { nombres: { contains: q, mode: 'insensitive' } },
                { apellidoPaterno: { contains: q, mode: 'insensitive' } },
                { apellidoMaterno: { contains: q, mode: 'insensitive' } },
                { numeroDocumento: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ apellidoPaterno: 'asc' }, { nombres: 'asc' }],
      select: {
        id: true,
        nombres: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        numeroDocumento: true,
        grupo: { select: { id: true, nombre: true } },
      },
      take: 300,
    });

    return {
      periodo,
      personas: fichas.map((f) => ({
        id: f.id,
        nombreCompleto: this.nombreDe(f),
        documento: f.numeroDocumento,
        grupoId: f.grupo.id,
        grupoNombre: f.grupo.nombre,
      })),
    };
  }

  /** «APELLIDOS, Nombres» — un solo sitio arma el nombre visible. */
  nombreDe(f: {
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
  }): string {
    const apellidos = [f.apellidoPaterno, f.apellidoMaterno]
      .filter(Boolean)
      .join(' ');
    return `${apellidos}, ${f.nombres}`;
  }

  /**
   * Resuelve una ficha para guardarla como asignación: devuelve la FK y
   * el snapshot que la acompaña.
   */
  async resolverPersona(fichaId: number, tipoEsperado: TipoPersonal) {
    const ficha = await this.prisma.fichaPersonal.findUnique({
      where: { id: fichaId },
      select: {
        id: true,
        nombres: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        numeroDocumento: true,
        grupo: { select: { id: true, nombre: true } },
        periodo: { select: { tipo: true, anio: true, mes: true } },
      },
    });
    if (!ficha)
      throw new NotFoundException('Esa persona ya no está en la lista.');
    if (ficha.periodo.tipo !== tipoEsperado)
      throw new BadRequestException(
        tipoEsperado === TipoPersonal.SUPERVISOR
          ? 'Esa persona no pertenece a una lista de supervisores.'
          : 'Esa persona no pertenece a una lista de contratistas.',
      );

    return {
      id: ficha.id,
      nombreCompleto: this.nombreDe(ficha),
      documento: ficha.numeroDocumento,
      grupoNombre: ficha.grupo.nombre,
    };
  }

  /** Igual, para la empresa encargada. */
  async resolverEmpresa(grupoId: number) {
    const grupo = await this.prisma.grupoPersonal.findUnique({
      where: { id: grupoId },
      select: {
        id: true,
        nombre: true,
        periodo: { select: { tipo: true } },
      },
    });
    if (!grupo) throw new NotFoundException('Esa empresa ya no existe.');
    if (grupo.periodo.tipo !== TipoPersonal.CONTRATISTA)
      throw new BadRequestException(
        'El encargado debe ser una empresa contratista, no un área.',
      );
    return { id: grupo.id, nombre: grupo.nombre };
  }

  /**
   * ¿La persona sigue figurando en la lista vigente?
   *
   * Se busca por DOCUMENTO y no por id: al copiar un mes se crean filas
   * nuevas, así que el id no sobrevive entre periodos y el documento sí.
   */
  async vigenciaPersona(
    documento: string | null,
    tipo: TipoPersonal,
  ): Promise<Vigencia> {
    const periodo = await this.periodoActual(tipo);
    if (!periodo || !documento) return { vigente: false, periodo };
    const existe = await this.prisma.fichaPersonal.findFirst({
      where: { periodoId: periodo.id, numeroDocumento: documento },
      select: { id: true },
    });
    return {
      vigente: existe !== null,
      periodo: { anio: periodo.anio, mes: periodo.mes },
    };
  }

  /** Lo mismo para la empresa, que sí se identifica por nombre. */
  async vigenciaEmpresa(nombre: string | null): Promise<Vigencia> {
    const periodo = await this.periodoActual(TipoPersonal.CONTRATISTA);
    if (!periodo || !nombre) return { vigente: false, periodo };
    const existe = await this.prisma.grupoPersonal.findFirst({
      where: { periodoId: periodo.id, nombre },
      select: { id: true },
    });
    return {
      vigente: existe !== null,
      periodo: { anio: periodo.anio, mes: periodo.mes },
    };
  }
}
