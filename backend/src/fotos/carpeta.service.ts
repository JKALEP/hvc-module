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
import { ValorCampoFotosService } from './valor-campo-fotos.service';
import { CicloService } from './ciclo.service';
import { SistemaFotosService } from './sistema.service';
import { CatalogoActividadService } from './catalogo-actividad.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import { aId, aIdOpcional } from '../common/validacion';
import { estaEnRama, reprefijar, rutaDe } from '../common/arbol-ruta';
import type { TipoCarpetaFotos } from '../../generated/prisma/enums';

export interface CrearCarpetaDto {
  nombre?: string | null;
  parentId?: number | string | null;
  /**
   * `CARPETA` (por defecto) o `EQUIPO`.
   *
   * Ya NO lleva `equipoId`: desde la Fase 1a de «Gestión de contenido»
   * este módulo no referencia el catálogo de Gestión de Equipos. La
   * información del equipo es propia de Fotos y llega en la Fase 1b.
   */
  tipo?: string | null;
  /**
   * Qué clase de sistema es (Fase 2). Solo con `tipo = EQUIPO`.
   *
   * Es una FK a `TipoSistemaFotos` y no un campo configurable porque de él
   * cuelga el catálogo de actividades: de un texto libre no se puede
   * preseleccionar nada.
   */
  tipoSistemaId?: number | string | null;
  /**
   * Qué actividades del catálogo estampar en el Ciclo 1 (Fase 2).
   *
   * ⚠️ **Omitirlo y mandar `[]` NO es lo mismo.** Sin el campo se estampa la
   * PRESELECCIÓN del tipo de sistema —lo que quiere quien da de alta un
   * equipo y no toca nada—; con lista vacía, ninguna, porque alguien las
   * desmarcó a propósito. Colapsar los dos casos obligaría a elegir entre no
   * preseleccionar nunca o no poder decir que no.
   */
  actividades?: unknown;
  /**
   * Los campos configurables del equipo, indexados por CLAVE (Fase 1b).
   *
   * Solo con `tipo = EQUIPO`. Van en la misma llamada —y en la misma
   * transacción— que la carpeta a propósito: crear y luego rellenar en dos
   * pasos deja una carpeta a medias si el segundo falla, y en obra ese
   * segundo paso es justo el que se pierde cuando se va la señal.
   *
   * ⚠️ Los campos de tipo FOTO NO caben aquí: una imagen no viaja en un
   * JSON. Se suben después, por `POST carpeta/:id/campo/:campoId/imagen`.
   */
  valores?: Record<string, unknown> | null;
}

export interface EditarCarpetaDto {
  nombre?: string | null;
  parentId?: number | string | null;
  /**
   * Corregir el tipo de sistema de un equipo (Fase 2). `null` lo deja sin
   * definir.
   *
   * ⚠️ Cambiarlo **NO reescribe las visitas ya hechas ni la que está en
   * curso**: lo que hace es cambiar qué se propone la próxima vez. Un tipo
   * mal elegido se corrige, pero el checklist que alguien ya recorrió es
   * historial. Para traer las nuevas al ciclo abierto está
   * `POST ciclo/:id/actividad/desde-catalogo`, que es una decisión explícita.
   */
  tipoSistemaId?: number | string | null;
}

@Injectable()
export class CarpetaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
    private readonly valores: ValorCampoFotosService,
    private readonly ciclos: CicloService,
    private readonly sistemas: SistemaFotosService,
    private readonly catalogo: CatalogoActividadService,
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
   * Valida el `tipo` de la carpeta.
   *
   * ⚠️ Antes se llamaba `tipoYEquipo` y validaba además el par
   * `tipo`/`equipoId`: una carpeta de tipo EQUIPO tenía que apuntar a un
   * equipo del catálogo de Gestión de Equipos, y lo hacía cumplir también
   * el CHECK `carpetas_fotos_equipo_segun_tipo_chk`. Los dos se retiraron
   * en la Fase 1a de «Gestión de contenido»: el enlace entre módulos se
   * deshizo entero.
   *
   * Hoy `EQUIPO` no exige NADA más, y con los campos configurables de la
   * Fase 1b seguirá sin exigirlo —todos son opcionales a propósito, para
   * que crear una carpeta de equipo en obra no se pueda trabar—. Por eso
   * esto ya no es `async`: no queda nada que preguntarle a la base.
   */
  private tipoValido(dto: CrearCarpetaDto): TipoCarpetaFotos {
    // `toUpperCase()` devuelve `string`, y comparar un `string` contra dos
    // literales no lo estrecha a la unión: de ahí el tipo de retorno
    // explícito en vez de un cast, que `eslint --fix` borra por creerlo
    // innecesario y deja el fallo para el siguiente `tsc`.
    const tipo = (limpiar(dto.tipo) ?? 'CARPETA').toUpperCase();
    if (tipo !== 'CARPETA' && tipo !== 'EQUIPO')
      throw new BadRequestException(
        `Tipo de carpeta inválido: "${describir(dto.tipo)}". Valores permitidos: CARPETA, EQUIPO.`,
      );
    return tipo;
  }

  /**
   * Crea una carpeta, corriente o de tipo EQUIPO.
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
    const tipo = this.tipoValido(dto);

    // El tipo de sistema y las actividades preseleccionadas describen un
    // EQUIPO, igual que los campos configurables: en una carpeta corriente no
    // hay dónde enseñarlos ni ciclo donde estampar nada.
    const tipoSistemaId = await this.sistemas.validarTipo(dto.tipoSistemaId);
    if (tipoSistemaId !== null && tipo !== 'EQUIPO')
      throw new BadRequestException(
        'Solo una carpeta de tipo Equipo lleva tipo de sistema.',
      );
    if (dto.actividades !== undefined && tipo !== 'EQUIPO')
      throw new BadRequestException(
        'Solo una carpeta de tipo Equipo lleva actividades.',
      );
    const elegidas =
      dto.actividades === undefined
        ? undefined
        : Array.isArray(dto.actividades)
          ? dto.actividades.map((v) =>
              aId(v, 'Una de las actividades elegidas no es válida.'),
            )
          : (() => {
              throw new BadRequestException(
                'Las actividades tienen que llegar como una lista.',
              );
            })();

    // Los campos configurables describen un EQUIPO. En una carpeta
    // corriente no hay dónde enseñarlos, así que se rechaza en vez de
    // guardarlos donde nadie los verá.
    const valoresDeEquipo =
      dto.valores && Object.keys(dto.valores).length > 0 ? dto.valores : null;
    if (valoresDeEquipo && tipo !== 'EQUIPO')
      throw new BadRequestException(
        'Solo una carpeta de tipo Equipo lleva campos configurables.',
      );

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
          tipoSistemaId,
        },
      });
      const ruta = await this.calcularRuta(carpeta.id, parentId);
      const actualizada = await tx.carpetaFotos.update({
        where: { id: carpeta.id },
        data: { ruta },
      });

      // Los datos del equipo, en la MISMA transacción (Fase 1b). Si un
      // valor no vale, no queda una carpeta a medias: se deshace todo.
      //
      // `escribirEn` y no `guardar` a propósito: aquí el permiso ya se
      // decidió arriba —`puedeCrearRaiz` o EDICION sobre la madre— y la
      // carpeta todavía no está confirmada, así que volver a comprobarlo
      // daría el 404 uniforme sobre algo que sí existe.
      if (valoresDeEquipo)
        await this.valores.escribirEn(tx, carpeta.id, valoresDeEquipo);

      // ⚠️ Un EQUIPO nace con su Ciclo 1 abierto (§4.3), en la MISMA
      // transacción. Sin ciclo no habría dónde colgar una actividad, así que
      // los dos nacen juntos o no nace ninguno. Una carpeta corriente no
      // lleva ciclos: no es una visita, es una estructura.
      if (tipo === 'EQUIPO') {
        const ciclo = await this.ciclos.abrirPrimeroEn(
          tx,
          carpeta.id,
          usuario.id,
        );
        // Y con el checklist que propone su tipo de sistema (Fase 2), en la
        // misma transacción por lo mismo: un equipo con ciclo pero sin
        // checklist obliga a repetir a mano lo que el catálogo ya sabía.
        await this.catalogo.estamparEn(
          tx,
          ciclo.id,
          usuario.id,
          tipoSistemaId,
          elegidas,
        );
      }

      return actualizada;
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

    if ('tipoSistemaId' in dto) {
      if (actual.tipo !== 'EQUIPO')
        throw new BadRequestException(
          'Solo una carpeta de tipo Equipo lleva tipo de sistema.',
        );
      data.tipoSistemaId = await this.sistemas.validarTipo(dto.tipoSistemaId);
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
        _count: { select: { hijas: true } },
      },
    });
    if (!carpeta) throw new NotFoundException('Esa carpeta ya no existe.');

    if (carpeta._count.hijas > 0)
      throw new BadRequestException(
        `No se puede eliminar: esta carpeta tiene ${carpeta._count.hijas} carpeta(s) dentro. Muévelas o elimínalas primero.`,
      );
    // ⚠️ El candado que antes daba el `Restrict` de los álbumes.
    //
    // Con los álbumes retirados (Fase 4) las fotos cuelgan de los ciclos, y
    // los ciclos van con `Cascade`: sin esta comprobación, borrar un equipo
    // se llevaría por delante sus visitas, sus actividades y TODAS sus fotos
    // en silencio. Se cuentan las dos clases —las sueltas del ciclo y las de
    // sus actividades—, porque las dos son contenido que alguien subió.
    const conFotos = await this.prisma.foto.count({
      where: {
        OR: [
          { ciclo: { carpetaId: id } },
          { actividad: { ciclo: { carpetaId: id } } },
        ],
      },
    });
    if (conFotos > 0)
      throw new BadRequestException(
        `No se puede eliminar: esta carpeta tiene ${conFotos} foto(s) dentro. Archívala en su lugar.`,
      );

    // ⚠️ Las imágenes de los campos de tipo FOTO se retiran de R2 ANTES de
    // borrar la carpeta, y esto no es opcional.
    //
    // `ValorCampoFotos` va con `Cascade`, así que la base se lleva las
    // filas sola —son datos DE la carpeta, no contenido colgado de ella—
    // pero **no sabe nada del bucket**. Sin esto, cada equipo eliminado
    // dejaría dos objetos huérfanos para siempre, y sin ninguna fila que
    // apuntara a ellos no habría forma de encontrarlos después.
    //
    // Se leen antes del `delete` porque después ya no existen, y se borran
    // del bucket después de que el `delete` haya salido bien: al revés, un
    // fallo al borrar la carpeta dejaría la ficha apuntando a objetos que
    // ya no están.
    const imagenes = await this.valores.imagenesDe(id);

    await this.prisma.carpetaFotos.delete({ where: { id } });

    await this.valores.borrarObjetos(imagenes);

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
