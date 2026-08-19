import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type {
  Modulo,
  NivelFotos,
  RolCostos,
} from '../../generated/prisma/enums';
import { limpiar } from '../common/texto';

const MODULOS = ['COSTOS', 'PERSONAL_PROYECTOS', 'FOTOS'] as const;
const NIVELES = ['LECTURA_GLOBAL', 'EDITOR_GLOBAL', 'ADMIN_GLOBAL'] as const;
const ROLES_COSTOS = [
  'SOLICITANTE',
  'GESTOR_COTIZACIONES',
  'APROBADOR',
] as const;
const ESTADOS = ['ACTIVO', 'INACTIVO'] as const;

// Coste de bcrypt. 10 es el equilibrio habitual: ~100 ms por hash, que a
// un puñado de logins no se nota y encarece bastante la fuerza bruta.
const RONDAS_BCRYPT = 10;
const LARGO_MINIMO_PASSWORD = 8;

export interface PermisoDto {
  modulo?: string | null;
  nivelFotos?: string | null;
  rolCostos?: string | null;
}

export interface CrearUsuarioDto {
  email?: string | null;
  nombre?: string | null;
  password?: string | null;
  permisos?: PermisoDto[] | null;
}

export interface EditarUsuarioDto {
  nombre?: string | null;
  estado?: string | null;
  password?: string | null;
  permisos?: PermisoDto[] | null;
}

@Injectable()
export class UsuarioService {
  constructor(private readonly prisma: PrismaService) {}

  private emailValido(valor: unknown): string {
    const s = limpiar(valor)?.toLowerCase();
    if (!s) throw new BadRequestException('El correo es obligatorio.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
      throw new BadRequestException(`El correo "${s}" no es válido.`);
    return s;
  }

  private passwordValida(valor: unknown): string {
    const s = limpiar(valor);
    if (!s) throw new BadRequestException('La contraseña es obligatoria.');
    if (s.length < LARGO_MINIMO_PASSWORD)
      throw new BadRequestException(
        `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
      );
    return s;
  }

  /**
   * Valida la lista de módulos.
   *
   * Aquí se hacen cumplir las dos reglas que la BD no puede expresar
   * (serían CHECK entre columnas, que Prisma no modela):
   *   · nivelFotos solo se admite si el módulo es FOTOS, donde es
   *     OPCIONAL (sin nivel = el supervisor de §4); null en los demás.
   *   · rolCostos es OBLIGATORIO si el módulo es COSTOS, y null si no.
   *
   * Los dos sub-roles se comprueban con el mismo esqueleto pero por
   * separado: son enums distintos y el mensaje de error tiene que nombrar
   * los valores de SU módulo, no una lista mezclada que no ayuda a nadie.
   */
  private permisosValidos(lista: PermisoDto[] | null | undefined): {
    modulo: Modulo;
    nivelFotos: NivelFotos | null;
    rolCostos: RolCostos | null;
  }[] {
    if (!Array.isArray(lista) || lista.length === 0)
      throw new BadRequestException(
        'Asigna al menos un módulo: sin módulos la cuenta no puede entrar a nada.',
      );

    const vistos = new Set<string>();
    return lista.map((p) => {
      const modulo = limpiar(p.modulo)?.toUpperCase();
      if (!modulo || !MODULOS.includes(modulo as (typeof MODULOS)[number]))
        throw new BadRequestException(
          `Módulo inválido: "${String(p.modulo)}". Valores permitidos: ${MODULOS.join(', ')}.`,
        );
      if (vistos.has(modulo))
        throw new BadRequestException(`El módulo ${modulo} está repetido.`);
      vistos.add(modulo);

      const nivel = limpiar(p.nivelFotos)?.toUpperCase();
      const rol = limpiar(p.rolCostos)?.toUpperCase();

      if (modulo === 'FOTOS') {
        // El nivel es OPCIONAL desde v3, y no es una relajación: sin nivel
        // es el supervisor de §4 —entra al módulo y solo alcanza lo que le
        // compartieron—, que es el caso más común de todos. Los tres
        // valores que sí existen conceden alcance sobre TODO el árbol, así
        // que exigir uno obligaría a regalar acceso global a quien no debe
        // tener ninguno.
        if (nivel && !NIVELES.includes(nivel as (typeof NIVELES)[number]))
          throw new BadRequestException(
            `Nivel de Fotos inválido: "${nivel}". Valores permitidos: ${NIVELES.join(', ')}, o ninguno para acceso solo a lo compartido.`,
          );
        if (rol)
          throw new BadRequestException(
            'El módulo Fotos no lleva rol de Costos: quita el rol.',
          );
        return {
          modulo: modulo as Modulo,
          nivelFotos: (nivel as NivelFotos | undefined) ?? null,
          rolCostos: null,
        };
      }

      if (modulo === 'COSTOS') {
        if (
          !rol ||
          !ROLES_COSTOS.includes(rol as (typeof ROLES_COSTOS)[number])
        )
          throw new BadRequestException(
            `El módulo Costos requiere un rol: ${ROLES_COSTOS.join(', ')}.`,
          );
        if (nivel)
          throw new BadRequestException(
            'El módulo Costos no lleva nivel de Fotos: quita el nivel.',
          );
        return {
          modulo: modulo as Modulo,
          nivelFotos: null,
          rolCostos: rol as RolCostos,
        };
      }

      if (nivel || rol)
        throw new BadRequestException(
          `El módulo ${modulo} no tiene sub-roles: quita el nivel y el rol.`,
        );
      return { modulo: modulo as Modulo, nivelFotos: null, rolCostos: null };
    });
  }

  private seleccion() {
    return {
      id: true,
      email: true,
      nombre: true,
      rol: true,
      estado: true,
      ultimoAcceso: true,
      creadoEn: true,
      permisos: {
        select: { id: true, modulo: true, nivelFotos: true, rolCostos: true },
        orderBy: { modulo: 'asc' as const },
      },
    };
  }

  async listar() {
    return this.prisma.usuario.findMany({
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
      select: this.seleccion(),
    });
  }

  async detalle(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: this.seleccion(),
    });
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado.`);
    return usuario;
  }

  /** Crea un Admin. El rol SUPERADMIN solo lo pone el script de semilla. */
  async crear(dto: CrearUsuarioDto) {
    const email = this.emailValido(dto.email);
    const nombre = limpiar(dto.nombre);
    if (!nombre) throw new BadRequestException('El nombre es obligatorio.');
    const password = this.passwordValida(dto.password);
    const permisos = this.permisosValidos(dto.permisos);

    const existe = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existe)
      throw new ConflictException(
        `Ya existe una cuenta con el correo ${email}.`,
      );

    return this.prisma.usuario.create({
      data: {
        email,
        nombre,
        passwordHash: await bcrypt.hash(password, RONDAS_BCRYPT),
        rol: 'ADMIN',
        permisos: { create: permisos },
      },
      select: this.seleccion(),
    });
  }

  /**
   * Edita nombre, estado, contraseña y/o módulos.
   * Los permisos se reemplazan enteros: mandar la lista nueva es más
   * simple de razonar que un diff de altas y bajas.
   */
  async editar(id: number, dto: EditarUsuarioDto) {
    const actual = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, rol: true },
    });
    if (!actual) throw new NotFoundException(`Usuario ${id} no encontrado.`);

    const data: Record<string, unknown> = {};

    if ('nombre' in dto) {
      const nombre = limpiar(dto.nombre);
      if (!nombre) throw new BadRequestException('El nombre es obligatorio.');
      data.nombre = nombre;
    }

    if ('estado' in dto && dto.estado !== null && dto.estado !== undefined) {
      const estado = limpiar(dto.estado)?.toUpperCase();
      if (!estado || !ESTADOS.includes(estado as (typeof ESTADOS)[number]))
        throw new BadRequestException(
          `Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}.`,
        );
      // El SuperAdmin no se puede desactivar: nadie más puede reactivarlo.
      if (actual.rol === 'SUPERADMIN' && estado === 'INACTIVO')
        throw new BadRequestException(
          'No se puede desactivar la cuenta SuperAdmin: sería imposible volver a entrar.',
        );
      data.estado = estado;
    }

    if (
      dto.password !== undefined &&
      dto.password !== null &&
      dto.password !== ''
    )
      data.passwordHash = await bcrypt.hash(
        this.passwordValida(dto.password),
        RONDAS_BCRYPT,
      );

    // El SuperAdmin no lleva permisos: entra a todo por su rol.
    const cambiaPermisos =
      dto.permisos !== undefined && actual.rol !== 'SUPERADMIN';
    const permisos = cambiaPermisos ? this.permisosValidos(dto.permisos) : null;

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0)
        await tx.usuario.update({ where: { id }, data: data as never });

      if (permisos) {
        await tx.permisoModulo.deleteMany({ where: { usuarioId: id } });
        await tx.permisoModulo.createMany({
          data: permisos.map((p) => ({ usuarioId: id, ...p })),
        });
      }

      return tx.usuario.findUnique({
        where: { id },
        select: this.seleccion(),
      });
    });
  }

  async eliminar(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, rol: true },
    });
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado.`);
    if (usuario.rol === 'SUPERADMIN')
      throw new BadRequestException(
        'No se puede eliminar la cuenta SuperAdmin.',
      );

    await this.prisma.usuario.delete({ where: { id } });
    return { ok: true, id };
  }
}
