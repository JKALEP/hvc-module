import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { limpiar } from '../../common/texto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  aTexto,
  aTextoOpcional,
  aCorreoOpcional,
  aRucOpcional,
  aEstadoCatalogo,
  exigirSinUso,
} from '../validacion';
import type { GuardarProveedorDto } from './dto';

/**
 * Los proveedores a los que se les pide cotización (§31).
 *
 * Entidad estructurada, no texto suelto. Antes eran dos columnas
 * `String` en la tabla de productos, y con eso «FERRETERIA SAC» y
 * «Ferretería S.A.C.» eran dos proveedores distintos, no se podía buscar
 * por correo, y compartir un requerimiento obligaba a teclear la
 * dirección cada vez — que es justo lo que §30 quiere evitar.
 *
 * Propio de Costos: no toca el campo `proveedor` de texto que usan las
 * cotizaciones y órdenes de compra del módulo de Equipos. Son dos
 * dominios que hoy no se conocen.
 */
@Injectable()
export class ProveedorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Busca por nombre, RUC o correo — los tres criterios de §30.
   *
   * `nombreComercial` entra en la búsqueda además de la razón social:
   * quien comparte un requerimiento se acuerda de «Ferrimax», no de
   * «INVERSIONES FERRIMAX S.A.C.».
   */
  async listar(filtros: { q?: string; soloActivos?: boolean }) {
    const q = limpiar(filtros.q);

    return this.prisma.proveedor.findMany({
      where: {
        ...(filtros.soloActivos ? { estado: 'ACTIVO' } : {}),
        ...(q
          ? {
              OR: [
                { razonSocial: { contains: q, mode: 'insensitive' as const } },
                {
                  nombreComercial: {
                    contains: q,
                    mode: 'insensitive' as const,
                  },
                },
                { ruc: { contains: q, mode: 'insensitive' as const } },
                { correo: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ razonSocial: 'asc' }],
      take: 200,
    });
  }

  async detalle(id: number) {
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { id },
    });
    if (!proveedor) throw new NotFoundException('Ese proveedor ya no existe.');
    return proveedor;
  }

  private campos(dto: GuardarProveedorDto) {
    return {
      ...('razonSocial' in dto
        ? { razonSocial: aTexto(dto.razonSocial, 'La razón social') }
        : {}),
      ...('ruc' in dto ? { ruc: aRucOpcional(dto.ruc) } : {}),
      ...('nombreComercial' in dto
        ? { nombreComercial: aTextoOpcional(dto.nombreComercial) }
        : {}),
      ...('correo' in dto ? { correo: aCorreoOpcional(dto.correo) } : {}),
      ...('telefono' in dto ? { telefono: aTextoOpcional(dto.telefono) } : {}),
      ...('direccion' in dto
        ? { direccion: aTextoOpcional(dto.direccion) }
        : {}),
      ...('estado' in dto ? { estado: aEstadoCatalogo(dto.estado) } : {}),
    };
  }

  /**
   * El RUC no se repite entre los que lo tienen.
   *
   * Es la única defensa real contra el proveedor duplicado: el nombre se
   * escribe de cinco maneras, el RUC de una.
   */
  private async exigirRucLibre(ruc: string | null, exceptoId?: number) {
    if (!ruc) return;
    const otro = await this.prisma.proveedor.findUnique({
      where: { ruc },
      select: { id: true, razonSocial: true },
    });
    if (otro && otro.id !== exceptoId)
      throw new ConflictException(
        `El RUC ${ruc} ya es de "${otro.razonSocial}".`,
      );
  }

  async crear(usuario: UsuarioAutenticado, dto: GuardarProveedorDto) {
    const razonSocial = aTexto(dto.razonSocial, 'La razón social');
    const ruc = aRucOpcional(dto.ruc);
    await this.exigirRucLibre(ruc);

    const proveedor = await this.prisma.proveedor.create({
      data: { ...this.campos(dto), razonSocial, ruc },
    });

    await this.auditoria.registrarUno(usuario, {
      entidad: 'PROVEEDOR',
      entidadId: proveedor.id,
      accion: 'CREACION',
      descripcion: `Se dio de alta al proveedor "${razonSocial}".`,
    });

    return proveedor;
  }

  async editar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: GuardarProveedorDto,
  ) {
    const actual = await this.detalle(id);
    const data = this.campos(dto);

    if ('ruc' in data) await this.exigirRucLibre(data.ruc ?? null, id);

    if (Object.keys(data).length === 0) return actual;

    const proveedor = await this.prisma.proveedor.update({
      where: { id },
      data,
    });

    // El costo guarda un SNAPSHOT de razón social, RUC y teléfono (§48),
    // así que corregir aquí no reescribe lo ya comprado. Queda en la
    // bitácora para que se entienda la diferencia.
    await this.auditoria.registrar(
      usuario,
      this.auditoria.diferencias(
        {
          razonSocial: actual.razonSocial,
          ruc: actual.ruc,
          nombreComercial: actual.nombreComercial,
          correo: actual.correo,
          telefono: actual.telefono,
          direccion: actual.direccion,
          estado: actual.estado,
        },
        {
          razonSocial: proveedor.razonSocial,
          ruc: proveedor.ruc,
          nombreComercial: proveedor.nombreComercial,
          correo: proveedor.correo,
          telefono: proveedor.telefono,
          direccion: proveedor.direccion,
          estado: proveedor.estado,
        },
        { entidad: 'PROVEEDOR', entidadId: id },
      ),
    );

    return proveedor;
  }

  async eliminar(usuario: UsuarioAutenticado, id: number) {
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { id },
      select: {
        id: true,
        razonSocial: true,
        _count: {
          select: { solicitudes: true, cotizaciones: true, costos: true },
        },
      },
    });
    if (!proveedor) throw new NotFoundException('Ese proveedor ya no existe.');

    exigirSinUso(
      [
        { cuantos: proveedor._count.solicitudes, que: 'solicitud(es)' },
        { cuantos: proveedor._count.cotizaciones, que: 'cotización(es)' },
        { cuantos: proveedor._count.costos, que: 'costo(s) registrado(s)' },
      ],
      `al proveedor "${proveedor.razonSocial}"`,
    );

    await this.prisma.proveedor.delete({ where: { id } });

    await this.auditoria.registrarUno(usuario, {
      entidad: 'PROVEEDOR',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: `Se eliminó al proveedor "${proveedor.razonSocial}".`,
    });

    return { ok: true, id };
  }
}
