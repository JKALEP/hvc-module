import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import { ColorEstadoFotos } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';

export interface GuardarEstadoDto {
  nombre?: string | null;
  color?: string | null;
  orden?: number | null;
  activo?: boolean | null;
}

/**
 * El catálogo de estados de equipo (§7).
 *
 * ⚠️ «Operativo», «Operativo con observaciones» e «Inoperativo» NO están en
 * el código: se siembran como DATOS en la migración. HVC puede renombrarlos,
 * reordenarlos, retirar uno o añadir un cuarto sin que nadie toque nada.
 * Mismo criterio que el catálogo de actividades y que los colores de carpeta.
 *
 * Lo que sí es cerrado es la PALETA (`ColorEstadoFotos`), y no por comodidad:
 * Tailwind solo genera las clases que ve escritas en el código, así que un
 * color inventado en la base no existiría en el CSS. El nombre es libre; el
 * color se elige de la lista.
 */
@Injectable()
export class EstadoEquipoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /**
   * Configurar los estados es de ADMIN_GLOBAL; usarlos, de quien trabaja.
   *
   * La misma frontera que separa administrar una plantilla de aplicarla, y
   * definir un campo de rellenarlo.
   */
  private exigirAdmin(usuario: UsuarioAutenticado) {
    if (!this.acceso.tieneNivelMinimo(usuario, 'ADMIN_GLOBAL'))
      throw new ForbiddenException(
        'Solo un administrador global de Fotos configura los estados de equipo.',
      );
  }

  private aColor(valor: unknown): ColorEstadoFotos {
    const s = limpiar(valor)?.toUpperCase();
    const validos = Object.values(ColorEstadoFotos) as string[];
    if (s && validos.includes(s)) return s as ColorEstadoFotos;
    throw new BadRequestException(
      `Color inválido: "${describir(valor)}". Valores permitidos: ${validos.join(', ')}.`,
    );
  }

  private seleccion() {
    return {
      id: true,
      nombre: true,
      color: true,
      orden: true,
      activo: true,
      _count: { select: { ciclos: true } },
    };
  }

  /**
   * Los estados.
   *
   * Leerlos NO exige ser administrador: los necesita cualquiera que abra un
   * equipo para elegir el estado de la visita, y son nombres, no datos de
   * nadie.
   */
  async listar(soloActivos = false) {
    return this.prisma.estadoEquipoFotos.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      select: this.seleccion(),
    });
  }

  async crear(usuario: UsuarioAutenticado, dto: GuardarEstadoDto) {
    this.exigirAdmin(usuario);

    const nombre = limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException('El nombre del estado es obligatorio.');
    const color = this.aColor(dto.color);

    const repetido = await this.prisma.estadoEquipoFotos.findUnique({
      where: { nombre },
      select: { id: true },
    });
    if (repetido)
      throw new ConflictException(`Ya existe un estado llamado "${nombre}".`);

    const creado = await this.prisma.estadoEquipoFotos.create({
      data: {
        nombre,
        color,
        orden: Number.isInteger(dto.orden) ? (dto.orden as number) : 0,
      },
      select: this.seleccion(),
    });

    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'ESTADO_EQUIPO',
      entidadId: creado.id,
      accion: 'CREACION',
      descripcion: `Creó el estado de equipo "${nombre}" (${color}).`,
    });
    return creado;
  }

  async editar(usuario: UsuarioAutenticado, id: number, dto: GuardarEstadoDto) {
    this.exigirAdmin(usuario);
    const actual = await this.exigir(id);

    const data: Record<string, unknown> = {};
    const cambios: string[] = [];

    if ('nombre' in dto) {
      const nombre = limpiar(dto.nombre);
      if (!nombre)
        throw new BadRequestException('El nombre del estado es obligatorio.');
      if (nombre !== actual.nombre) {
        const otro = await this.prisma.estadoEquipoFotos.findUnique({
          where: { nombre },
          select: { id: true },
        });
        if (otro)
          throw new ConflictException(
            `Ya existe un estado llamado "${nombre}".`,
          );
        data.nombre = nombre;
        cambios.push(`nombre: "${actual.nombre}" → "${nombre}"`);
      }
    }

    if ('color' in dto && dto.color !== null && dto.color !== undefined) {
      const color = this.aColor(dto.color);
      if (color !== actual.color) {
        data.color = color;
        cambios.push(`color: ${actual.color} → ${color}`);
      }
    }

    if (dto.orden !== null && dto.orden !== undefined) {
      if (!Number.isInteger(dto.orden))
        throw new BadRequestException('El orden tiene que ser un número.');
      if (dto.orden !== actual.orden) {
        data.orden = dto.orden;
        cambios.push(`orden: ${actual.orden} → ${dto.orden}`);
      }
    }

    if (typeof dto.activo === 'boolean' && dto.activo !== actual.activo) {
      data.activo = dto.activo;
      cambios.push(dto.activo ? 'se reactivó' : 'se retiró');
    }

    if (Object.keys(data).length === 0) return this.detalle(id);

    const editado = await this.prisma.estadoEquipoFotos.update({
      where: { id },
      data,
      select: this.seleccion(),
    });

    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'ESTADO_EQUIPO',
      entidadId: id,
      accion: 'EDICION',
      descripcion: `Editó el estado "${actual.nombre}" — ${cambios.join(' · ')}.`,
    });
    return editado;
  }

  /**
   * Borrado real, y solo si ningún ciclo lo usa.
   *
   * Con ciclos detrás se rechaza y se ofrece retirarlo, que es la vía normal:
   * esos ciclos son historial y un estado borrado los dejaría sin decir en
   * qué condición estaba el equipo aquel día. La FK ya es `Restrict`; esto
   * solo traduce el fallo a un mensaje que dice qué hacer.
   */
  async eliminar(usuario: UsuarioAutenticado, id: number) {
    this.exigirAdmin(usuario);
    const estado = await this.exigir(id);

    const enUso = await this.prisma.cicloFotos.count({
      where: { estadoId: id },
    });
    if (enUso > 0)
      throw new BadRequestException(
        `No se puede eliminar: ${enUso} ciclo(s) están marcados como "${estado.nombre}". ` +
          'Retíralo en su lugar: deja de ofrecerse y el historial se conserva.',
      );

    await this.prisma.estadoEquipoFotos.delete({ where: { id } });
    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'ESTADO_EQUIPO',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: `Eliminó el estado de equipo "${estado.nombre}".`,
    });
    return { ok: true, id };
  }

  async detalle(id: number) {
    const estado = await this.prisma.estadoEquipoFotos.findUnique({
      where: { id },
      select: this.seleccion(),
    });
    if (!estado) throw new NotFoundException('Ese estado ya no existe.');
    return estado;
  }

  private async exigir(id: number) {
    const estado = await this.prisma.estadoEquipoFotos.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        color: true,
        orden: true,
        activo: true,
      },
    });
    if (!estado) throw new NotFoundException('Ese estado ya no existe.');
    return estado;
  }
}
