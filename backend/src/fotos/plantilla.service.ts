import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import { rutaDe } from '../common/arbol-ruta';
import type { TipoNodoPlantilla } from '../../generated/prisma/enums';

const TIPOS = ['CARPETA', 'TAREA', 'ALBUM'] as const;

/** Un nodo tal como llega del formulario, con sus hijos anidados. */
export interface NodoPlantillaDto {
  tipo?: string | null;
  nombre?: string | null;
  descripcion?: string | null;
  hijos?: NodoPlantillaDto[];
}

export interface GuardarPlantillaDto {
  nombre?: string | null;
  descripcion?: string | null;
  activa?: boolean;
  nodos?: NodoPlantillaDto[];
}

/** Tope de nodos por plantilla. No es regla de negocio, es cordura. */
const MAX_NODOS = 200;

/**
 * Plantillas de estructura (§20).
 *
 * Una plantilla es un **molde**: «Inspección de Equipo» = Estado general,
 * Pernos, Soldaduras, Estructura, Evidencia fotográfica. Se aplica sobre una
 * carpeta y el sistema crea de golpe esas carpetas, tareas y álbumes.
 *
 * Resuelve dos problemas a la vez: el supervisor deja de teclear seis cosas
 * por equipo, y la nomenclatura sale igual en toda la empresa sin tener que
 * pedírselo a nadie —que es lo que hace comparables dos inspecciones—.
 *
 * ⚠️ **NO se versiona, al revés que `PlantillaCorreo` de Costos.** Allí cada
 * `SolicitudCotizacion` guarda con qué versión salió, así que reescribir una
 * plantilla cambiaría lo que dice un correo que ya está en el buzón de un
 * proveedor: versionar protege un registro histórico. Aquí aplicar una
 * plantilla **COPIA**, y la estructura resultante vive por su cuenta — no
 * queda nada apuntando hacia atrás que pueda empezar a mentir. Editar el
 * molde es exactamente lo que se quiere («desde ahora las inspecciones
 * llevan también Filtros») y lo ya creado sigue igual, que también.
 *
 * La señal de que haría falta versionar: el día que alguien pregunte «¿este
 * equipo se inspeccionó con el checklist viejo o con el nuevo?». Hoy nadie
 * puede preguntarlo, porque ninguna carpeta recuerda de dónde salió.
 */
@Injectable()
export class PlantillaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /**
   * Administrar plantillas es de nivel GLOBAL, no de carpeta.
   *
   * Una plantilla no vive dentro de ninguna carpeta: es criterio de empresa.
   * Si cada supervisor pudiera crear las suyas acabarían veinte plantillas
   * parecidas y volvería el problema que §20 quiere resolver — que cada uno
   * escriba «Pernos», «Revisar pernos» y «Pernería».
   */
  private exigirAdministrar(usuario: UsuarioAutenticado) {
    if (!this.acceso.tieneNivelMinimo(usuario, 'ADMIN_GLOBAL'))
      throw new BadRequestException(
        'Solo un administrador de Fotos puede crear o editar plantillas.',
      );
  }

  private validarTipo(valor: unknown): TipoNodoPlantilla {
    const tipo = (limpiar(valor) ?? '').toUpperCase();
    if (!TIPOS.includes(tipo as TipoNodoPlantilla))
      throw new BadRequestException(
        `Tipo de nodo inválido: "${describir(valor)}". Valores permitidos: ${TIPOS.join(', ')}.`,
      );
    return tipo as TipoNodoPlantilla;
  }

  /**
   * Aplana el árbol del formulario a filas, validando de paso.
   *
   * Se recorre en profundidad y se numera el `orden` por nivel, así que el
   * árbol se puede reconstruir después sin depender del id autoincremental.
   */
  private aplanar(
    nodos: NodoPlantillaDto[] | undefined,
    acumulado: {
      tipo: TipoNodoPlantilla;
      nombre: string;
      descripcion: string | null;
      orden: number;
      rutaPadre: number[];
    }[] = [],
    rutaPadre: number[] = [],
  ) {
    (nodos ?? []).forEach((nodo, indice) => {
      const tipo = this.validarTipo(nodo.tipo);
      const nombre = limpiar(nodo.nombre);
      if (nombre === null)
        throw new BadRequestException('Cada elemento necesita un nombre.');

      // Solo una CARPETA puede contener cosas: una tarea o un álbum son
      // hojas. Sin esta comprobación se podría definir un molde imposible
      // que solo fallaría al aplicarlo, cuando ya es tarde.
      if (tipo !== 'CARPETA' && (nodo.hijos ?? []).length > 0)
        throw new BadRequestException(
          `"${nombre}" es de tipo ${tipo} y no puede contener elementos dentro. Solo una CARPETA puede.`,
        );

      acumulado.push({
        tipo,
        nombre,
        descripcion: limpiar(nodo.descripcion),
        orden: indice,
        rutaPadre,
      });
      const miIndice = acumulado.length - 1;

      if (acumulado.length > MAX_NODOS)
        throw new BadRequestException(
          `La plantilla tiene demasiados elementos (máximo ${MAX_NODOS}).`,
        );

      this.aplanar(nodo.hijos, acumulado, [...rutaPadre, miIndice]);
    });

    return acumulado;
  }

  /** Reescribe los nodos de una plantilla. Se borran y se vuelven a crear. */
  private async reemplazarNodos(
    plantillaId: number,
    nodos: NodoPlantillaDto[] | undefined,
  ) {
    const planos = this.aplanar(nodos);

    await this.prisma.$transaction(async (tx) => {
      // Cascade se lleva los hijos: basta borrar los de primer nivel.
      await tx.plantillaEstructuraNodo.deleteMany({ where: { plantillaId } });

      // Se crean por niveles porque cada hijo necesita el id de su padre, y
      // `createMany` no lo devuelve.
      const ids: number[] = [];
      for (const nodo of planos) {
        const parentIndice = nodo.rutaPadre[nodo.rutaPadre.length - 1];
        const creado = await tx.plantillaEstructuraNodo.create({
          data: {
            plantillaId,
            parentId: parentIndice === undefined ? null : ids[parentIndice],
            tipo: nodo.tipo,
            nombre: nodo.nombre,
            descripcion: nodo.descripcion,
            orden: nodo.orden,
          },
          select: { id: true },
        });
        ids.push(creado.id);
      }
    });
  }

  async listar(soloActivas = false) {
    return this.prisma.plantillaEstructura.findMany({
      where: soloActivas ? { activa: true } : {},
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        activa: true,
        creadoEn: true,
        creadoPor: { select: { id: true, nombre: true } },
        _count: { select: { nodos: true } },
      },
    });
  }

  /** La plantilla con su árbol reconstruido. */
  async detalle(id: number) {
    const plantilla = await this.prisma.plantillaEstructura.findUnique({
      where: { id },
      include: {
        creadoPor: { select: { id: true, nombre: true } },
        nodos: { orderBy: [{ parentId: 'asc' }, { orden: 'asc' }] },
      },
    });
    if (!plantilla) throw new NotFoundException('Esa plantilla ya no existe.');

    // Árbol a partir de las filas planas, en una pasada.
    type Nodo = (typeof plantilla.nodos)[number] & { hijos: Nodo[] };
    const porId = new Map<number, Nodo>();
    for (const n of plantilla.nodos) porId.set(n.id, { ...n, hijos: [] });

    const raiz: Nodo[] = [];
    for (const n of porId.values()) {
      if (n.parentId === null) raiz.push(n);
      else porId.get(n.parentId)?.hijos.push(n);
    }

    return { ...plantilla, nodos: raiz };
  }

  async crear(usuario: UsuarioAutenticado, dto: GuardarPlantillaDto) {
    this.exigirAdministrar(usuario);

    const nombre = limpiar(dto.nombre);
    if (nombre === null)
      throw new BadRequestException('La plantilla necesita un nombre.');

    // Se valida ANTES de crear la fila: si el árbol está mal, no debe
    // quedar una plantilla vacía a medio hacer.
    this.aplanar(dto.nodos);

    // Tipo explícito: sin él, declararla vacía y asignarla dentro del `try`
    // la deja en `any` y el lint se llena de accesos inseguros.
    let plantilla: { id: number; nombre: string };
    try {
      plantilla = await this.prisma.plantillaEstructura.create({
        data: {
          nombre,
          descripcion: limpiar(dto.descripcion),
          creadoPorId: usuario.id,
        },
        select: { id: true, nombre: true },
      });
    } catch {
      throw new ConflictException(
        `Ya existe una plantilla llamada "${nombre}".`,
      );
    }

    await this.reemplazarNodos(plantilla.id, dto.nodos);

    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'PLANTILLA',
      entidadId: plantilla.id,
      accion: 'CREACION',
      descripcion: `Creó la plantilla "${plantilla.nombre}".`,
    });

    return this.detalle(plantilla.id);
  }

  /**
   * Editar. Los nodos solo se tocan si `nodos` viene en el DTO.
   *
   * Editar NO afecta a lo ya creado desde esta plantilla: se copió al
   * aplicarla. Ver la nota de la cabecera.
   */
  async editar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: GuardarPlantillaDto,
  ) {
    this.exigirAdministrar(usuario);

    const actual = await this.prisma.plantillaEstructura.findUnique({
      where: { id },
      select: { id: true, nombre: true, descripcion: true, activa: true },
    });
    if (!actual) throw new NotFoundException('Esa plantilla ya no existe.');

    const datos: Record<string, unknown> = {};
    if ('nombre' in dto) {
      const nombre = limpiar(dto.nombre);
      if (nombre === null)
        throw new BadRequestException('La plantilla necesita un nombre.');
      datos.nombre = nombre;
    }
    if ('descripcion' in dto) datos.descripcion = limpiar(dto.descripcion);
    if ('activa' in dto) datos.activa = dto.activa === true;

    try {
      await this.prisma.plantillaEstructura.update({
        where: { id },
        data: datos,
      });
    } catch {
      throw new ConflictException(
        `Ya existe una plantilla llamada "${String(datos.nombre)}".`,
      );
    }

    if ('nodos' in dto) await this.reemplazarNodos(id, dto.nodos);

    const despues = await this.prisma.plantillaEstructura.findUniqueOrThrow({
      where: { id },
      select: { nombre: true, descripcion: true, activa: true },
    });
    await this.auditoria.registrar(
      usuario,
      this.auditoria.diferencias(
        {
          nombre: actual.nombre,
          descripcion: actual.descripcion,
          activa: String(actual.activa),
        },
        {
          nombre: despues.nombre,
          descripcion: despues.descripcion,
          activa: String(despues.activa),
        },
        { carpetaId: null, entidad: 'PLANTILLA', entidadId: id },
      ),
    );

    return this.detalle(id);
  }

  async eliminar(usuario: UsuarioAutenticado, id: number) {
    this.exigirAdministrar(usuario);

    const plantilla = await this.prisma.plantillaEstructura.findUnique({
      where: { id },
      select: { nombre: true },
    });
    if (!plantilla) throw new NotFoundException('Esa plantilla ya no existe.');

    // Se puede borrar sin más: nada apunta a ella. Lo creado a partir de la
    // plantilla es una copia independiente y no se entera. Ésa es justamente
    // la propiedad que hace innecesario versionarla.
    await this.prisma.plantillaEstructura.delete({ where: { id } });

    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'PLANTILLA',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: `Eliminó la plantilla "${plantilla.nombre}".`,
    });

    return { ok: true, id };
  }

  /**
   * «Crear desde plantilla» (§20): estampa el molde dentro de una carpeta.
   *
   * Exige EDICION en la carpeta destino —crear ahí dentro es escribir— y NO
   * exige nivel global: administrar plantillas es de admin, USARLAS es de
   * cualquiera que trabaje en obra, que es el sentido de §20.
   *
   * Todo en UNA transacción: una estructura a medias sería peor que ninguna,
   * y es el mismo criterio que §19 pide para el Excel.
   */
  async aplicar(
    usuario: UsuarioAutenticado,
    plantillaId: number,
    carpetaId: number,
  ) {
    const destino = await this.acceso.exigirPermiso(
      usuario,
      carpetaId,
      'EDICION',
    );

    const plantilla = await this.prisma.plantillaEstructura.findUnique({
      where: { id: plantillaId },
      include: { nodos: { orderBy: [{ parentId: 'asc' }, { orden: 'asc' }] } },
    });
    if (!plantilla) throw new NotFoundException('Esa plantilla ya no existe.');
    if (!plantilla.activa)
      throw new BadRequestException(
        `La plantilla "${plantilla.nombre}" está desactivada.`,
      );
    if (plantilla.nodos.length === 0)
      throw new BadRequestException(
        `La plantilla "${plantilla.nombre}" no tiene ningún elemento.`,
      );

    const esEquipo = destino.tipo === 'EQUIPO';
    const creado = { carpetas: 0, tareas: 0, albumes: 0 };
    // Lo que la plantilla traía pero no cabía aquí. Se DEVUELVE en vez de
    // callarse: quien aplica «Inspección de Equipo» sobre una carpeta
    // corriente tiene que enterarse de que sus tareas no se crearon.
    const omitidas = { tareas: 0 };

    await this.prisma.$transaction(async (tx) => {
      // De cada nodo de la plantilla al id de la carpeta que se creó por él.
      const carpetaPorNodo = new Map<number, number>();

      for (const nodo of plantilla.nodos) {
        // El padre es la carpeta creada por el nodo padre, o la de destino.
        const padreId =
          nodo.parentId === null
            ? carpetaId
            : carpetaPorNodo.get(nodo.parentId);

        // Un nodo cuyo padre no es una carpeta no tiene dónde colgarse. No
        // puede pasar —`aplanar` lo impide al guardar— pero si una plantilla
        // vieja lo tuviera, se salta en vez de reventar la transacción.
        if (padreId === undefined) continue;

        if (nodo.tipo === 'CARPETA') {
          const padre = await tx.carpetaFotos.findUniqueOrThrow({
            where: { id: padreId },
            select: { ruta: true },
          });
          const hija = await tx.carpetaFotos.create({
            data: {
              nombre: nodo.nombre,
              parentId: padreId,
              propietarioId: usuario.id,
              ruta: '',
            },
            select: { id: true },
          });
          await tx.carpetaFotos.update({
            where: { id: hija.id },
            data: { ruta: rutaDe(hija.id, padre.ruta) },
          });
          carpetaPorNodo.set(nodo.id, hija.id);
          creado.carpetas++;
        } else if (nodo.tipo === 'TAREA') {
          // ⚠️ Las tareas solo existen dentro de un EQUIPO (§13), y esa regla
          // la hace cumplir `TareaService.crear`. Aquí se escribe con `tx`
          // directamente, así que hay que volver a comprobarla o la plantilla
          // sería una puerta trasera que la incumple.
          //
          // Una tarea solo cabe si su padre es el DESTINO y el destino es un
          // equipo: las carpetas que crea la propia plantilla son corrientes,
          // nunca de tipo EQUIPO —enlazarlas a un equipo del catálogo exige
          // elegir cuál, y un molde no puede saberlo—.
          if (padreId !== carpetaId || !esEquipo) {
            omitidas.tareas++;
            continue;
          }
          await tx.tareaFotos.create({
            data: {
              carpetaId: padreId,
              titulo: nodo.nombre,
              descripcion: nodo.descripcion,
              creadoPorId: usuario.id,
            },
          });
          creado.tareas++;
        } else {
          await tx.albumFotos.create({
            data: {
              carpetaId: padreId,
              nombre: nodo.nombre,
              descripcion: nodo.descripcion,
              creadoPorId: usuario.id,
            },
          });
          creado.albumes++;
        }
      }
    });

    await this.acceso.marcarActividad(destino.ruta);

    await this.auditoria.registrar(usuario, {
      carpetaId,
      entidad: 'PLANTILLA',
      entidadId: plantillaId,
      accion: 'CREACION_DESDE_PLANTILLA',
      descripcion:
        `Aplicó "${plantilla.nombre}": ${creado.carpetas} carpeta(s), ` +
        `${creado.tareas} tarea(s), ${creado.albumes} álbum(es).` +
        (omitidas.tareas > 0
          ? ` ${omitidas.tareas} tarea(s) omitida(s): el destino no es un equipo.`
          : ''),
    });

    return {
      ok: true,
      plantilla: plantilla.nombre,
      ...creado,
      omitidas,
      // El motivo, en lenguaje de usuario, para que la pantalla no tenga que
      // deducirlo de un contador.
      aviso:
        omitidas.tareas > 0
          ? `Se omitieron ${omitidas.tareas} tarea(s): solo se pueden crear dentro de una carpeta de equipo (§13).`
          : null,
    };
  }
}
