import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TipoPlantilla } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { aTexto } from '../validacion';
import { PlantillaService, VARIABLES_SOLICITUD } from './plantilla.service';
import type { CrearVersionDto, PrevisualizarDto } from './dto';

/** Hoy solo hay una plantilla. La constante evita repetir el literal. */
const TIPO: TipoPlantilla = 'SOLICITUD_COTIZACION';

/**
 * Administrar las plantillas de correo (§32, §68).
 *
 * Service aparte de `PlantillaService`, que es de solo lectura y lo usa
 * el envío: son dos preguntas distintas —«¿qué mando ahora?» y «¿qué
 * texto usamos a partir de hoy?»— y las toca gente distinta. Mismo
 * criterio que `base-costos` frente a `registro-costo`.
 *
 * ── Publicar es crear, nunca editar ──────────────────────────────────
 * No hay forma de modificar una versión existente, y es a propósito:
 * cada `SolicitudCotizacion` guarda el `plantillaVersionId` con el que
 * salió (§68), así que reescribir una versión cambiaría lo que dice un
 * correo ya enviado. Corregir una errata es publicar la versión
 * siguiente; la anterior se queda como registro de lo que se mandó.
 *
 * Por lo mismo tampoco se borran versiones: la FK de `solicitudes` es
 * SetNull, y perder el texto dejaría envíos apuntando a la nada.
 */
@Injectable()
export class PlantillaAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly plantillas: PlantillaService,
  ) {}

  /** Las variables que se pueden usar, para que la pantalla las ofrezca. */
  variablesDisponibles() {
    return VARIABLES_SOLICITUD;
  }

  /**
   * La plantilla con todas sus versiones, de la más nueva a la más
   * antigua.
   *
   * Se crea al vuelo si no existe: hoy el tipo es único y fijo, así que
   * obligar a «dar de alta la plantilla» antes de escribir la primera
   * versión sería un paso que no decide nada. Lo que sí es una decisión
   * —qué texto se usa— es la versión.
   */
  async detalle(usuario: UsuarioAutenticado) {
    const plantilla = await this.prisma.plantillaCorreo.upsert({
      where: { tipo: TIPO },
      create: { tipo: TIPO, nombre: 'Solicitud de cotización' },
      update: {},
      include: {
        versiones: {
          orderBy: { version: 'desc' },
          include: { creadoPor: { select: { id: true, nombre: true } } },
        },
      },
    });

    return {
      ...plantilla,
      variables: this.variablesDisponibles(),
      /**
       * Lo que se usaría AHORA MISMO si se mandara una solicitud.
       *
       * Cuando no hay ninguna versión activa esto no es un error: se
       * usa la del código, y decirlo explícitamente evita que alguien
       * crea que el correo no sale. Es la misma verdad que guarda
       * `plantillaVersionId = null`.
       */
      enUso: await this.plantillas.resumenEnUso(),
      usuarioActual: usuario.nombre,
    };
  }

  /**
   * Publica una versión nueva (§68).
   *
   * El número de versión sale de la última + 1, dentro de la misma
   * transacción que la crea: dos publicaciones a la vez no pueden
   * quedarse con el mismo número porque `@@unique([plantillaId,
   * version])` lo impide, y la segunda reintenta con el siguiente.
   */
  async crearVersion(usuario: UsuarioAutenticado, dto: CrearVersionDto) {
    const asunto = aTexto(dto.asunto, 'El asunto');
    const cuerpo = aTexto(dto.cuerpo, 'El cuerpo del correo');
    const activar = dto.activar !== false;

    this.exigirVariablesConocidas(asunto, cuerpo);

    const plantilla = await this.prisma.plantillaCorreo.upsert({
      where: { tipo: TIPO },
      create: { tipo: TIPO, nombre: 'Solicitud de cotización' },
      update: {},
      select: { id: true },
    });

    const version = await this.prisma.$transaction(async (tx) => {
      const ultima = await tx.plantillaCorreoVersion.findFirst({
        where: { plantillaId: plantilla.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const numero = (ultima?.version ?? 0) + 1;

      // Solo una activa por plantilla. Lo hace cumplir el service, no la
      // base: un índice parcial habría servido, pero el criterio de qué
      // apagar al encender otra vive aquí de todas formas.
      if (activar)
        await tx.plantillaCorreoVersion.updateMany({
          where: { plantillaId: plantilla.id, activa: true },
          data: { activa: false },
        });

      const creada = await tx.plantillaCorreoVersion.create({
        data: {
          plantillaId: plantilla.id,
          version: numero,
          asunto,
          cuerpo,
          activa: activar,
          creadoPorId: usuario.id,
        },
      });

      await this.auditoria.registrarUno(
        usuario,
        {
          entidad: 'PLANTILLA',
          entidadId: creada.id,
          accion: 'CREACION',
          descripcion:
            `Se publicó la versión ${numero} de la plantilla de solicitud` +
            `${activar ? ' y pasó a estar activa' : ' (guardada sin activar)'}.`,
        },
        tx,
      );

      return creada;
    });

    return version;
  }

  /**
   * Cambia qué versión se usa a partir de ahora.
   *
   * Sirve para volver atrás sin reescribir nada: si la versión 4 salió
   * mal, se reactiva la 3 y los envíos siguientes apuntan a la 3. Lo
   * que se mandó con la 4 sigue diciendo que fue la 4.
   */
  async activar(usuario: UsuarioAutenticado, versionId: number) {
    const version = await this.prisma.plantillaCorreoVersion.findUnique({
      where: { id: versionId },
      select: { id: true, plantillaId: true, version: true, activa: true },
    });
    if (!version) throw new NotFoundException('Esa versión ya no existe.');

    if (version.activa) return version;

    await this.prisma.$transaction(async (tx) => {
      await tx.plantillaCorreoVersion.updateMany({
        where: { plantillaId: version.plantillaId, activa: true },
        data: { activa: false },
      });
      await tx.plantillaCorreoVersion.update({
        where: { id: versionId },
        data: { activa: true },
      });

      await this.auditoria.registrarUno(
        usuario,
        {
          entidad: 'PLANTILLA',
          entidadId: versionId,
          accion: 'CAMBIO_ESTADO',
          campoAfectado: 'activa',
          valorAnterior: 'false',
          valorNuevo: 'true',
          descripcion: `La versión ${version.version} pasó a ser la que se usa.`,
        },
        tx,
      );
    });

    return { ...version, activa: true };
  }

  /**
   * Cómo quedaría el correo (§32).
   *
   * Con datos de ejemplo y sin mandar nada. Es lo que permite ver de un
   * vistazo si un marcador está mal escrito: `sustituir` deja intacto lo
   * que no reconoce, así que un `{{fecha_entrga}}` aparece tal cual en
   * la vista previa en vez de desaparecer sin dejar rastro.
   */
  previsualizar(dto: PrevisualizarDto) {
    const asunto = aTexto(dto.asunto, 'El asunto');
    const cuerpo = aTexto(dto.cuerpo, 'El cuerpo del correo');

    return {
      ...this.plantillas.resolverCon({ asunto, cuerpo }, EJEMPLO),
      /** Los marcadores que no corresponden a ninguna variable de §32. */
      desconocidas: this.variablesDesconocidas(asunto, cuerpo),
    };
  }

  /** Los `{{...}}` que no son ninguna variable conocida. */
  private variablesDesconocidas(...textos: string[]): string[] {
    const conocidas = new Set<string>(VARIABLES_SOLICITUD.map((v) => v.clave));
    const encontradas = new Set<string>();

    for (const texto of textos)
      for (const m of texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g))
        if (!conocidas.has(m[1])) encontradas.add(m[1]);

    return [...encontradas];
  }

  /**
   * Un marcador inventado se rechaza AL PUBLICAR, no al enviar.
   *
   * Al enviar ya es tarde: el correo sale con `{{fehca_entrega}}`
   * literal a la bandeja del proveedor. Aquí todavía se puede corregir,
   * y el mensaje dice qué variables existen.
   */
  private exigirVariablesConocidas(asunto: string, cuerpo: string) {
    const desconocidas = this.variablesDesconocidas(asunto, cuerpo);
    if (desconocidas.length === 0) return;

    throw new BadRequestException(
      `Estos marcadores no existen: ${desconocidas.map((v) => `{{${v}}}`).join(', ')}. ` +
        `Saldrían tal cual en el correo del proveedor. ` +
        `Los disponibles son: ${VARIABLES_SOLICITUD.map((v) => `{{${v.clave}}}`).join(', ')}.`,
    );
  }
}

/** Datos de mentira para la vista previa. Se ven como lo que son. */
const EJEMPLO = {
  numero_requerimiento: '001-000123',
  cliente: 'Cliente de ejemplo S.A.C.',
  lugar_entrega: 'Av. Ejemplo 123, Lima',
  fecha_entrega: '31/12/2026',
  proveedor: 'Proveedor de ejemplo S.A.C.',
  usuario: 'Nombre del gestor',
  items:
    '   1. Tubería de cobre 3/4"\n' +
    '      Cantidad: 20 MT\n' +
    '   2. Refrigerante R-410A\n' +
    '      Cantidad: 5 KG',
};
