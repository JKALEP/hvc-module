import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Lo que se sustituye en la plantilla. §32 más `items`. */
export interface VariablesSolicitud {
  numero_requerimiento: string;
  cliente: string;
  lugar_entrega: string;
  fecha_entrega: string;
  proveedor: string;
  usuario: string;
  /**
   * La tabla de ítems ya en texto. NO está en la lista de §32, y se
   * añadió porque sin ella el correo no sirve para nada: un proveedor no
   * puede cotizar lo que no sabe que se le pide. Lleva las cinco
   * columnas de §19, incluidas detalle de observación y referencias.
   */
  items: string;
}

/**
 * Las variables de §32, con qué significan.
 *
 * Se exporta para que la pantalla de administración las ofrezca y para
 * que `PlantillaAdminService` pueda rechazar un marcador inventado antes
 * de publicarlo. La lista vive aquí porque aquí es donde se sustituyen:
 * si se añade una variable, se añade en el sitio que la resuelve y todo
 * lo demás se entera solo.
 */
export const VARIABLES_SOLICITUD: { clave: string; descripcion: string }[] = [
  {
    clave: 'numero_requerimiento',
    descripcion: 'N.º de pedido, ej. 001-000123',
  },
  { clave: 'cliente', descripcion: 'Para quién es el requerimiento' },
  { clave: 'lugar_entrega', descripcion: 'Dónde se entrega' },
  { clave: 'fecha_entrega', descripcion: 'Para cuándo se necesita' },
  { clave: 'proveedor', descripcion: 'A quién se le escribe' },
  { clave: 'usuario', descripcion: 'Quién manda la solicitud' },
  {
    clave: 'items',
    descripcion:
      'La tabla de ítems ya formateada. Sin ella el proveedor no sabe qué cotizar.',
  },
];

/**
 * El asunto y el cuerpo por defecto, mientras nadie haya publicado una
 * plantilla propia.
 *
 * Vive en el código y no en la base a propósito: es el mínimo para que
 * el flujo funcione desde el primer día, no una plantilla «oficial» que
 * alguien pueda creer que está configurada. En cuanto la Fase 8 dé de
 * alta una versión, esta deja de usarse y la solicitud guarda a cuál
 * apuntó (§68).
 */
const POR_DEFECTO = {
  asunto: 'Solicitud de cotización {{numero_requerimiento}} — HVC Comercial',
  cuerpo: `Estimados {{proveedor}}:

Por encargo de nuestro cliente {{cliente}}, solicitamos su cotización
para el siguiente requerimiento:

  Requerimiento : {{numero_requerimiento}}
  Lugar de entrega: {{lugar_entrega}}
  Fecha de entrega: {{fecha_entrega}}

{{items}}

Agradeceremos remitir su cotización indicando precios unitarios,
garantía, plazo de entrega y condiciones de pago.

Atentamente,
{{usuario}}
HVC Comercial S.A.C.`,
};

/**
 * Las plantillas de correo del módulo (§32, §68).
 *
 * Hoy solo RESUELVE la plantilla activa y sustituye sus variables. El
 * alta y el versionado desde la pantalla de administración llegan en la
 * Fase 8; hasta entonces se usa la de arriba y `plantillaVersionId`
 * queda en null, que es la verdad: no se usó ninguna versión guardada.
 *
 * La sustitución es deliberadamente tonta —reemplazo textual de
 * `{{clave}}`— y no un motor de plantillas. Lo que se guarda es la
 * plantilla, nunca el correo ya resuelto: por eso publicar una versión
 * nueva no reescribe lo que se mandó con la anterior.
 */
@Injectable()
export class PlantillaService {
  constructor(private readonly prisma: PrismaService) {}

  /** La versión activa de la plantilla de solicitud, o null si no hay. */
  async versionActiva() {
    return this.prisma.plantillaCorreoVersion.findFirst({
      where: {
        activa: true,
        plantilla: { tipo: 'SOLICITUD_COTIZACION' },
      },
      select: { id: true, version: true, asunto: true, cuerpo: true },
    });
  }

  /**
   * Sustituye `{{clave}}` por su valor.
   *
   * Una clave que la plantilla nombre y que no exista se deja TAL CUAL,
   * visible: un `{{fecha_entrga}}` mal escrito tiene que saltar a la
   * vista en el correo de prueba, no desaparecer y dejar un hueco que
   * nadie relacione con la errata.
   */
  private sustituir(texto: string, variables: VariablesSolicitud): string {
    return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (original, clave: string) => {
      const valor = (variables as unknown as Record<string, string>)[clave];
      return valor === undefined ? original : valor;
    });
  }

  /**
   * El correo listo para enviar, y de qué versión salió.
   *
   * `versionId` es null cuando se usó la plantilla por defecto: la
   * solicitud lo guarda así, y §68 se sigue cumpliendo —lo que no se
   * puede es fingir que apuntó a una versión que no existe—.
   */
  async resolver(variables: VariablesSolicitud) {
    const version = await this.versionActiva();
    const base = version ?? POR_DEFECTO;

    return {
      versionId: version?.id ?? null,
      asunto: this.sustituir(base.asunto, variables),
      cuerpo: this.sustituir(base.cuerpo, variables),
    };
  }

  /**
   * Sustituye sobre un texto SUELTO, sin ir a la base.
   *
   * Es lo que necesita la vista previa de la pantalla de
   * administración: enseñar cómo quedaría un borrador que todavía no se
   * ha publicado. Usa la misma sustitución que el envío real —el mismo
   * método privado— para que lo que se ve sea lo que saldría.
   */
  resolverCon(
    base: { asunto: string; cuerpo: string },
    variables: Record<string, string>,
  ) {
    const v = variables as unknown as VariablesSolicitud;
    return {
      asunto: this.sustituir(base.asunto, v),
      cuerpo: this.sustituir(base.cuerpo, v),
    };
  }

  /**
   * Qué texto se usaría ahora mismo y de dónde sale.
   *
   * `origen: 'DEFECTO'` no es un fallo: significa que nadie ha
   * publicado una versión todavía y se está usando la del código. La
   * pantalla lo dice con esas palabras para que no se confunda con «el
   * correo no está configurado».
   */
  async resumenEnUso(): Promise<{
    origen: 'VERSION' | 'DEFECTO';
    versionId: number | null;
    version: number | null;
    asunto: string;
    cuerpo: string;
  }> {
    const version = await this.versionActiva();
    if (!version)
      return {
        origen: 'DEFECTO',
        versionId: null,
        version: null,
        ...POR_DEFECTO,
      };

    return {
      origen: 'VERSION',
      versionId: version.id,
      version: version.version,
      asunto: version.asunto,
      cuerpo: version.cuerpo,
    };
  }

  /**
   * La tabla de ítems en texto plano, para el cuerpo del correo.
   *
   * Se arma con ancho fijo y no como HTML: el correo tiene que leerse
   * igual en cualquier cliente, y una tabla de cinco columnas maquetada
   * es justo lo que se rompe en el móvil del proveedor.
   */
  tablaDeItems(
    items: {
      orden: number;
      descripcion: string;
      unidad: string;
      cantidad: number;
      detalleObservacion: string | null;
      referencias: string | null;
    }[],
  ): string {
    if (items.length === 0) return '  (sin ítems)';

    return items
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((i, n) => {
        const lineas = [
          `  ${String(n + 1).padStart(2)}. ${i.descripcion}`,
          `      Cantidad: ${i.cantidad} ${i.unidad}`,
        ];
        if (i.detalleObservacion)
          lineas.push(`      Detalle: ${i.detalleObservacion}`);
        if (i.referencias) lineas.push(`      Referencias: ${i.referencias}`);
        return lineas.join('\n');
      })
      .join('\n');
  }
}
