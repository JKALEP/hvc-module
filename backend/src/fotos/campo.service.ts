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
import { TipoCampoFotos } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';

export interface GuardarCampoDto {
  nombre?: string | null;
  tipo?: string | null;
  orden?: number | null;
  /** Solo con `tipo = LISTA`: las etiquetas que se podrán elegir. */
  opciones?: unknown;
}

export interface EditarCampoDto {
  nombre?: string | null;
  orden?: number | null;
  activo?: boolean | null;
}

/** Los tipos que llevan una lista de opciones detrás. Hoy solo uno. */
const TIPOS_CON_OPCIONES: TipoCampoFotos[] = [TipoCampoFotos.LISTA];

/**
 * El catálogo de campos de una carpeta de tipo EQUIPO (Fase 1b).
 *
 * Es la mitad «configurar» del EAV; la mitad «rellenar» está en
 * `ValorCampoFotosService`. Se parten así por lo mismo que en Gestión de
 * Equipos: son dos trabajos con dos permisos distintos —**definir** los
 * campos es administrar el módulo, **rellenarlos** es trabajar dentro de
 * una carpeta— y juntarlos en un service obligaría a que cada método
 * volviera a preguntarse cuál de los dos está haciendo.
 *
 * ⚠️ **El `tipo` es INMUTABLE al editar.** Cambiar un campo de TEXTO a
 * FECHA dejaría las filas ya escritas en la columna equivocada, y no hay
 * conversión que sea correcta para todos los valores («N/A» no es una
 * fecha). Mismo criterio que el `tipo` de `OpcionCatalogo` en Costos. Para
 * cambiar de tipo se crea otro campo y se desactiva éste, que conserva lo
 * capturado.
 */
@Injectable()
export class CampoFotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /**
   * Configurar los campos es de ADMIN_GLOBAL, no de quien los rellena.
   *
   * Es la misma frontera que ya separa administrar una plantilla (§20) de
   * aplicarla: si cada supervisor pudiera añadir campos habría veinte
   * parecidos —«Marca», «marca», «Fabricante»— y se perdería justo lo que
   * un catálogo configurable sirve para conseguir, que es que todos los
   * equipos se describan igual.
   */
  private exigirAdmin(usuario: UsuarioAutenticado) {
    if (!this.acceso.tieneNivelMinimo(usuario, 'ADMIN_GLOBAL'))
      throw new ForbiddenException(
        'Solo un administrador global de Fotos configura los campos de los equipos.',
      );
  }

  /**
   * Slug estable a partir del nombre.
   *
   * Se genera UNA vez y no se regenera al renombrar: la clave es lo que
   * usan el formulario y quien lea los valores por nombre de campo, así que
   * cambiarla al corregir una errata rompería lo que ya apunta a ella.
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

  private aTipo(valor: unknown): TipoCampoFotos {
    const s = limpiar(valor)?.toUpperCase();
    const validos = Object.values(TipoCampoFotos) as string[];
    if (s && validos.includes(s)) return s as TipoCampoFotos;
    throw new BadRequestException(
      `Tipo de campo inválido: "${describir(valor)}". Valores permitidos: ${validos.join(', ')}.`,
    );
  }

  /** Etiquetas limpias y sin repetir, conservando el orden de llegada. */
  private aEtiquetas(valor: unknown): string[] {
    if (!Array.isArray(valor)) return [];
    const vistas = new Set<string>();
    for (const v of valor) {
      const s = limpiar(v);
      if (s) vistas.add(s);
    }
    return [...vistas];
  }

  private seleccion() {
    return {
      id: true,
      nombre: true,
      clave: true,
      tipo: true,
      orden: true,
      activo: true,
      opciones: {
        orderBy: [{ orden: 'asc' as const }, { id: 'asc' as const }],
        select: { id: true, etiqueta: true, orden: true, activo: true },
      },
      _count: { select: { valores: true } },
    };
  }

  /**
   * Los campos definidos.
   *
   * Leerlos NO exige ser administrador: cualquiera con el módulo necesita
   * la lista para pintar el formulario de un equipo. Son nombres de campo,
   * no datos de nadie.
   */
  async listar(soloActivos = false) {
    return this.prisma.definicionCampoFotos.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      select: this.seleccion(),
    });
  }

  async crear(usuario: UsuarioAutenticado, dto: GuardarCampoDto) {
    this.exigirAdmin(usuario);

    const nombre = limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException('El nombre del campo es obligatorio.');
    const tipo = this.aTipo(dto.tipo);

    const clave = this.aClave(nombre);
    if (!clave)
      throw new BadRequestException(
        `"${nombre}" no deja ninguna clave utilizable. Usa al menos una letra o un número.`,
      );

    const etiquetas = this.aEtiquetas(dto.opciones);
    if (TIPOS_CON_OPCIONES.includes(tipo) && etiquetas.length === 0)
      throw new BadRequestException(
        'Un campo de tipo LISTA necesita al menos una opción para elegir.',
      );
    if (!TIPOS_CON_OPCIONES.includes(tipo) && etiquetas.length > 0)
      throw new BadRequestException(
        `Un campo de tipo ${tipo} no lleva opciones: quita la lista.`,
      );

    const repetida = await this.prisma.definicionCampoFotos.findUnique({
      where: { clave },
      select: { nombre: true },
    });
    if (repetida)
      throw new ConflictException(
        `Ya hay un campo con la clave "${clave}" (es el campo "${repetida.nombre}"). Usa otro nombre.`,
      );

    const creado = await this.prisma.definicionCampoFotos.create({
      data: {
        nombre,
        clave,
        tipo,
        orden: Number.isInteger(dto.orden) ? (dto.orden as number) : 0,
        opciones: {
          create: etiquetas.map((etiqueta, i) => ({ etiqueta, orden: i })),
        },
      },
      select: this.seleccion(),
    });

    // §23. `carpetaId` en null: configurar el módulo no cuelga de ninguna
    // carpeta, igual que publicar una plantilla.
    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'CAMPO_EQUIPO',
      entidadId: creado.id,
      accion: 'CREACION',
      descripcion: `Creó el campo de equipo "${nombre}" (${tipo}).`,
    });
    return creado;
  }

  /** Renombrar, reordenar y activar/desactivar. El `tipo` no se toca. */
  async editar(usuario: UsuarioAutenticado, id: number, dto: EditarCampoDto) {
    this.exigirAdmin(usuario);
    const actual = await this.exigirCampo(id);

    const data: Record<string, unknown> = {};
    const cambios: string[] = [];

    if ('nombre' in dto) {
      const nombre = limpiar(dto.nombre);
      if (!nombre)
        throw new BadRequestException('El nombre del campo es obligatorio.');
      if (nombre !== actual.nombre) {
        data.nombre = nombre;
        cambios.push(`nombre: "${actual.nombre}" → "${nombre}"`);
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
      cambios.push(dto.activo ? 'se reactivó' : 'se desactivó');
    }

    if (Object.keys(data).length === 0) return this.detalle(id);

    const editado = await this.prisma.definicionCampoFotos.update({
      where: { id },
      data,
      select: this.seleccion(),
    });

    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'CAMPO_EQUIPO',
      entidadId: id,
      accion: 'EDICION',
      descripcion: `Editó el campo de equipo "${actual.nombre}" — ${cambios.join(' · ')}.`,
    });
    return editado;
  }

  /**
   * Eliminar de verdad, y SOLO si nadie lo usa.
   *
   * Con valores capturados se rechaza y se ofrece desactivar, que es la vía
   * normal: esos valores los tomó alguien en obra y borrar la definición se
   * los llevaría por cascada.
   *
   * ⚠️ Y hay una segunda razón, específica de aquí: un campo de tipo FOTO
   * tiene objetos en R2 que la base no sabe borrar. Al no permitir el
   * borrado con valores, ese caso sencillamente no puede darse — que es
   * mejor que recordar retirarlos en este método.
   */
  async eliminar(usuario: UsuarioAutenticado, id: number) {
    this.exigirAdmin(usuario);
    const campo = await this.exigirCampo(id);

    const enUso = await this.prisma.valorCampoFotos.count({
      where: { definicionId: id },
    });
    if (enUso > 0)
      throw new BadRequestException(
        `No se puede eliminar: ${enUso} equipo(s) tienen "${campo.nombre}" rellenado. ` +
          'Desactívalo en su lugar: deja de pedirse en el formulario y lo ya capturado se conserva.',
      );

    await this.prisma.definicionCampoFotos.delete({ where: { id } });

    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'CAMPO_EQUIPO',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: `Eliminó el campo de equipo "${campo.nombre}".`,
    });
    return { ok: true, id };
  }

  // ── Opciones de un campo LISTA ────────────────────────────────

  async agregarOpcion(usuario: UsuarioAutenticado, id: number, valor: unknown) {
    this.exigirAdmin(usuario);
    const campo = await this.exigirCampo(id);
    if (!TIPOS_CON_OPCIONES.includes(campo.tipo))
      throw new BadRequestException(
        `El campo "${campo.nombre}" es de tipo ${campo.tipo} y no lleva opciones.`,
      );

    const etiqueta = limpiar(valor);
    if (!etiqueta)
      throw new BadRequestException('La opción no puede estar vacía.');

    const repetida = await this.prisma.opcionCampoFotos.findFirst({
      where: { definicionId: id, etiqueta },
      select: { id: true },
    });
    if (repetida)
      throw new ConflictException(
        `El campo "${campo.nombre}" ya tiene la opción "${etiqueta}".`,
      );

    const ultima = await this.prisma.opcionCampoFotos.findFirst({
      where: { definicionId: id },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });

    await this.prisma.opcionCampoFotos.create({
      data: { definicionId: id, etiqueta, orden: (ultima?.orden ?? -1) + 1 },
    });
    return this.detalle(id);
  }

  /**
   * Retira una opción. Si alguien la eligió, se desactiva en vez de borrar.
   *
   * La FK es `Restrict`, así que borrarla a secas fallaría con un error
   * crudo; aquí se comprueba antes para poder decir por qué y hacer lo
   * correcto, que es lo mismo que hace `eliminar` con la definición.
   */
  async eliminarOpcion(usuario: UsuarioAutenticado, opcionId: number) {
    this.exigirAdmin(usuario);
    const opcion = await this.prisma.opcionCampoFotos.findUnique({
      where: { id: opcionId },
      select: {
        id: true,
        etiqueta: true,
        definicionId: true,
        _count: { select: { elegidaEn: true } },
      },
    });
    if (!opcion) throw new NotFoundException('Esa opción ya no existe.');

    if (opcion._count.elegidaEn > 0) {
      await this.prisma.opcionCampoFotos.update({
        where: { id: opcionId },
        data: { activo: false },
      });
      return this.detalle(opcion.definicionId);
    }

    await this.prisma.opcionCampoFotos.delete({ where: { id: opcionId } });
    return this.detalle(opcion.definicionId);
  }

  // ── Auxiliares ────────────────────────────────────────────────

  async detalle(id: number) {
    const campo = await this.prisma.definicionCampoFotos.findUnique({
      where: { id },
      select: this.seleccion(),
    });
    if (!campo) throw new NotFoundException('Ese campo ya no existe.');
    return campo;
  }

  private async exigirCampo(id: number) {
    const campo = await this.prisma.definicionCampoFotos.findUnique({
      where: { id },
      select: { id: true, nombre: true, tipo: true, orden: true, activo: true },
    });
    if (!campo) throw new NotFoundException('Ese campo ya no existe.');
    return campo;
  }
}
