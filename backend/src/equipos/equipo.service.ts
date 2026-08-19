import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoEventoHistorial } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar } from '../common/texto';
import { aId } from '../common/validacion';
import { OrganizacionService } from './organizacion.service';
import { ValorCampoService } from './valor-campo.service';
import { HistorialService, type Instantanea } from './historial.service';

export interface GuardarEquipoDto {
  organizacionId?: number | string | null;
  nodoId?: number | string | null;
  codigoInterno?: string | null;
  /** Indexado por la CLAVE del campo, no por su id. */
  valores?: Record<string, unknown>;
}

export type EditarEquipoDto = Partial<GuardarEquipoDto>;

/**
 * El registro de inventario.
 *
 * Orquesta tres cosas y no hace ninguna: valida los valores con
 * `ValorCampoService`, los escribe, y anota lo que cambió con
 * `HistorialService`. Los filtros y el listado viven en
 * `EquipoBusquedaService`, que es un problema aparte.
 */
@Injectable()
export class EquipoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizaciones: OrganizacionService,
    private readonly valores: ValorCampoService,
    private readonly historial: HistorialService,
  ) {}

  /** La ficha completa: el equipo, sus valores legibles y su ubicación. */
  async detalle(id: number) {
    const equipo = await this.prisma.equipo.findUnique({
      where: { id },
      include: {
        organizacion: { select: { id: true, nombre: true } },
        nodo: { select: { id: true, nombre: true } },
        creadoPor: { select: { id: true, nombre: true } },
        valores: {
          include: {
            definicionCampo: {
              select: {
                id: true,
                nombre: true,
                clave: true,
                tipo: true,
                orden: true,
              },
            },
            opcion: { select: { id: true, etiqueta: true } },
            opcionesElegidas: {
              include: { opcion: { select: { id: true, etiqueta: true } } },
            },
          },
        },
        _count: { select: { incidencias: true, fotos: true } },
      },
    });
    if (!equipo) throw new NotFoundException('Ese equipo ya no existe.');

    return {
      ...equipo,
      valores: equipo.valores
        .sort((a, b) => a.definicionCampo.orden - b.definicionCampo.orden)
        .map((v) => ({
          campo: v.definicionCampo,
          valorTexto: v.valorTexto,
          valorNumero: v.valorNumero,
          valorEntero: v.valorEntero,
          valorFecha: v.valorFecha,
          valorBooleano: v.valorBooleano,
          claveArchivo: v.claveArchivo,
          opcion: v.opcion,
          opciones: v.opcionesElegidas.map((o) => o.opcion),
        })),
    };
  }

  /**
   * Instantánea de lo que un equipo vale ahora, en texto legible.
   *
   * Es lo que se compara antes y después de editar para saber qué
   * cambió. Se arma del mismo `detalle` para que el historial y la ficha
   * nunca discrepen sobre cómo se lee un valor.
   */
  private async instantanea(equipoId: number): Promise<Instantanea> {
    const equipo = await this.detalle(equipoId);
    const valores: Record<string, string> = {};
    for (const v of equipo.valores) {
      valores[v.campo.clave] =
        v.opcion?.etiqueta ??
        (v.opciones.length > 0
          ? v.opciones.map((o) => o.etiqueta).join(', ')
          : (v.valorTexto ??
            (v.valorEntero !== null ? String(v.valorEntero) : null) ??
            (v.valorNumero !== null ? String(v.valorNumero) : null) ??
            (v.valorFecha ? v.valorFecha.toISOString().slice(0, 10) : null) ??
            (v.valorBooleano !== null
              ? v.valorBooleano
                ? 'Sí'
                : 'No'
              : null) ??
            v.claveArchivo ??
            ''));
    }
    return {
      valores,
      nodo: equipo.nodo.nombre,
      codigoInterno: equipo.codigoInterno,
    };
  }

  /** El nodo existe y pertenece a esa organización. */
  private async exigirNodo(nodoId: number, organizacionId: number) {
    const nodo = await this.prisma.nodoEstructura.findUnique({
      where: { id: nodoId },
      select: { id: true, nombre: true, organizacionId: true },
    });
    if (!nodo) throw new NotFoundException('Esa ubicación ya no existe.');
    if (nodo.organizacionId !== organizacionId)
      throw new BadRequestException(
        'La ubicación pertenece a otra organización.',
      );
    return nodo;
  }

  private traducirDuplicado(error: unknown, codigo: string | null) {
    if ((error as { code?: string })?.code === 'P2002' && codigo)
      return new ConflictException(
        `Ya hay un equipo con el código "${codigo}" en esta organización.`,
      );
    return error;
  }

  /**
   * Traduce el fallo de clave ajena al borrar.
   *
   * Las relaciones que este módulo conoce las corta antes por cascada o las
   * cuenta para el resumen. La que NO conoce es `carpetas_fotos.equipoId`,
   * que el módulo Fotos añadió con `Restrict` a propósito: una carpeta con
   * fotos de inspección documentadas no puede quedarse apuntando al vacío,
   * ni desaparecer porque alguien dé de baja el equipo.
   *
   * Sin esta traducción el `Restrict` cumplía su función —el equipo no se
   * borraba— pero el error llegaba al usuario como un 500 sin texto. Aquí
   * solo se le pone nombre: no se cambia qué se permite.
   *
   * ⚠️ **No es `P2003`.** Con Prisma 7 y el driver adapter de Postgres el
   * error NO se mapea al código de clave ajena de Prisma: llega como
   * `P2039` con el error crudo de la base dentro de
   * `meta.driverAdapterError.cause`. De ahí se lee el `23001`
   * (`restrict_violation`) y el nombre de la restricción. Buscar `P2003`
   * —lo que parece razonable y es lo que dice la documentación clásica— no
   * captura nada.
   *
   * Se admite también `23503` (`foreign_key_violation`): es el que sale si
   * la FK llega a declararse `NO ACTION` en vez de `RESTRICT`.
   */
  private traducirEnUso(error: unknown, codigo: string | null) {
    const cause = (
      error as {
        meta?: { driverAdapterError?: { cause?: { code?: string } } };
      }
    )?.meta?.driverAdapterError?.cause;
    const codigoBd = cause?.code;
    const esClaveAjena =
      codigoBd === '23001' ||
      codigoBd === '23503' ||
      (error as { code?: string })?.code === 'P2003';
    if (!esClaveAjena) return error;

    const cual = codigo ? `El equipo "${codigo}"` : 'Este equipo';
    return new BadRequestException(
      `No se puede eliminar: ${cual} tiene carpetas de Fotos enlazadas. ` +
        'Elimina o desvincula esas carpetas en el módulo Fotos antes de darlo de baja.',
    );
  }

  async crear(usuario: UsuarioAutenticado, dto: GuardarEquipoDto) {
    const organizacionId = aId(
      dto.organizacionId,
      'La organización indicada no es válida.',
    );
    await this.organizaciones.exigir(organizacionId);
    const nodoId = aId(dto.nodoId, 'La ubicación indicada no es válida.');
    await this.exigirNodo(nodoId, organizacionId);

    const codigoInterno = limpiar(dto.codigoInterno) ?? null;
    const campos = await this.valores.camposDe(organizacionId);
    if (campos.length === 0)
      throw new BadRequestException(
        'Esta organización todavía no tiene campos configurados. Créalos antes de registrar equipos.',
      );

    const normalizados = this.valores.normalizarTodos(
      campos,
      dto.valores ?? {},
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const equipo = await tx.equipo.create({
          data: {
            organizacionId,
            nodoId,
            codigoInterno,
            creadoPorId: usuario.id,
          },
          select: { id: true },
        });

        await this.valores.reemplazar(tx, equipo.id, normalizados);

        await this.historial.registrar(tx, [
          {
            equipoId: equipo.id,
            tipo: TipoEventoHistorial.CREACION,
            usuarioId: usuario.id,
            descripcion: codigoInterno
              ? `Equipo ${codigoInterno} registrado.`
              : 'Equipo registrado.',
          },
        ]);

        return tx.equipo.findUnique({ where: { id: equipo.id } });
      });
    } catch (error) {
      throw this.traducirDuplicado(error, codigoInterno);
    }
  }

  /**
   * Reescribe el equipo y anota en la bitácora lo que cambió.
   *
   * Se toma una instantánea antes y otra después: comparar los dos
   * estados es más fiable que intentar deducir el cambio del payload,
   * porque el payload no sabe qué había antes.
   */
  async editar(usuario: UsuarioAutenticado, id: number, dto: EditarEquipoDto) {
    const actual = await this.prisma.equipo.findUnique({
      where: { id },
      select: {
        id: true,
        organizacionId: true,
        nodoId: true,
        codigoInterno: true,
      },
    });
    if (!actual) throw new NotFoundException('Ese equipo ya no existe.');

    const antes = await this.instantanea(id);

    const nodoId =
      'nodoId' in dto
        ? aId(dto.nodoId, 'La ubicación indicada no es válida.')
        : actual.nodoId;
    if (nodoId !== actual.nodoId)
      await this.exigirNodo(nodoId, actual.organizacionId);

    const codigoInterno =
      'codigoInterno' in dto
        ? (limpiar(dto.codigoInterno) ?? null)
        : actual.codigoInterno;

    const campos = await this.valores.camposDe(actual.organizacionId);
    // Si no llegan valores, se conservan los que ya estaban: editar solo
    // la ubicación no puede vaciar la ficha entera.
    const normalizados =
      dto.valores === undefined
        ? null
        : this.valores.normalizarTodos(campos, dto.valores);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.equipo.update({
          where: { id },
          data: { nodoId, codigoInterno },
        });
        if (normalizados !== null)
          await this.valores.reemplazar(tx, id, normalizados);
      });
    } catch (error) {
      throw this.traducirDuplicado(error, codigoInterno);
    }

    const despues = await this.instantanea(id);
    const eventos = this.historial.diferencias(antes, despues, {
      equipoId: id,
      usuarioId: usuario.id,
    });
    if (eventos.length > 0)
      await this.prisma.$transaction(async (tx) => {
        await this.historial.registrar(tx, eventos);
      });

    return this.detalle(id);
  }

  /**
   * Borra el equipo con sus valores, fotos, incidencias e historial.
   *
   * Cascade a propósito: un equipo es la unidad, y lo que cuelga de él
   * no tiene sentido sin él. Es la única operación destructiva del
   * módulo, así que la UI pide confirmación.
   */
  async eliminar(id: number) {
    const equipo = await this.prisma.equipo.findUnique({
      where: { id },
      select: {
        codigoInterno: true,
        _count: { select: { incidencias: true, fotos: true } },
      },
    });
    if (!equipo) throw new NotFoundException('Ese equipo ya no existe.');

    try {
      await this.prisma.equipo.delete({ where: { id } });
    } catch (error) {
      throw this.traducirEnUso(error, equipo.codigoInterno);
    }
    return {
      ok: true,
      id,
      codigoInterno: equipo.codigoInterno,
      incidenciasEliminadas: equipo._count.incidencias,
      fotosEliminadas: equipo._count.fotos,
    };
  }

  /** La bitácora del equipo. */
  historialDe(id: number) {
    return this.historial.deEquipo(id);
  }
}
