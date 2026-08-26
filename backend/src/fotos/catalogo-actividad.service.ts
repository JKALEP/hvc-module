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
import { CicloService } from './ciclo.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import type { TipoEvidenciaFotos } from '../../generated/prisma/enums';

const EVIDENCIAS = ['NINGUNA', 'UNA', 'ANTES_DESPUES'] as const;
import { aId } from '../common/validacion';

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

export interface GuardarDefinicionActividadDto {
  nombre?: string | null;
  descripcion?: string | null;
  orden?: number | null;
  activo?: boolean | null;
  /** Los tipos de sistema para los que se propone. Reemplaza la lista entera. */
  tiposSistema?: unknown;
  /** Qué evidencia propone pedir (Fase 3): NINGUNA, UNA o ANTES_DESPUES. */
  evidencia?: string | null;
}

const SELECT_DEFINICION = {
  id: true,
  nombre: true,
  descripcion: true,
  orden: true,
  activo: true,
  evidencia: true,
  tipos: {
    select: {
      tipoSistema: {
        select: {
          id: true,
          nombre: true,
          activo: true,
          familia: { select: { id: true, nombre: true } },
        },
      },
    },
  },
} as const;

/**
 * El catálogo de actividades estándar (Fase 2 del rediseño).
 *
 * Resuelve para las visitas el mismo problema que §20 resolvía para las
 * estructuras: sin catálogo, uno escribe «Pernos», otro «Revisar pernos» y
 * otro «Pernería», y entonces no se puede comparar una visita con la
 * siguiente ni contar nada.
 *
 * ⚠️ **Define el checklist, NO lo impone.** Al dar de alta un equipo se
 * PRESELECCIONAN las actividades de su tipo de sistema y quien lo crea las
 * ajusta; dentro de un ciclo abierto se pueden seguir añadiendo. Y lo que se
 * escribe en `ActividadFotos` es una COPIA del nombre, no una FK: renombrar
 * una definición no puede reescribir lo que dice una visita ya hecha. Es el
 * mismo criterio que `CostoItem` con los ítems de Costos.
 *
 * ⚠️ Y por eso mismo **no hay «actualizar las actividades ya creadas»**. Si
 * el catálogo pudiera propagarse hacia atrás, un cambio de hoy alteraría el
 * checklist de una inspección de marzo, que es exactamente lo que el
 * historial existe para impedir.
 */
@Injectable()
export class CatalogoActividadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
    private readonly ciclos: CicloService,
  ) {}

  /** El tipo de evidencia que propone la definición (Fase 3). */
  private evidenciaValida(valor: unknown): TipoEvidenciaFotos | null {
    const texto = limpiar(valor);
    if (texto === null) return null;
    const evidencia = texto.toUpperCase();
    if (!EVIDENCIAS.includes(evidencia as TipoEvidenciaFotos))
      throw new BadRequestException(
        `Tipo de evidencia inválido: "${describir(valor)}". Valores permitidos: ${EVIDENCIAS.join(', ')}.`,
      );
    return evidencia as TipoEvidenciaFotos;
  }

  private exigirAdmin(usuario: UsuarioAutenticado) {
    if (!this.acceso.tieneNivelMinimo(usuario, 'ADMIN_GLOBAL'))
      throw new ForbiddenException(
        'Solo un administrador global de Fotos configura el catálogo de actividades.',
      );
  }

  /** La lista de ids de tipos de sistema que llega en el cuerpo. */
  private async tiposValidos(valor: unknown): Promise<number[]> {
    if (valor === null || valor === undefined) return [];
    if (!Array.isArray(valor))
      throw new BadRequestException(
        'Los tipos de sistema tienen que llegar como una lista.',
      );
    const ids = [
      ...new Set(
        valor.map((v) => aId(v, 'Uno de los tipos de sistema no es válido.')),
      ),
    ];
    if (ids.length === 0) return [];

    const existentes = await this.prisma.tipoSistemaFotos.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existentes.length !== ids.length)
      throw new NotFoundException(
        'Alguno de los tipos de sistema indicados ya no existe.',
      );
    return ids;
  }

  /** Aplana la fila puente: quien consume quiere los tipos, no la asociación. */
  private aplanar<
    T extends { tipos: { tipoSistema: Record<string, unknown> }[] },
  >(d: T) {
    return { ...d, tipos: d.tipos.map((t) => t.tipoSistema) };
  }

  /**
   * El catálogo.
   *
   * `tipoSistemaId` lo acota a lo que se propone para ese tipo, que es lo que
   * pide el formulario de alta de un equipo. Leerlo NO exige ser
   * administrador: hace falta para preseleccionar, y son nombres de tarea.
   */
  async listar(
    opciones: { soloActivas?: boolean; tipoSistemaId?: unknown } = {},
  ) {
    const tipoSistemaId =
      opciones.tipoSistemaId === null || opciones.tipoSistemaId === undefined
        ? null
        : aId(opciones.tipoSistemaId, 'El tipo de sistema no es válido.');

    const definiciones = await this.prisma.definicionActividadFotos.findMany({
      where: {
        ...(opciones.soloActivas ? { activo: true } : {}),
        ...(tipoSistemaId !== null
          ? { tipos: { some: { tipoSistemaId } } }
          : {}),
      },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      select: SELECT_DEFINICION,
    });
    return definiciones.map((d) => this.aplanar(d));
  }

  async crear(usuario: UsuarioAutenticado, dto: GuardarDefinicionActividadDto) {
    this.exigirAdmin(usuario);
    const nombre = limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException(
        'El nombre de la actividad es obligatorio.',
      );

    const repetida = await this.prisma.definicionActividadFotos.findUnique({
      where: { nombre },
      select: { id: true },
    });
    if (repetida)
      throw new ConflictException(
        `Ya existe una actividad de catálogo llamada "${nombre}".`,
      );

    const tipos = await this.tiposValidos(dto.tiposSistema);

    const creada = await this.prisma.definicionActividadFotos.create({
      data: {
        nombre,
        descripcion: limpiar(dto.descripcion),
        orden: Number.isInteger(dto.orden) ? (dto.orden as number) : 0,
        ...(this.evidenciaValida(dto.evidencia)
          ? { evidencia: this.evidenciaValida(dto.evidencia)! }
          : {}),
        tipos: { create: tipos.map((tipoSistemaId) => ({ tipoSistemaId })) },
      },
      select: SELECT_DEFINICION,
    });

    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'DEFINICION_ACTIVIDAD',
      entidadId: creada.id,
      accion: 'CREACION',
      descripcion:
        `Añadió "${nombre}" al catálogo de actividades` +
        (tipos.length > 0 ? `, para ${tipos.length} tipo(s) de sistema.` : '.'),
    });
    return this.aplanar(creada);
  }

  async editar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: GuardarDefinicionActividadDto,
  ) {
    this.exigirAdmin(usuario);
    const actual = await this.prisma.definicionActividadFotos.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        orden: true,
        activo: true,
        evidencia: true,
      },
    });
    if (!actual)
      throw new NotFoundException('Esa actividad de catálogo ya no existe.');

    const data: Record<string, unknown> = {};
    const cambios: string[] = [];

    if ('nombre' in dto) {
      const nombre = limpiar(dto.nombre);
      if (!nombre)
        throw new BadRequestException(
          'El nombre de la actividad es obligatorio.',
        );
      if (nombre !== actual.nombre) {
        const otra = await this.prisma.definicionActividadFotos.findUnique({
          where: { nombre },
          select: { id: true },
        });
        if (otra)
          throw new ConflictException(
            `Ya existe una actividad de catálogo llamada "${nombre}".`,
          );
        data.nombre = nombre;
        cambios.push(`nombre: "${actual.nombre}" → "${nombre}"`);
      }
    }
    if ('descripcion' in dto) {
      const descripcion = limpiar(dto.descripcion);
      if (descripcion !== actual.descripcion) {
        data.descripcion = descripcion;
        cambios.push('descripción');
      }
    }
    if (dto.orden !== null && dto.orden !== undefined) {
      if (!Number.isInteger(dto.orden))
        throw new BadRequestException(
          'El orden tiene que ser un número entero.',
        );
      if (dto.orden !== actual.orden) {
        data.orden = dto.orden;
        cambios.push(`orden: ${actual.orden} → ${dto.orden}`);
      }
    }
    if (typeof dto.activo === 'boolean' && dto.activo !== actual.activo) {
      data.activo = dto.activo;
      cambios.push(dto.activo ? 'se reactivó' : 'se retiró');
    }
    if ('evidencia' in dto) {
      const evidencia = this.evidenciaValida(dto.evidencia);
      if (evidencia === null)
        throw new BadRequestException(
          `El tipo de evidencia es obligatorio. Valores permitidos: ${EVIDENCIAS.join(', ')}.`,
        );
      if (evidencia !== actual.evidencia) {
        data.evidencia = evidencia;
        cambios.push(`evidencia: ${actual.evidencia} → ${evidencia}`);
      }
    }

    // ⚠️ La lista de tipos se REEMPLAZA entera cuando llega, y se deja
    // intacta cuando no llega. Es la misma semántica parcial de los valores
    // de campo: `undefined` es «no toques», y una lista vacía es «ninguno».
    const reemplazaTipos = dto.tiposSistema !== undefined;
    const tipos = reemplazaTipos
      ? await this.tiposValidos(dto.tiposSistema)
      : [];

    if (Object.keys(data).length === 0 && !reemplazaTipos)
      return this.detalle(id);

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0)
        await tx.definicionActividadFotos.update({ where: { id }, data });
      if (reemplazaTipos) {
        await tx.actividadPorTipoSistema.deleteMany({
          where: { definicionId: id },
        });
        if (tipos.length > 0)
          await tx.actividadPorTipoSistema.createMany({
            data: tipos.map((tipoSistemaId) => ({
              definicionId: id,
              tipoSistemaId,
            })),
          });
        cambios.push(`tipos de sistema: ${tipos.length}`);
      }
    });

    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'DEFINICION_ACTIVIDAD',
      entidadId: id,
      accion: 'EDICION',
      descripcion: `Editó "${actual.nombre}" del catálogo — ${cambios.join(' · ')}.`,
    });
    return this.detalle(id);
  }

  /**
   * Borrado real.
   *
   * ⚠️ Y aquí SÍ se puede borrar aunque «se haya usado», al revés que un
   * estado de equipo o un tipo de sistema. La diferencia es que nada apunta
   * aquí: las actividades de un ciclo copiaron el nombre y viven por su
   * cuenta, así que borrar una definición no deja ninguna fila coja ni
   * cambia una sola visita. Lo único que se pierde es la propuesta para las
   * próximas altas.
   */
  async eliminar(usuario: UsuarioAutenticado, id: number) {
    this.exigirAdmin(usuario);
    const definicion = await this.prisma.definicionActividadFotos.findUnique({
      where: { id },
      select: { nombre: true },
    });
    if (!definicion)
      throw new NotFoundException('Esa actividad de catálogo ya no existe.');

    await this.prisma.definicionActividadFotos.delete({ where: { id } });
    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'DEFINICION_ACTIVIDAD',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: `Retiró "${definicion.nombre}" del catálogo de actividades.`,
    });
    return { ok: true, id };
  }

  async detalle(id: number) {
    const definicion = await this.prisma.definicionActividadFotos.findUnique({
      where: { id },
      select: SELECT_DEFINICION,
    });
    if (!definicion)
      throw new NotFoundException('Esa actividad de catálogo ya no existe.');
    return this.aplanar(definicion);
  }

  // ── Estampar el catálogo en un ciclo ──────────────────────────

  /**
   * Las que se proponen para un tipo de sistema. Solo ACTIVAS.
   *
   * Es «la preselección» de la Fase 2: lo que el formulario de alta marca por
   * defecto y lo que se estampa cuando nadie dice otra cosa.
   */
  private async propuestasPara(tipoSistemaId: number | null) {
    if (tipoSistemaId === null) return [];
    return this.prisma.definicionActividadFotos.findMany({
      where: { activo: true, tipos: { some: { tipoSistemaId } } },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      select: { id: true, nombre: true, descripcion: true, evidencia: true },
    });
  }

  /**
   * Escribe el checklist inicial de un ciclo recién creado.
   *
   * Lo llama `CarpetaService.crear` DENTRO de su transacción, igual que
   * `CicloService.abrirPrimeroEn`: un equipo que nace con su ciclo y su
   * checklist a medias es peor que uno que no nace.
   *
   * ⚠️ **`undefined` y `[]` significan cosas distintas, y la diferencia es
   * toda la función.** Sin lista, se estampa la preselección del tipo de
   * sistema —que es lo que quiere quien da de alta un equipo y no toca nada—;
   * con lista vacía, ninguna, porque alguien las desmarcó todas a propósito.
   * Colapsar los dos casos habría obligado a elegir entre no preseleccionar
   * nunca o no poder decir que no.
   *
   * No comprueba permisos, por lo mismo que `abrirPrimeroEn`: el permiso ya
   * se decidió arriba y la carpeta todavía no está confirmada.
   */
  async estamparEn(
    tx: Tx,
    cicloId: number,
    usuarioId: number,
    tipoSistemaId: number | null,
    elegidas: number[] | undefined,
  ) {
    const propuestas = await this.propuestasPara(tipoSistemaId);

    const aCrear =
      elegidas === undefined
        ? propuestas
        : propuestas.filter((p) => elegidas.includes(p.id));

    // Una elección que no está entre las propuestas se ignora en silencio a
    // propósito: viene de una pantalla que ya mostró la lista, así que solo
    // puede ser una carrera con un cambio de catálogo, y fallar el alta
    // entera del equipo por eso sería el peor desenlace posible en obra.
    if (aCrear.length === 0) return 0;

    await tx.actividadFotos.createMany({
      data: aCrear.map((p) => ({
        cicloId,
        titulo: p.nombre,
        descripcion: p.descripcion,
        // La evidencia se COPIA, como el nombre y por lo mismo: cambiarla en
        // el catálogo no puede reescribir lo que se le pidió a una visita.
        evidencia: p.evidencia,
        creadoPorId: usuarioId,
      })),
    });
    return aCrear.length;
  }

  /**
   * Añade actividades del catálogo a un ciclo YA abierto.
   *
   * Existe porque el catálogo no puede servir solo en el alta: un equipo dado
   * de alta antes de que HVC cargara su checklist se quedaría sin él para
   * siempre, y cambiar el tipo de sistema de un equipo no reescribe sus
   * visitas (ni debe).
   *
   * Salta las que ya están por TÍTULO, no por id: la actividad del ciclo es
   * una copia, así que el título es lo único que las relaciona — y es lo que
   * evita duplicar «Limpieza de filtros» al pulsar dos veces.
   */
  async anadirACiclo(
    usuario: UsuarioAutenticado,
    cicloId: number,
    definicionIds: unknown,
  ) {
    const ciclo = await this.ciclos.exigirCiclo(usuario, cicloId, 'EDICION');
    this.ciclos.exigirAbierto(ciclo);

    if (!Array.isArray(definicionIds) || definicionIds.length === 0)
      throw new BadRequestException(
        'Elige al menos una actividad del catálogo.',
      );
    const ids = [
      ...new Set(
        definicionIds.map((v) =>
          aId(v, 'Una de las actividades elegidas no es válida.'),
        ),
      ),
    ];

    const definiciones = await this.prisma.definicionActividadFotos.findMany({
      where: { id: { in: ids } },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      select: { id: true, nombre: true, descripcion: true, evidencia: true },
    });
    if (definiciones.length === 0)
      throw new NotFoundException(
        'Ninguna de las actividades elegidas existe ya.',
      );

    const yaEstan = await this.prisma.actividadFotos.findMany({
      where: { cicloId, titulo: { in: definiciones.map((d) => d.nombre) } },
      select: { titulo: true },
    });
    const titulos = new Set(yaEstan.map((a) => a.titulo));
    const nuevas = definiciones.filter((d) => !titulos.has(d.nombre));

    if (nuevas.length > 0)
      await this.prisma.actividadFotos.createMany({
        data: nuevas.map((d) => ({
          cicloId,
          titulo: d.nombre,
          descripcion: d.descripcion,
          evidencia: d.evidencia,
          creadoPorId: usuario.id,
        })),
      });

    await this.acceso.marcarActividad(ciclo.carpeta.ruta);
    if (nuevas.length > 0)
      await this.auditoria.registrar(usuario, {
        carpetaId: ciclo.carpetaId,
        entidad: 'ACTIVIDAD',
        entidadId: ciclo.id,
        accion: 'CREACION',
        descripcion:
          `Añadió ${nuevas.length} actividad(es) del catálogo al ciclo ` +
          `${ciclo.numero} de "${ciclo.carpeta.nombre}".`,
      });

    return {
      anadidas: nuevas.length,
      omitidas: definiciones.length - nuevas.length,
    };
  }
}
