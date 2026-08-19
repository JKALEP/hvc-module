import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
import type { GuardarClienteDto } from './dto';

/**
 * Los clientes de HVC, para el campo «Cliente» del requerimiento (§13).
 *
 * Entidad PROPIA del módulo: no se relaciona con `Organizacion` (Equipos)
 * ni con las cuentas `RolGlobal.CLIENTE` del portal de Fotos. Decisión
 * explícita de HVC — hoy son tres universos distintos, y unirlos habría
 * atado el requerimiento a dominios que no le incumben. Cuando exista un
 * módulo corporativo de clientes, esta tabla gana una FK opcional y nada
 * más cambia.
 */
@Injectable()
export class ClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtros: { q?: string; soloActivos?: boolean }) {
    const q = limpiar(filtros.q);

    return this.prisma.clienteCostos.findMany({
      where: {
        ...(filtros.soloActivos ? { estado: 'ACTIVO' } : {}),
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' as const } },
                { ruc: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ nombre: 'asc' }],
    });
  }

  async detalle(id: number) {
    const cliente = await this.prisma.clienteCostos.findUnique({
      where: { id },
    });
    if (!cliente) throw new NotFoundException('Ese cliente ya no existe.');
    return cliente;
  }

  /**
   * Exige que el cliente exista y esté activo, y devuelve lo que el
   * requerimiento necesita: el id y el nombre para su snapshot.
   *
   * Se comprueba al ELEGIRLO, no al leer: un requerimiento viejo cuyo
   * cliente se desactivó después sigue siendo válido y se muestra tal
   * cual. Desactivar es «no se ofrece más», no «nunca existió».
   */
  async exigirActivo(id: number) {
    const cliente = await this.prisma.clienteCostos.findUnique({
      where: { id },
      select: { id: true, nombre: true, estado: true },
    });

    if (!cliente) throw new BadRequestException(`El cliente ${id} no existe.`);

    if (cliente.estado !== 'ACTIVO')
      throw new BadRequestException(
        `El cliente "${cliente.nombre}" está desactivado y ya no se puede elegir.`,
      );

    return cliente;
  }

  /** Los campos comunes al alta y a la edición, ya validados. */
  private campos(dto: GuardarClienteDto) {
    return {
      ...('nombre' in dto ? { nombre: aTexto(dto.nombre, 'El nombre') } : {}),
      ...('ruc' in dto ? { ruc: aRucOpcional(dto.ruc) } : {}),
      ...('contacto' in dto ? { contacto: aTextoOpcional(dto.contacto) } : {}),
      ...('correo' in dto ? { correo: aCorreoOpcional(dto.correo) } : {}),
      ...('telefono' in dto ? { telefono: aTextoOpcional(dto.telefono) } : {}),
      ...('direccion' in dto
        ? { direccion: aTextoOpcional(dto.direccion) }
        : {}),
      ...('estado' in dto ? { estado: aEstadoCatalogo(dto.estado) } : {}),
    };
  }

  async crear(usuario: UsuarioAutenticado, dto: GuardarClienteDto) {
    const nombre = aTexto(dto.nombre, 'El nombre');

    const repetido = await this.prisma.clienteCostos.findUnique({
      where: { nombre },
      select: { id: true },
    });
    if (repetido)
      throw new ConflictException(`Ya existe un cliente llamado "${nombre}".`);

    const cliente = await this.prisma.clienteCostos.create({
      data: { ...this.campos(dto), nombre },
    });

    await this.auditoria.registrarUno(usuario, {
      entidad: 'CLIENTE',
      entidadId: cliente.id,
      accion: 'CREACION',
      descripcion: `Se dio de alta al cliente "${nombre}".`,
    });

    return cliente;
  }

  async editar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: GuardarClienteDto,
  ) {
    const actual = await this.detalle(id);
    const data = this.campos(dto);

    if (data.nombre && data.nombre !== actual.nombre) {
      const repetido = await this.prisma.clienteCostos.findUnique({
        where: { nombre: data.nombre },
        select: { id: true },
      });
      if (repetido)
        throw new ConflictException(
          `Ya existe un cliente llamado "${data.nombre}".`,
        );
    }

    if (Object.keys(data).length === 0) return actual;

    const cliente = await this.prisma.clienteCostos.update({
      where: { id },
      data,
    });

    await this.auditoria.registrar(
      usuario,
      this.auditoria.diferencias(
        {
          nombre: actual.nombre,
          ruc: actual.ruc,
          contacto: actual.contacto,
          correo: actual.correo,
          telefono: actual.telefono,
          direccion: actual.direccion,
          estado: actual.estado,
        },
        {
          nombre: cliente.nombre,
          ruc: cliente.ruc,
          contacto: cliente.contacto,
          correo: cliente.correo,
          telefono: cliente.telefono,
          direccion: cliente.direccion,
          estado: cliente.estado,
        },
        { entidad: 'CLIENTE', entidadId: id },
      ),
    );

    return cliente;
  }

  async eliminar(usuario: UsuarioAutenticado, id: number) {
    const cliente = await this.prisma.clienteCostos.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        _count: { select: { requerimientos: true } },
      },
    });
    if (!cliente) throw new NotFoundException('Ese cliente ya no existe.');

    exigirSinUso(
      [{ cuantos: cliente._count.requerimientos, que: 'requerimiento(s)' }],
      `al cliente "${cliente.nombre}"`,
    );

    await this.prisma.clienteCostos.delete({ where: { id } });

    await this.auditoria.registrarUno(usuario, {
      entidad: 'CLIENTE',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: `Se eliminó al cliente "${cliente.nombre}".`,
    });

    return { ok: true, id };
  }
}
