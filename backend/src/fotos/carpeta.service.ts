import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import { aIdOpcional } from '../common/validacion';
import { estaEnRama, reprefijar, rutaDe } from '../common/arbol-ruta';
import type { TipoCarpetaFotos } from '../../generated/prisma/enums';

export interface CrearCarpetaDto {
  nombre?: string | null;
  parentId?: number | string | null;
  /** `CARPETA` (por defecto) o `EQUIPO` (§12). */
  tipo?: string | null;
  /** Obligatorio con `tipo = EQUIPO`, prohibido con `CARPETA`. */
  equipoId?: number | string | null;
}

export interface EditarCarpetaDto {
  nombre?: string | null;
  parentId?: number | string | null;
}

@Injectable()
export class CarpetaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /** Ruta materializada del nodo: la de su madre más su propio id. */
  private async calcularRuta(id: number, parentId: number | null) {
    if (parentId === null) return rutaDe(id, null);
    const padre = await this.prisma.carpetaFotos.findUnique({
      where: { id: parentId },
      select: { ruta: true },
    });
    if (!padre)
      throw new NotFoundException(
        'La carpeta donde quieres crearla ya no existe.',
      );
    return rutaDe(id, padre.ruta);
  }

  /**
   * Valida el par `tipo` / `equipoId` de §12.
   *
   * El CHECK `carpetas_fotos_equipo_segun_tipo_chk` ya impide la fila
   * imposible, pero un CHECK habla en inglés y sin contexto: aquí se
   * traduce a lo que el usuario hizo mal, y se comprueba además que el
   * equipo EXISTA —eso la FK lo dice, pero también con un error crudo—.
   *
   * Fotos no crea equipos por esta puerta: el equipo tiene que estar ya en
   * el catálogo. Para registrarlo sin salir de Fotos está el atajo de
   * `CatalogoEquiposService`, que es otra ruta y otro permiso.
   */
  private async tipoYEquipo(dto: CrearCarpetaDto): Promise<{
    tipo: TipoCarpetaFotos;
    equipoId: number | null;
  }> {
    // `toUpperCase()` devuelve `string`, y comparar un `string` contra dos
    // literales no lo estrecha a la unión: de ahí el tipo de retorno
    // explícito en vez de un cast, que `eslint --fix` borra por creerlo
    // innecesario y deja el fallo para el siguiente `tsc`.
    const tipo = (limpiar(dto.tipo) ?? 'CARPETA').toUpperCase();
    if (tipo !== 'CARPETA' && tipo !== 'EQUIPO')
      throw new BadRequestException(
        `Tipo de carpeta inválido: "${describir(dto.tipo)}". Valores permitidos: CARPETA, EQUIPO.`,
      );

    const equipoId = aIdOpcional(
      dto.equipoId,
      'El equipo que indicaste no es válido.',
    );

    if (tipo === 'EQUIPO' && equipoId === null)
      throw new BadRequestException(
        'Una carpeta de tipo EQUIPO tiene que apuntar a un equipo del catálogo.',
      );
    if (tipo === 'CARPETA' && equipoId !== null)
      throw new BadRequestException(
        'Solo una carpeta de tipo EQUIPO puede apuntar a un equipo.',
      );

    if (equipoId !== null) {
      const existe = await this.prisma.equipo.findUnique({
        where: { id: equipoId },
        select: { id: true },
      });
      if (!existe)
        throw new NotFoundException(
          'Ese equipo no está en el catálogo de Gestión de equipos.',
        );
    }

    return { tipo: tipo, equipoId };
  }

  /**
   * Crea una carpeta, corriente o de tipo EQUIPO (§12).
   *
   * Dentro de otra exige EDICION sobre la madre (§5: crear subcarpetas es
   * de Editor). En la raíz no hay madre cuyo permiso mirar, así que decide
   * el nivel global — ver `puedeCrearRaiz`.
   */
  async crear(usuario: UsuarioAutenticado, dto: CrearCarpetaDto) {
    const nombre = limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException('El nombre de la carpeta es obligatorio.');
    const parentId = aIdOpcional(
      dto.parentId,
      'La carpeta que indicaste no es válida.',
    );
    const { tipo, equipoId } = await this.tipoYEquipo(dto);

    if (parentId === null) {
      if (!this.acceso.puedeCrearRaiz(usuario))
        throw new ForbiddenException(
          'No puedes crear carpetas de primer nivel. Crea la tuya dentro de una carpeta compartida contigo.',
        );
    } else {
      // EDICION sobre la madre, y que la rama no esté archivada.
      await this.acceso.exigirPermiso(usuario, parentId, 'EDICION');
    }

    const repetida = await this.prisma.carpetaFotos.findFirst({
      where: { parentId, nombre },
      select: { id: true },
    });
    if (repetida)
      throw new ConflictException(
        `Ya existe una carpeta llamada "${nombre}" en este mismo sitio.`,
      );

    // La ruta necesita el id, que no existe hasta insertar: se crea con
    // ruta provisional y se corrige en la misma transacción.
    const creada = await this.prisma.$transaction(async (tx) => {
      const carpeta = await tx.carpetaFotos.create({
        // `propietarioId` es de §6 y se fija aquí para siempre: quien
        // crea una carpeta es su propietario, y eso es uno de los seis
        // escalones de §25.
        data: {
          nombre,
          parentId,
          ruta: '',
          propietarioId: usuario.id,
          tipo,
          equipoId,
        },
      });
      const ruta = await this.calcularRuta(carpeta.id, parentId);
      return tx.carpetaFotos.update({
        where: { id: carpeta.id },
        data: { ruta },
      });
    });

    // Crear una subcarpeta es actividad de toda la línea de arriba.
    await this.acceso.marcarActividad(creada.ruta);

    // §23, acción 1 de 13.
    await this.auditoria.registrar(usuario, {
      carpetaId: creada.id,
      entidad: 'CARPETA',
      entidadId: creada.id,
      accion: 'CREACION',
      descripcion: `Creó la carpeta "${creada.nombre}".`,
    });
    return creada;
  }

  /**
   * Renombrar y/o mover. Las dos cosas son EDICION (§5: «modificar y
   * organizar contenido»).
   *
   * Mover exige el permiso en ORIGEN **y** en DESTINO: si no, se podría
   * sacar una rama del alcance de otro o meterla en él, y la cascada de
   * acceso cambiaría con ella sin que nadie lo decidiera. Mover A LA RAÍZ
   * exige además `puedeCrearRaiz`, por lo mismo que crearla ahí: la raíz no
   * es de nadie, así que no hay permiso de carpeta que la defienda.
   *
   * Archivar salió de aquí a `archivar()`: tenía otra regla de permiso, otro
   * mínimo y su propia excepción sobre la rama cerrada, y convivir con esto
   * obligaba a un `soloArchivar` que había que leer dos veces.
   */
  async editar(usuario: UsuarioAutenticado, id: number, dto: EditarCarpetaDto) {
    const actual = await this.acceso.exigirPermiso(usuario, id, 'EDICION');

    const data: Record<string, unknown> = {};
    let nombreFinal = actual.nombre;

    if ('nombre' in dto) {
      const nombre = limpiar(dto.nombre);
      if (!nombre)
        throw new BadRequestException(
          'El nombre de la carpeta es obligatorio.',
        );
      data.nombre = nombre;
      nombreFinal = nombre;
    }

    // ¿Se mueve de sitio?
    const mueve = 'parentId' in dto;
    const nuevoPadre = mueve
      ? aIdOpcional(dto.parentId, 'La carpeta que indicaste no es válida.')
      : actual.parentId;
    const seMueve = mueve && nuevoPadre !== actual.parentId;

    let rutaNueva = actual.ruta;

    if (seMueve) {
      if (nuevoPadre === id)
        throw new BadRequestException(
          'Una carpeta no puede estar dentro de sí misma.',
        );

      if (nuevoPadre === null) {
        // Sacarla al primer nivel es, a efectos de permisos, crearla ahí.
        if (!this.acceso.puedeCrearRaiz(usuario))
          throw new ForbiddenException(
            'No puedes mover una carpeta al primer nivel.',
          );
      } else {
        // EDICION en el destino, no solo en el origen.
        const padre = await this.acceso.exigirPermiso(
          usuario,
          nuevoPadre,
          'EDICION',
        );
        // Mover una carpeta dentro de su propia descendencia desconectaría
        // esa rama del árbol. La ruta materializada lo detecta de un vistazo.
        if (estaEnRama(padre.ruta, actual.ruta))
          throw new BadRequestException(
            'No se puede mover una carpeta dentro de otra que está por debajo de ella.',
          );
      }
      rutaNueva = await this.calcularRuta(id, nuevoPadre);
    }

    // El destino no puede tener ya una hermana con ese nombre. Sin esto lo
    // paraba el `@@unique([parentId, nombre])` con un error de Prisma en
    // crudo, que llega al usuario como un 500 sin decirle qué pasó.
    if (seMueve || 'nombre' in dto) {
      const repetida = await this.prisma.carpetaFotos.findFirst({
        where: { parentId: nuevoPadre, nombre: nombreFinal, id: { not: id } },
        select: { id: true },
      });
      if (repetida)
        throw new ConflictException(
          `Ya existe una carpeta llamada "${nombreFinal}" en el sitio de destino.`,
        );
    }

    const actualizada = await this.prisma.$transaction(async (tx) => {
      if (seMueve) {
        // Toda la descendencia hereda el cambio de prefijo. Se recalcula con
        // `reprefijar` de `common/arbol-ruta` en vez de cortar la cadena a
        // mano: es la misma operación que hace el árbol de Obra, y tenerla en
        // un solo sitio es lo que evita que las dos se desincronicen.
        const descendientes = await tx.carpetaFotos.findMany({
          where: { ruta: { startsWith: `${actual.ruta}/` } },
          select: { id: true, ruta: true },
        });
        // N updates dentro de la transacción, no una sentencia. Mover es una
        // acción rara y una rama son decenas de filas, así que no compensa
        // bajar a SQL crudo para ahorrarlas.
        for (const d of descendientes) {
          await tx.carpetaFotos.update({
            where: { id: d.id },
            data: { ruta: reprefijar(d.ruta, actual.ruta, rutaNueva) },
          });
        }
        data.parentId = nuevoPadre;
        data.ruta = rutaNueva;
      }

      return tx.carpetaFotos.update({ where: { id }, data: data as never });
    });

    // Marca actividad en el destino Y en el origen: la carpeta de la que
    // salió también cambió, y su tarjeta tiene que reflejarlo.
    await this.acceso.marcarActividad(actualizada.ruta);
    if (seMueve) await this.acceso.marcarActividad(actual.ruta);

    // Un evento por campo que cambió, con el valor anterior: es lo que
    // permite responder «¿quién le cambió el nombre a esto?».
    await this.auditoria.registrar(usuario, [
      ...this.auditoria.diferencias(
        { nombre: actual.nombre },
        { nombre: actualizada.nombre },
        { carpetaId: id, entidad: 'CARPETA', entidadId: id },
      ),
      ...(seMueve
        ? [
            {
              carpetaId: id,
              entidad: 'CARPETA' as const,
              entidadId: id,
              accion: 'MOVIMIENTO' as const,
              campoAfectado: 'parentId',
              valorAnterior: String(actual.parentId ?? 'raíz'),
              valorNuevo: String(actualizada.parentId ?? 'raíz'),
            },
          ]
        : []),
    ]);
    return actualizada;
  }

  /**
   * Archiva o reabre una carpeta: la rama entera pasa a solo lectura.
   *
   * Sigue siendo del ADMIN_GLOBAL. La especificación NO habla de archivado
   * —es una función que pidió HVC en v2—, así que se conserva su regla en vez
   * de derivarle una nueva de §5: «dar una rama por terminada» no es
   * organizar contenido, y bajarla a Acceso Total sería inventar una
   * relajación que nadie pidió.
   *
   * Exige solo LECTURA a propósito: la carpeta está archivada justamente
   * cuando hay que reabrirla, y pedir EDICION —que comprueba la rama
   * cerrada— la habría dejado archivada para siempre.
   */
  async archivar(usuario: UsuarioAutenticado, id: number, cerrada: boolean) {
    if (!this.acceso.esAdminFotos(usuario))
      throw new ForbiddenException(
        'Solo un administrador de Fotos puede archivar o reabrir una carpeta.',
      );
    await this.acceso.exigirPermiso(usuario, id, 'LECTURA');

    const actualizada = await this.prisma.carpetaFotos.update({
      where: { id },
      data: { cerrada },
    });
    await this.acceso.marcarActividad(actualizada.ruta);

    await this.auditoria.registrar(usuario, {
      carpetaId: id,
      entidad: 'CARPETA',
      entidadId: id,
      accion: cerrada ? 'ARCHIVADO' : 'REAPERTURA',
      descripcion: `${cerrada ? 'Archivó' : 'Reabrió'} "${actualizada.nombre}".`,
    });
    return actualizada;
  }

  /**
   * Borra una carpeta. Las FK son Restrict a propósito: una carpeta con
   * subcarpetas o álbumes no se puede borrar sin decidir antes qué pasa con
   * ellos, y borrar en cascada se llevaría fotos por delante.
   *
   * Exige TOTAL, no ADMIN_GLOBAL como en v2: §5 le da «eliminar» a Acceso
   * Total, y §26.7 aclara que eso no lo convierte en administrador global
   * —puede borrar dentro de SU carpeta y en ninguna otra—. Lo que impide
   * que sea peligroso no es el rol sino el Restrict: una carpeta con algo
   * dentro no se borra, así que TOTAL solo alcanza a las vacías.
   */
  async eliminar(usuario: UsuarioAutenticado, id: number) {
    await this.acceso.exigirPermiso(usuario, id, 'TOTAL');

    const carpeta = await this.prisma.carpetaFotos.findUnique({
      where: { id },
      select: {
        nombre: true,
        parentId: true,
        _count: { select: { hijas: true, albumes: true } },
      },
    });
    if (!carpeta) throw new NotFoundException('Esa carpeta ya no existe.');

    if (carpeta._count.hijas > 0)
      throw new BadRequestException(
        `No se puede eliminar: esta carpeta tiene ${carpeta._count.hijas} carpeta(s) dentro. Muévelas o elimínalas primero.`,
      );
    if (carpeta._count.albumes > 0)
      throw new BadRequestException(
        `No se puede eliminar: esta carpeta tiene ${carpeta._count.albumes} álbum(es) de fotos dentro. Archívala en su lugar.`,
      );

    await this.prisma.carpetaFotos.delete({ where: { id } });

    // §23, acción 2. `carpetaId` va en NULL a propósito: la FK es Cascade y
    // apuntar a la carpeta recién borrada se llevaría el propio registro de
    // su borrado. El nombre queda en la descripción, que es lo que se lee.
    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'CARPETA',
      entidadId: id,
      accion: 'ELIMINACION',
      descripcion: `Eliminó la carpeta "${carpeta.nombre}".`,
    });
    return { ok: true, id };
  }
}
