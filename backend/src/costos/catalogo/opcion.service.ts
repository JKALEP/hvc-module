import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TipoCatalogo } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { limpiar, describir } from '../../common/texto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { aTexto, aOrden, aEstadoCatalogo, exigirSinUso } from '../validacion';
import type { GuardarOpcionDto, EditarOpcionDto } from './dto';

/**
 * Los catálogos configurables de §58: tipos de mantenimiento, tipos de
 * requerimiento y unidades de medida.
 *
 * UN service para los tres, igual que una sola tabla: tienen la misma
 * forma y ninguna reglas propias. Lo único que cambia es el valor de
 * `tipo`, y eso es un parámetro, no una rama.
 *
 * Son catálogos y no enums porque §58 lo exige: «no utilizar enums
 * rígidos para valores que el negocio necesita modificar». Añadir
 * «Predictivo» a los tipos de mantenimiento no puede ser una migración.
 */
@Injectable()
export class OpcionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private aTipo(valor: unknown): TipoCatalogo {
    const s = limpiar(valor)?.toUpperCase();
    const validos = Object.values(TipoCatalogo) as string[];
    if (s && validos.includes(s)) return s as TipoCatalogo;
    throw new BadRequestException(
      `Tipo de catálogo inválido: "${describir(valor)}". ` +
        `Valores permitidos: ${validos.join(', ')}.`,
    );
  }

  /**
   * Lista un catálogo entero, o todos si no se acota.
   *
   * `soloActivas` es lo que pide un selector; la pantalla de
   * administración las quiere todas, incluidas las retiradas.
   */
  async listar(filtros: { tipo?: string; soloActivas?: boolean }) {
    const tipo = limpiar(filtros.tipo) ? this.aTipo(filtros.tipo) : undefined;

    return this.prisma.opcionCatalogo.findMany({
      where: {
        ...(tipo ? { tipo } : {}),
        ...(filtros.soloActivas ? { estado: 'ACTIVO' } : {}),
      },
      orderBy: [{ tipo: 'asc' }, { orden: 'asc' }, { valor: 'asc' }],
    });
  }

  /**
   * Exige que la opción exista, sea del catálogo correcto y esté activa.
   *
   * La usa el requerimiento para validar los dos selectores de §13, en
   * vez de repetir la consulta: quién decide si una opción se puede
   * elegir es este service, y una segunda comprobación suelta acabaría
   * discrepando el día que se añada una regla.
   *
   * Comprueba el TIPO además del id porque los tres catálogos comparten
   * tabla: sin eso, mandar el id de «UND» como tipo de mantenimiento
   * pasaría, y el requerimiento quedaría con un snapshot absurdo.
   */
  async exigirActiva(id: number, tipo: TipoCatalogo) {
    const opcion = await this.prisma.opcionCatalogo.findUnique({
      where: { id },
      select: { id: true, tipo: true, valor: true, estado: true },
    });

    if (!opcion || opcion.tipo !== tipo)
      throw new BadRequestException(
        `La opción ${id} no existe en el catálogo ${tipo}.`,
      );

    if (opcion.estado !== 'ACTIVO')
      throw new BadRequestException(
        `"${opcion.valor}" está desactivado y ya no se puede elegir.`,
      );

    return opcion;
  }

  async crear(usuario: UsuarioAutenticado, dto: GuardarOpcionDto) {
    const tipo = this.aTipo(dto.tipo);
    const valor = aTexto(dto.valor, 'El valor');
    const orden = aOrden(dto.orden);
    const estado = dto.estado ? aEstadoCatalogo(dto.estado) : 'ACTIVO';

    const repetido = await this.prisma.opcionCatalogo.findUnique({
      where: { tipo_valor: { tipo, valor } },
      select: { id: true },
    });
    if (repetido)
      throw new ConflictException(`Ya existe "${valor}" en ese catálogo.`);

    const opcion = await this.prisma.opcionCatalogo.create({
      data: { tipo, valor, orden, estado },
    });

    await this.auditoria.registrarUno(usuario, {
      entidad: 'CATALOGO',
      entidadId: opcion.id,
      accion: 'CREACION',
      descripcion: `Se creó "${valor}" en ${tipo}.`,
    });

    return opcion;
  }

  /**
   * Edita valor, orden y estado. El TIPO no se toca: cambiarlo movería la
   * opción a otro catálogo, y las filas que ya la referencian —un
   * requerimiento que la eligió como tipo de mantenimiento— pasarían a
   * apuntar a algo que ya no significa lo mismo.
   */
  async editar(usuario: UsuarioAutenticado, id: number, dto: EditarOpcionDto) {
    const actual = await this.prisma.opcionCatalogo.findUnique({
      where: { id },
    });
    if (!actual) throw new NotFoundException('Esa opción ya no existe.');

    const data: {
      valor?: string;
      orden?: number;
      estado?: 'ACTIVO' | 'INACTIVO';
    } = {};

    if ('valor' in dto) {
      const valor = aTexto(dto.valor, 'El valor');
      if (valor !== actual.valor) {
        const repetido = await this.prisma.opcionCatalogo.findUnique({
          where: { tipo_valor: { tipo: actual.tipo, valor } },
          select: { id: true },
        });
        if (repetido)
          throw new ConflictException(`Ya existe "${valor}" en ese catálogo.`);
      }
      data.valor = valor;
    }
    if ('orden' in dto) data.orden = aOrden(dto.orden);
    if ('estado' in dto) data.estado = aEstadoCatalogo(dto.estado);

    if (Object.keys(data).length === 0) return actual;

    const opcion = await this.prisma.opcionCatalogo.update({
      where: { id },
      data,
    });

    // El requerimiento guarda un SNAPSHOT del nombre, así que renombrar
    // aquí no reescribe los ya emitidos. Queda en la bitácora para que se
    // entienda por qué un requerimiento viejo dice otra cosa.
    await this.auditoria.registrar(
      usuario,
      this.auditoria.diferencias(
        {
          valor: actual.valor,
          orden: String(actual.orden),
          estado: actual.estado,
        },
        {
          valor: opcion.valor,
          orden: String(opcion.orden),
          estado: opcion.estado,
        },
        { entidad: 'CATALOGO', entidadId: id },
      ),
    );

    return opcion;
  }

  /**
   * Borra una opción que nadie usa.
   *
   * Si algún requerimiento la eligió, se rechaza y se ofrece desactivar:
   * la FK es RESTRICT y, sobre todo, retirar un valor del catálogo no
   * puede reescribir lo que ya se registró con él.
   *
   * ── Las unidades hay que contarlas a mano ────────────────────────────
   * Los dos tipos de catálogo que el requerimiento elige por FK
   * —mantenimiento y tipo— los protege la propia relación, y `_count` los
   * ve. La UNIDAD no: `RequerimientoItem.unidad` guarda TEXTO, no una
   * referencia, así que ninguna unidad estaba «en uso» jamás y todas eran
   * borrables sin aviso. Se contaba con que la FK avisara y aquí no hay
   * FK que avise.
   *
   * Se compara por texto exacto, que es como se guardó: el ítem copió el
   * valor del catálogo tal cual en el momento de crearse.
   *
   * Lo que NO se cuenta son las líneas de cotización ni los ítems de
   * costo, que también llevan `unidad` como texto. Son SNAPSHOTS
   * históricos (§53): existen precisamente para sobrevivir a que el
   * catálogo cambie, así que bloquear por ellos sería congelar el
   * catálogo para siempre. Lo que se protege es lo vivo — lo que aún se
   * está pidiendo—.
   */
  async eliminar(usuario: UsuarioAutenticado, id: number) {
    const opcion = await this.prisma.opcionCatalogo.findUnique({
      where: { id },
      select: {
        id: true,
        tipo: true,
        valor: true,
        _count: {
          select: {
            requerimientosPorMantenimiento: true,
            requerimientosPorTipo: true,
          },
        },
      },
    });
    if (!opcion) throw new NotFoundException('Esa opción ya no existe.');

    const usos = [
      {
        cuantos:
          opcion._count.requerimientosPorMantenimiento +
          opcion._count.requerimientosPorTipo,
        que: 'requerimiento(s)',
      },
    ];

    if (opcion.tipo === 'UNIDAD_MEDIDA')
      usos.push({
        cuantos: await this.prisma.requerimientoItem.count({
          where: { unidad: opcion.valor },
        }),
        que: 'ítem(s) de requerimiento',
      });

    exigirSinUso(usos, `"${opcion.valor}"`);

    await this.prisma.opcionCatalogo.delete({ where: { id } });

    await this.auditoria.registrarUno(usuario, {
      entidad: 'CATALOGO',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: `Se eliminó "${opcion.valor}" de ${opcion.tipo}.`,
    });

    return { ok: true, id };
  }
}
