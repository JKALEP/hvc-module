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
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar } from '../common/texto';
import { aId } from '../common/validacion';

export interface GuardarFamiliaDto {
  nombre?: string | null;
  orden?: number | null;
  activo?: boolean | null;
}

export interface GuardarTipoSistemaDto extends GuardarFamiliaDto {
  familiaId?: number | string | null;
}

/**
 * Familias y tipos de sistema (Fase 2 del rediseño).
 *
 * «Aire Acondicionado» y «Ventilación» se siembran como DATOS, y los TIPOS
 * concretos no se siembran en absoluto: son el vocabulario de HVC y nadie ha
 * dicho cuál es. Inventarlos habría metido filas falsas que luego hay que ir
 * a limpiar.
 *
 * ⚠️ **Dos niveles y no una lista plana.** Con un solo desplegable de
 * «Split», «VRF», «Inyector», «Extractor»… nadie encuentra nada en obra, y
 * agrupar por prefijo del nombre es una convención que se rompe al tercer
 * alta. La familia es una tabla porque también tiene que poder crecer sin
 * tocar código: es exactamente lo que HVC pidió.
 *
 * Un solo service para los dos porque son la misma cosa —lista con nombre,
 * orden e interruptor de activo— y lo único que cambia es que el tipo cuelga
 * de una familia. Mismo criterio que `MaestroCrud` en Costos.
 */
@Injectable()
export class SistemaFotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /**
   * Configurar el vocabulario es de ADMIN_GLOBAL; usarlo, de quien trabaja.
   *
   * La misma frontera que separa definir un campo de rellenarlo y administrar
   * una plantilla de aplicarla: si cada supervisor pudiera añadir tipos habría
   * veinte parecidos y el catálogo dejaría de servir para lo único que sirve.
   */
  private exigirAdmin(usuario: UsuarioAutenticado) {
    if (!this.acceso.tieneNivelMinimo(usuario, 'ADMIN_GLOBAL'))
      throw new ForbiddenException(
        'Solo un administrador global de Fotos configura los tipos de sistema.',
      );
  }

  private nombreValido(valor: unknown) {
    const nombre = limpiar(valor);
    if (!nombre) throw new BadRequestException('El nombre es obligatorio.');
    return nombre;
  }

  private ordenValido(valor: unknown, porDefecto = 0) {
    if (valor === null || valor === undefined) return porDefecto;
    if (!Number.isInteger(valor))
      throw new BadRequestException('El orden tiene que ser un número entero.');
    return valor as number;
  }

  // ── Familias ──────────────────────────────────────────────────

  /**
   * Las familias con sus tipos dentro.
   *
   * Anidado y no dos consultas: quien pinta el desplegable necesita las dos
   * cosas a la vez, y son dos tablas de decenas de filas.
   */
  async listarFamilias(soloActivos = false) {
    return this.prisma.familiaSistemaFotos.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        nombre: true,
        orden: true,
        activo: true,
        tipos: {
          where: soloActivos ? { activo: true } : {},
          orderBy: [{ orden: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            nombre: true,
            orden: true,
            activo: true,
            _count: { select: { carpetas: true, actividades: true } },
          },
        },
      },
    });
  }

  async crearFamilia(usuario: UsuarioAutenticado, dto: GuardarFamiliaDto) {
    this.exigirAdmin(usuario);
    const nombre = this.nombreValido(dto.nombre);

    const repetida = await this.prisma.familiaSistemaFotos.findUnique({
      where: { nombre },
      select: { id: true },
    });
    if (repetida)
      throw new ConflictException(`Ya existe una familia llamada "${nombre}".`);

    const creada = await this.prisma.familiaSistemaFotos.create({
      data: { nombre, orden: this.ordenValido(dto.orden) },
      select: { id: true, nombre: true, orden: true, activo: true },
    });
    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'FAMILIA_SISTEMA',
      entidadId: creada.id,
      accion: 'CREACION',
      descripcion: `Creó la familia de sistemas "${nombre}".`,
    });
    return creada;
  }

  async editarFamilia(
    usuario: UsuarioAutenticado,
    id: number,
    dto: GuardarFamiliaDto,
  ) {
    this.exigirAdmin(usuario);
    const actual = await this.prisma.familiaSistemaFotos.findUnique({
      where: { id },
      select: { id: true, nombre: true, orden: true, activo: true },
    });
    if (!actual) throw new NotFoundException('Esa familia ya no existe.');

    const data: Record<string, unknown> = {};
    const cambios: string[] = [];

    if ('nombre' in dto) {
      const nombre = this.nombreValido(dto.nombre);
      if (nombre !== actual.nombre) {
        const otra = await this.prisma.familiaSistemaFotos.findUnique({
          where: { nombre },
          select: { id: true },
        });
        if (otra)
          throw new ConflictException(
            `Ya existe una familia llamada "${nombre}".`,
          );
        data.nombre = nombre;
        cambios.push(`nombre: "${actual.nombre}" → "${nombre}"`);
      }
    }
    if (dto.orden !== null && dto.orden !== undefined) {
      const orden = this.ordenValido(dto.orden);
      if (orden !== actual.orden) {
        data.orden = orden;
        cambios.push(`orden: ${actual.orden} → ${orden}`);
      }
    }
    if (typeof dto.activo === 'boolean' && dto.activo !== actual.activo) {
      data.activo = dto.activo;
      cambios.push(dto.activo ? 'se reactivó' : 'se retiró');
    }
    if (Object.keys(data).length === 0) return actual;

    const editada = await this.prisma.familiaSistemaFotos.update({
      where: { id },
      data,
      select: { id: true, nombre: true, orden: true, activo: true },
    });
    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'FAMILIA_SISTEMA',
      entidadId: id,
      accion: 'EDICION',
      descripcion: `Editó la familia "${actual.nombre}" — ${cambios.join(' · ')}.`,
    });
    return editada;
  }

  /** Solo si no tiene tipos dentro. Con tipos, se retira. */
  async eliminarFamilia(usuario: UsuarioAutenticado, id: number) {
    this.exigirAdmin(usuario);
    const familia = await this.prisma.familiaSistemaFotos.findUnique({
      where: { id },
      select: { nombre: true, _count: { select: { tipos: true } } },
    });
    if (!familia) throw new NotFoundException('Esa familia ya no existe.');

    if (familia._count.tipos > 0)
      throw new BadRequestException(
        `No se puede eliminar: la familia "${familia.nombre}" tiene ${familia._count.tipos} tipo(s) dentro. ` +
          'Retírala en su lugar: deja de ofrecerse y lo de dentro se conserva.',
      );

    await this.prisma.familiaSistemaFotos.delete({ where: { id } });
    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'FAMILIA_SISTEMA',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: `Eliminó la familia de sistemas "${familia.nombre}".`,
    });
    return { ok: true, id };
  }

  // ── Tipos ─────────────────────────────────────────────────────

  async crearTipo(usuario: UsuarioAutenticado, dto: GuardarTipoSistemaDto) {
    this.exigirAdmin(usuario);
    const nombre = this.nombreValido(dto.nombre);
    const familiaId = aId(dto.familiaId, 'La familia indicada no es válida.');

    const familia = await this.prisma.familiaSistemaFotos.findUnique({
      where: { id: familiaId },
      select: { id: true, nombre: true },
    });
    if (!familia) throw new NotFoundException('Esa familia ya no existe.');

    const repetido = await this.prisma.tipoSistemaFotos.findUnique({
      where: { familiaId_nombre: { familiaId, nombre } },
      select: { id: true },
    });
    if (repetido)
      throw new ConflictException(
        `Ya existe un tipo "${nombre}" en la familia "${familia.nombre}".`,
      );

    const creado = await this.prisma.tipoSistemaFotos.create({
      data: { nombre, familiaId, orden: this.ordenValido(dto.orden) },
      select: {
        id: true,
        nombre: true,
        familiaId: true,
        orden: true,
        activo: true,
      },
    });
    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'TIPO_SISTEMA',
      entidadId: creado.id,
      accion: 'CREACION',
      descripcion: `Creó el tipo de sistema "${nombre}" en "${familia.nombre}".`,
    });
    return creado;
  }

  async editarTipo(
    usuario: UsuarioAutenticado,
    id: number,
    dto: GuardarTipoSistemaDto,
  ) {
    this.exigirAdmin(usuario);
    const actual = await this.prisma.tipoSistemaFotos.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        familiaId: true,
        orden: true,
        activo: true,
      },
    });
    if (!actual)
      throw new NotFoundException('Ese tipo de sistema ya no existe.');

    const data: Record<string, unknown> = {};
    const cambios: string[] = [];

    // El nombre y la familia se validan juntos: la unicidad es del PAR, así
    // que mover de familia puede chocar con un nombre que aquí no chocaba.
    const nombre =
      'nombre' in dto ? this.nombreValido(dto.nombre) : actual.nombre;
    const familiaId =
      dto.familiaId === null || dto.familiaId === undefined
        ? actual.familiaId
        : aId(dto.familiaId, 'La familia indicada no es válida.');

    if (nombre !== actual.nombre || familiaId !== actual.familiaId) {
      const familia = await this.prisma.familiaSistemaFotos.findUnique({
        where: { id: familiaId },
        select: { nombre: true },
      });
      if (!familia) throw new NotFoundException('Esa familia ya no existe.');
      const otro = await this.prisma.tipoSistemaFotos.findUnique({
        where: { familiaId_nombre: { familiaId, nombre } },
        select: { id: true },
      });
      if (otro && otro.id !== id)
        throw new ConflictException(
          `Ya existe un tipo "${nombre}" en la familia "${familia.nombre}".`,
        );
      if (nombre !== actual.nombre) {
        data.nombre = nombre;
        cambios.push(`nombre: "${actual.nombre}" → "${nombre}"`);
      }
      if (familiaId !== actual.familiaId) {
        data.familiaId = familiaId;
        cambios.push(`familia → "${familia.nombre}"`);
      }
    }

    if (dto.orden !== null && dto.orden !== undefined) {
      const orden = this.ordenValido(dto.orden);
      if (orden !== actual.orden) {
        data.orden = orden;
        cambios.push(`orden: ${actual.orden} → ${orden}`);
      }
    }
    if (typeof dto.activo === 'boolean' && dto.activo !== actual.activo) {
      data.activo = dto.activo;
      cambios.push(dto.activo ? 'se reactivó' : 'se retiró');
    }
    if (Object.keys(data).length === 0) return actual;

    const editado = await this.prisma.tipoSistemaFotos.update({
      where: { id },
      data,
      select: {
        id: true,
        nombre: true,
        familiaId: true,
        orden: true,
        activo: true,
      },
    });
    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'TIPO_SISTEMA',
      entidadId: id,
      accion: 'EDICION',
      descripcion: `Editó el tipo de sistema "${actual.nombre}" — ${cambios.join(' · ')}.`,
    });
    return editado;
  }

  /**
   * Solo si ningún equipo lo usa.
   *
   * La FK de `CarpetaFotos.tipoSistemaId` ya es `Restrict`; esto traduce el
   * fallo a un mensaje que dice cuántos equipos son y qué hacer. Las filas
   * puente del catálogo SÍ se van con él —son la asociación, no contenido—.
   */
  async eliminarTipo(usuario: UsuarioAutenticado, id: number) {
    this.exigirAdmin(usuario);
    const tipo = await this.prisma.tipoSistemaFotos.findUnique({
      where: { id },
      select: { nombre: true, _count: { select: { carpetas: true } } },
    });
    if (!tipo) throw new NotFoundException('Ese tipo de sistema ya no existe.');

    if (tipo._count.carpetas > 0)
      throw new BadRequestException(
        `No se puede eliminar: ${tipo._count.carpetas} equipo(s) son de tipo "${tipo.nombre}". ` +
          'Retíralo en su lugar: deja de ofrecerse y los equipos conservan el suyo.',
      );

    await this.prisma.tipoSistemaFotos.delete({ where: { id } });
    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'TIPO_SISTEMA',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: `Eliminó el tipo de sistema "${tipo.nombre}".`,
    });
    return { ok: true, id };
  }

  /**
   * Valida un `tipoSistemaId` que llega de fuera. `null` es válido.
   *
   * Lo usa `CarpetaService` al crear y al editar un equipo. Un tipo RETIRADO
   * no se puede elegir de nuevo, pero el equipo que ya lo tenía lo conserva:
   * `activo` retira del formulario, no reescribe lo capturado — igual que en
   * los estados de equipo y en las opciones de un campo de lista.
   */
  async validarTipo(valor: unknown): Promise<number | null> {
    if (valor === null || valor === undefined || valor === '') return null;
    const id = aId(valor, 'El tipo de sistema indicado no es válido.');
    const tipo = await this.prisma.tipoSistemaFotos.findUnique({
      where: { id },
      select: { id: true, nombre: true, activo: true },
    });
    if (!tipo) throw new NotFoundException('Ese tipo de sistema ya no existe.');
    if (!tipo.activo)
      throw new BadRequestException(
        `El tipo de sistema "${tipo.nombre}" está retirado y ya no se puede asignar.`,
      );
    return tipo.id;
  }
}
