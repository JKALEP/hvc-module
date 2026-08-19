import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoCampo } from '../../generated/prisma/enums';
import { limpiar, describir } from '../common/texto';
import { aId } from '../common/validacion';
import { OrganizacionService } from './organizacion.service';

export interface CrearCampoDto {
  organizacionId?: number | string | null;
  nombre?: string | null;
  tipo?: string | null;
  obligatorio?: boolean | null;
  /** Solo para LISTA y SELECCION_MULTIPLE. */
  opciones?: unknown;
}

export interface EditarCampoDto {
  nombre?: string | null;
  obligatorio?: boolean | null;
  activo?: boolean | null;
  orden?: number | string | null;
}

/** Los dos tipos que necesitan opciones. Un solo sitio lo sabe. */
export const TIPOS_CON_OPCIONES: TipoCampo[] = [
  TipoCampo.LISTA,
  TipoCampo.SELECCION_MULTIPLE,
];

/**
 * Los campos que cada organización configura para sus equipos.
 *
 * Es lo que hace que dar de alta un cliente nuevo no toque código: el
 * formulario de registro se arma leyendo estas definiciones en su orden.
 *
 * `activo` es visibilidad y NO borrado lógico: un campo apagado deja de
 * pedirse en el formulario, pero los valores ya capturados siguen
 * mostrándose en la ficha y contando en los reportes. Borrarlo sí se
 * lleva sus valores, y por eso solo se permite si no hay ninguno.
 */
@Injectable()
export class CampoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizaciones: OrganizacionService,
  ) {}

  /**
   * Slug estable a partir del nombre visible.
   *
   * Se genera una vez y NO se regenera al renombrar: la clave es lo que
   * referencian el historial y los reportes guardados, así que cambiarla
   * los rompería. Renombrar «Marca» a «Fabricante» deja la clave `marca`.
   */
  private aClave(nombre: string): string {
    return nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // sin tildes
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  }

  private aTipo(valor: unknown): TipoCampo {
    const s = limpiar(valor)?.toUpperCase();
    const validos = Object.values(TipoCampo) as string[];
    if (s && validos.includes(s)) return s as TipoCampo;
    throw new BadRequestException(
      `Tipo de campo inválido: "${describir(valor)}". Valores permitidos: ${validos.join(', ')}.`,
    );
  }

  /** Las etiquetas de las opciones, limpias y sin repetir. */
  private aEtiquetas(valor: unknown): string[] {
    if (!Array.isArray(valor)) return [];
    const vistas = new Set<string>();
    for (const v of valor) {
      const s = limpiar(v);
      if (s) vistas.add(s);
    }
    return [...vistas];
  }

  /** Los campos de una organización, en el orden configurado. */
  async listar(organizacionId: number, soloActivos = false) {
    await this.organizaciones.exigir(organizacionId);
    return this.prisma.definicionCampo.findMany({
      where: { organizacionId, ...(soloActivos ? { activo: true } : {}) },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      include: {
        opciones: {
          where: soloActivos ? { activo: true } : {},
          orderBy: [{ orden: 'asc' }, { id: 'asc' }],
        },
        _count: { select: { valores: true } },
      },
    });
  }

  async crear(dto: CrearCampoDto) {
    const organizacionId = aId(
      dto.organizacionId,
      'La organización indicada no es válida.',
    );
    await this.organizaciones.exigir(organizacionId);

    const nombre = limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException('El nombre del campo es obligatorio.');

    const tipo = this.aTipo(dto.tipo);
    const clave = this.aClave(nombre);
    if (!clave)
      throw new BadRequestException(
        `El nombre "${nombre}" no produce una clave válida. Usa al menos una letra o número.`,
      );

    const repetido = await this.prisma.definicionCampo.findFirst({
      where: { organizacionId, clave },
      select: { id: true, nombre: true },
    });
    if (repetido)
      throw new ConflictException(
        `Ya existe un campo equivalente a "${nombre}" (${repetido.nombre}).`,
      );

    const etiquetas = this.aEtiquetas(dto.opciones);
    if (TIPOS_CON_OPCIONES.includes(tipo) && etiquetas.length === 0)
      throw new BadRequestException(
        'Un campo de lista necesita al menos una opción.',
      );
    if (!TIPOS_CON_OPCIONES.includes(tipo) && etiquetas.length > 0)
      throw new BadRequestException(
        'Solo los campos de lista o selección múltiple admiten opciones.',
      );

    const ultimo = await this.prisma.definicionCampo.findFirst({
      where: { organizacionId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });

    return this.prisma.definicionCampo.create({
      data: {
        organizacionId,
        nombre,
        clave,
        tipo,
        obligatorio: dto.obligatorio === true,
        orden: (ultimo?.orden ?? -1) + 1,
        opciones: {
          create: etiquetas.map((etiqueta, i) => ({ etiqueta, orden: i })),
        },
      },
      include: { opciones: true },
    });
  }

  /**
   * Renombrar, reordenar, activar o cambiar la obligatoriedad.
   *
   * El TIPO no se puede cambiar: los valores ya capturados viven en la
   * columna que corresponde a ese tipo, y cambiarlo dejaría un campo de
   * texto leyendo de una columna numérica vacía. Para cambiar de tipo se
   * crea un campo nuevo.
   */
  async editar(id: number, dto: EditarCampoDto) {
    const actual = await this.exigirCampo(id);

    const data: {
      nombre?: string;
      obligatorio?: boolean;
      activo?: boolean;
      orden?: number;
    } = {};

    if ('nombre' in dto) {
      const nombre = limpiar(dto.nombre);
      if (!nombre)
        throw new BadRequestException('El nombre del campo es obligatorio.');
      data.nombre = nombre;
      // La clave NO se regenera: ver la nota de `aClave`.
    }
    if ('obligatorio' in dto && typeof dto.obligatorio === 'boolean')
      data.obligatorio = dto.obligatorio;
    if ('activo' in dto && typeof dto.activo === 'boolean')
      data.activo = dto.activo;
    if ('orden' in dto && dto.orden !== null && dto.orden !== undefined) {
      const n = Number(dto.orden);
      if (!Number.isInteger(n) || n < 0)
        throw new BadRequestException('El orden debe ser un entero positivo.');
      data.orden = n;
    }

    void actual;
    return this.prisma.definicionCampo.update({ where: { id }, data });
  }

  /** Borra el campo. Solo si ningún equipo tiene un valor suyo. */
  async eliminar(id: number) {
    const campo = await this.prisma.definicionCampo.findUnique({
      where: { id },
      select: { nombre: true, _count: { select: { valores: true } } },
    });
    if (!campo) throw new NotFoundException('Ese campo ya no existe.');

    if (campo._count.valores > 0)
      throw new BadRequestException(
        `No se puede eliminar "${campo.nombre}": ${campo._count.valores} equipo(s) tienen un valor suyo. Desactívalo en su lugar y dejará de pedirse sin perder lo capturado.`,
      );

    await this.prisma.definicionCampo.delete({ where: { id } });
    return { ok: true, id, nombre: campo.nombre };
  }

  // ── Opciones ──

  async agregarOpcion(definicionCampoId: number, valor: unknown) {
    const campo = await this.exigirCampo(definicionCampoId);
    if (!TIPOS_CON_OPCIONES.includes(campo.tipo))
      throw new BadRequestException(
        'Solo los campos de lista o selección múltiple admiten opciones.',
      );

    const etiqueta = limpiar(valor);
    if (!etiqueta)
      throw new BadRequestException('La etiqueta de la opción es obligatoria.');

    const repetida = await this.prisma.opcionCampo.findFirst({
      where: { definicionCampoId, etiqueta },
      select: { id: true },
    });
    if (repetida)
      throw new ConflictException(`"${etiqueta}" ya está en la lista.`);

    const ultima = await this.prisma.opcionCampo.findFirst({
      where: { definicionCampoId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });

    return this.prisma.opcionCampo.create({
      data: { definicionCampoId, etiqueta, orden: (ultima?.orden ?? -1) + 1 },
    });
  }

  /**
   * Borra una opción. Solo si nadie la eligió.
   *
   * Se comprueba en los dos sitios donde puede estar usada: como valor
   * de LISTA y como fila de SELECCION_MULTIPLE.
   */
  async eliminarOpcion(id: number) {
    const opcion = await this.prisma.opcionCampo.findUnique({
      where: { id },
      select: {
        etiqueta: true,
        _count: { select: { valoresDeLista: true, elegidaEn: true } },
      },
    });
    if (!opcion) throw new NotFoundException('Esa opción ya no existe.');

    const usos = opcion._count.valoresDeLista + opcion._count.elegidaEn;
    if (usos > 0)
      throw new BadRequestException(
        `No se puede eliminar "${opcion.etiqueta}": ${usos} equipo(s) la tienen elegida. Desactívala en su lugar.`,
      );

    await this.prisma.opcionCampo.delete({ where: { id } });
    return { ok: true, id, etiqueta: opcion.etiqueta };
  }

  async editarOpcion(
    id: number,
    dto: { etiqueta?: string | null; activo?: boolean | null },
  ) {
    const opcion = await this.prisma.opcionCampo.findUnique({
      where: { id },
      select: { id: true, definicionCampoId: true },
    });
    if (!opcion) throw new NotFoundException('Esa opción ya no existe.');

    const data: { etiqueta?: string; activo?: boolean } = {};
    if ('etiqueta' in dto) {
      const etiqueta = limpiar(dto.etiqueta);
      if (!etiqueta)
        throw new BadRequestException('La etiqueta es obligatoria.');
      const repetida = await this.prisma.opcionCampo.findFirst({
        where: {
          definicionCampoId: opcion.definicionCampoId,
          etiqueta,
          NOT: { id },
        },
        select: { id: true },
      });
      if (repetida)
        throw new ConflictException(`"${etiqueta}" ya está en la lista.`);
      data.etiqueta = etiqueta;
    }
    if ('activo' in dto && typeof dto.activo === 'boolean')
      data.activo = dto.activo;

    return this.prisma.opcionCampo.update({ where: { id }, data });
  }

  async exigirCampo(id: number) {
    const campo = await this.prisma.definicionCampo.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        clave: true,
        tipo: true,
        obligatorio: true,
        activo: true,
        organizacionId: true,
      },
    });
    if (!campo) throw new NotFoundException('Ese campo ya no existe.');
    return campo;
  }
}
