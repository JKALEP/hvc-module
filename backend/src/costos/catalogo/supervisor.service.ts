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
  aEstadoCatalogo,
  exigirSinUso,
} from '../validacion';
import type { GuardarSupervisorDto } from './dto';

/**
 * Los supervisores que responden por un requerimiento (§13).
 *
 * Catálogo propio y NO una FK a `FichaPersonal` de las listas SCTR, pese
 * a que allí hay supervisores: una ficha existe POR MES, así que un
 * requerimiento de agosto y otro de septiembre apuntarían a dos filas
 * distintas de la misma persona, y «los requerimientos de Fulano»
 * dejaría de ser una consulta.
 *
 * §4 lo autoriza: el módulo no debe quedar bloqueado esperando la
 * integración con Personal. El día que llegue, esta tabla gana una
 * `fichaPersonalId` opcional que hace de puente, sin tocar el
 * requerimiento.
 *
 * `documento` es único pero opcional. Postgres admite varios NULL en un
 * índice único, así que puede haber muchos supervisores sin documento y
 * ninguno repetido entre los que sí lo tienen.
 */
@Injectable()
export class SupervisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtros: { q?: string; soloActivos?: boolean }) {
    const q = limpiar(filtros.q);

    return this.prisma.supervisor.findMany({
      where: {
        ...(filtros.soloActivos ? { estado: 'ACTIVO' } : {}),
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' as const } },
                { documento: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ nombre: 'asc' }],
    });
  }

  async detalle(id: number) {
    const supervisor = await this.prisma.supervisor.findUnique({
      where: { id },
    });
    if (!supervisor)
      throw new NotFoundException('Ese supervisor ya no existe.');
    return supervisor;
  }

  /**
   * Exige que el supervisor exista y esté activo. Mismo criterio que en
   * clientes: se comprueba al elegirlo, no al leer.
   */
  async exigirActivo(id: number) {
    const supervisor = await this.prisma.supervisor.findUnique({
      where: { id },
      select: { id: true, nombre: true, estado: true },
    });

    if (!supervisor)
      throw new BadRequestException(`El supervisor ${id} no existe.`);

    if (supervisor.estado !== 'ACTIVO')
      throw new BadRequestException(
        `El supervisor "${supervisor.nombre}" está desactivado y ya no se puede elegir.`,
      );

    return supervisor;
  }

  private campos(dto: GuardarSupervisorDto) {
    return {
      ...('nombre' in dto ? { nombre: aTexto(dto.nombre, 'El nombre') } : {}),
      ...('documento' in dto
        ? { documento: aTextoOpcional(dto.documento) }
        : {}),
      ...('cargo' in dto ? { cargo: aTextoOpcional(dto.cargo) } : {}),
      ...('correo' in dto ? { correo: aCorreoOpcional(dto.correo) } : {}),
      ...('telefono' in dto ? { telefono: aTextoOpcional(dto.telefono) } : {}),
      ...('estado' in dto ? { estado: aEstadoCatalogo(dto.estado) } : {}),
    };
  }

  /** El documento no se repite entre los que lo tienen. */
  private async exigirDocumentoLibre(
    documento: string | null,
    exceptoId?: number,
  ) {
    if (!documento) return;
    const otro = await this.prisma.supervisor.findUnique({
      where: { documento },
      select: { id: true, nombre: true },
    });
    if (otro && otro.id !== exceptoId)
      throw new ConflictException(
        `El documento ${documento} ya es de ${otro.nombre}.`,
      );
  }

  async crear(usuario: UsuarioAutenticado, dto: GuardarSupervisorDto) {
    const nombre = aTexto(dto.nombre, 'El nombre');
    const documento = aTextoOpcional(dto.documento);
    await this.exigirDocumentoLibre(documento);

    const supervisor = await this.prisma.supervisor.create({
      data: { ...this.campos(dto), nombre, documento },
    });

    await this.auditoria.registrarUno(usuario, {
      entidad: 'SUPERVISOR',
      entidadId: supervisor.id,
      accion: 'CREACION',
      descripcion: `Se dio de alta al supervisor "${nombre}".`,
    });

    return supervisor;
  }

  async editar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: GuardarSupervisorDto,
  ) {
    const actual = await this.detalle(id);
    const data = this.campos(dto);

    if ('documento' in data)
      await this.exigirDocumentoLibre(data.documento ?? null, id);

    if (Object.keys(data).length === 0) return actual;

    const supervisor = await this.prisma.supervisor.update({
      where: { id },
      data,
    });

    await this.auditoria.registrar(
      usuario,
      this.auditoria.diferencias(
        {
          nombre: actual.nombre,
          documento: actual.documento,
          cargo: actual.cargo,
          correo: actual.correo,
          telefono: actual.telefono,
          estado: actual.estado,
        },
        {
          nombre: supervisor.nombre,
          documento: supervisor.documento,
          cargo: supervisor.cargo,
          correo: supervisor.correo,
          telefono: supervisor.telefono,
          estado: supervisor.estado,
        },
        { entidad: 'SUPERVISOR', entidadId: id },
      ),
    );

    return supervisor;
  }

  async eliminar(usuario: UsuarioAutenticado, id: number) {
    const supervisor = await this.prisma.supervisor.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        _count: { select: { requerimientos: true } },
      },
    });
    if (!supervisor)
      throw new NotFoundException('Ese supervisor ya no existe.');

    exigirSinUso(
      [{ cuantos: supervisor._count.requerimientos, que: 'requerimiento(s)' }],
      `al supervisor "${supervisor.nombre}"`,
    );

    await this.prisma.supervisor.delete({ where: { id } });

    await this.auditoria.registrarUno(usuario, {
      entidad: 'SUPERVISOR',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: `Se eliminó al supervisor "${supervisor.nombre}".`,
    });

    return { ok: true, id };
  }
}
