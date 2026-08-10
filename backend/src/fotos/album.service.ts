import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlmacenamientoService } from './almacenamiento.service';
import { AccesoService } from './acceso.service';
import type { UsuarioAutenticado } from '../auth/tipos';

const ESTADOS = ['ABIERTO', 'CERRADO'] as const;

export interface CrearAlbumDto {
  sedeId?: number | string | null;
  nombre?: string | null;
  descripcion?: string | null;
}

export interface EditarAlbumDto extends CrearAlbumDto {
  estado?: string | null;
}

@Injectable()
export class AlbumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly acceso: AccesoService,
  ) {}

  private limpiar(valor: unknown): string | null {
    if (typeof valor !== 'string') return null;
    const s = valor.trim();
    return s === '' ? null : s;
  }

  /** Representación segura de un valor para incluirlo en un mensaje de error. */
  private describir(valor: unknown): string {
    if (typeof valor === 'string') return valor;
    if (typeof valor === 'number' || typeof valor === 'boolean')
      return String(valor);
    return JSON.stringify(valor) ?? 'null';
  }

  private aId(valor: unknown, campo: string): number {
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0)
      throw new BadRequestException(
        `El campo "${campo}" debe ser un id válido. Recibido: "${this.describir(valor)}".`,
      );
    return n;
  }

  /** ¿El usuario es administrador del módulo Fotos? */
  esAdminFotos(usuario: UsuarioAutenticado): boolean {
    return this.acceso.esAdminFotos(usuario);
  }

  /**
   * ÚNICA regla de acceso del módulo, ahora en `AccesoService`: se ve un
   * álbum si te lo compartieron a él o a alguna carpeta por encima.
   *
   * Entre internos, ver y subir siguen siendo el mismo permiso: el álbum
   * es un feed grupal donde quien entra, publica. Lo que cambia esa regla
   * no es la tabla sino el ROL: un CLIENTE solo mira y descarga.
   */
  async puedeAcceder(
    usuario: UsuarioAutenticado,
    albumId: number,
  ): Promise<boolean> {
    return this.acceso.puedeVerAlbum(usuario, albumId);
  }

  /** Carga el álbum comprobando el acceso. Lanza 404/403 según el caso. */
  async obtenerConAcceso(usuario: UsuarioAutenticado, albumId: number) {
    const album = await this.prisma.albumFotos.findUnique({
      where: { id: albumId },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        sedeId: true,
        creadoEn: true,
        sede: { select: { id: true, nombre: true, ruta: true } },
        creadoPor: { select: { id: true, nombre: true } },
        _count: { select: { fotos: true, compartidos: true } },
      },
    });
    if (!album) throw new NotFoundException(`Álbum ${albumId} no encontrado.`);

    if (!(await this.puedeAcceder(usuario, albumId)))
      throw new ForbiddenException(
        'No tienes acceso a este álbum. Pídeselo a un administrador de Fotos.',
      );

    return album;
  }

  /** Un álbum CERRADO es de solo lectura para todos, incluido un admin. */
  exigirAbierto(album: { estado: string; nombre: string }) {
    if (album.estado === 'CERRADO')
      throw new BadRequestException(
        `El álbum "${album.nombre}" está cerrado: no admite fotos nuevas. Un administrador de Fotos puede reabrirlo.`,
      );
  }

  /**
   * Álbumes que el usuario ve.
   * Admin: todos. Los demás: lo compartido, con su cascada.
   */
  async listar(usuario: UsuarioAutenticado, sedeId?: number) {
    const esAdmin = this.esAdminFotos(usuario);
    const filtro = esAdmin
      ? {}
      : this.acceso.filtroAlbumes(await this.acceso.alcance(usuario.id));

    const albumes = await this.prisma.albumFotos.findMany({
      where: {
        ...(sedeId !== undefined ? { sedeId } : {}),
        ...filtro,
      },
      orderBy: [{ actualizadoEn: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        creadoEn: true,
        sede: { select: { id: true, nombre: true, ruta: true } },
        creadoPor: { select: { id: true, nombre: true } },
        _count: { select: { fotos: true, compartidos: true } },
        // Última foto: la portada del álbum en el listado.
        fotos: {
          orderBy: { creadoEn: 'desc' },
          take: 1,
          select: { id: true, claveMiniatura: true, creadoEn: true },
        },
      },
    });

    // La portada se firma aquí y no en el cliente: el bucket es privado y
    // una clave suelta no sirve para nada sin firma.
    return Promise.all(
      albumes.map(async ({ fotos, ...a }) => ({
        ...a,
        ultimaFoto: fotos[0]
          ? {
              id: fotos[0].id,
              creadoEn: fotos[0].creadoEn,
              urlMiniatura: await this.almacenamiento.urlFirmada(
                fotos[0].claveMiniatura,
              ),
            }
          : null,
      })),
    );
  }

  async crear(usuario: UsuarioAutenticado, dto: CrearAlbumDto) {
    const sedeId = this.aId(dto.sedeId, 'sedeId');
    const nombre = this.limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException('El nombre del álbum es obligatorio.');

    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: { id: true },
    });
    if (!sede) throw new NotFoundException('Esa carpeta ya no existe.');

    const repetido = await this.prisma.albumFotos.findFirst({
      where: { sedeId, nombre },
      select: { id: true },
    });
    if (repetido)
      throw new ConflictException(
        `Ya existe un álbum llamado "${nombre}" en esta carpeta.`,
      );

    return this.prisma.albumFotos.create({
      data: {
        sedeId,
        nombre,
        descripcion: this.limpiar(dto.descripcion),
        creadoPorId: usuario.id,
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        sede: { select: { id: true, nombre: true } },
      },
    });
  }

  /** Editar nombre, descripción, sede y/o abrir-cerrar. */
  async editar(id: number, dto: EditarAlbumDto) {
    const existe = await this.prisma.albumFotos.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException(`Álbum ${id} no encontrado.`);

    const data: Record<string, unknown> = {};
    if ('nombre' in dto) {
      const nombre = this.limpiar(dto.nombre);
      if (!nombre)
        throw new BadRequestException('El nombre del álbum es obligatorio.');
      data.nombre = nombre;
    }
    if ('descripcion' in dto) data.descripcion = this.limpiar(dto.descripcion);
    if ('sedeId' in dto && dto.sedeId !== null && dto.sedeId !== undefined)
      data.sedeId = this.aId(dto.sedeId, 'sedeId');
    if ('estado' in dto && dto.estado !== null && dto.estado !== undefined) {
      const estado = this.limpiar(dto.estado)?.toUpperCase();
      if (!estado || !ESTADOS.includes(estado as (typeof ESTADOS)[number]))
        throw new BadRequestException(
          `Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}.`,
        );
      data.estado = estado;
    }

    return this.prisma.albumFotos.update({
      where: { id },
      data: data as never,
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        sede: { select: { id: true, nombre: true } },
      },
    });
  }
}
