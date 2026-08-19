import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoCampo } from '../../generated/prisma/enums';
import { limpiar, describir } from '../common/texto';

/** Un campo, con lo que hace falta para validar un valor suyo. */
export interface CampoParaValidar {
  id: number;
  nombre: string;
  clave: string;
  tipo: TipoCampo;
  obligatorio: boolean;
  opciones: { id: number; etiqueta: string; activo: boolean }[];
}

/** Ya validado y listo para escribir en `valores_campo`. */
export interface ValorNormalizado {
  definicionCampoId: number;
  valorTexto: string | null;
  valorNumero: string | null;
  valorEntero: number | null;
  valorFecha: Date | null;
  valorBooleano: boolean | null;
  opcionId: number | null;
  claveArchivo: string | null;
  /** Solo para SELECCION_MULTIPLE: las filas de la tabla puente. */
  opcionesIds: number[];
  /** Lo que se muestra en la ficha y se guarda en el historial. */
  textoLegible: string;
}

/**
 * Convierte y valida el valor que un equipo tiene para un campo.
 *
 * Vive aparte del CRUD del equipo porque son dos trabajos distintos:
 * aquí no se toca la base de datos, solo se decide qué columna del EAV
 * se llena y con qué. Así las reglas por tipo se leen —y se prueban— en
 * un solo sitio, en vez de repartidas por el service que graba.
 */
@Injectable()
export class ValorCampoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Los campos activos de una organización, con sus opciones. */
  async camposDe(organizacionId: number): Promise<CampoParaValidar[]> {
    return this.prisma.definicionCampo.findMany({
      where: { organizacionId, activo: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        nombre: true,
        clave: true,
        tipo: true,
        obligatorio: true,
        opciones: {
          orderBy: [{ orden: 'asc' }, { id: 'asc' }],
          select: { id: true, etiqueta: true, activo: true },
        },
      },
    });
  }

  /** ¿El valor viene vacío? Un `false` y un `0` NO lo están. */
  private estaVacio(valor: unknown): boolean {
    if (valor === null || valor === undefined) return true;
    if (typeof valor === 'string') return valor.trim() === '';
    if (Array.isArray(valor)) return valor.length === 0;
    return false;
  }

  private numero(valor: unknown, campo: CampoParaValidar): number {
    const n =
      typeof valor === 'number'
        ? valor
        : Number(limpiar(valor)?.replace(/,/g, ''));
    if (!Number.isFinite(n))
      throw new BadRequestException(
        `"${campo.nombre}" debe ser un número. Recibido: "${describir(valor)}".`,
      );
    return n;
  }

  /** Fecha de calendario a UTC medianoche. Acepta aaaa-mm-dd y dd/mm/aaaa. */
  private fecha(
    valor: unknown,
    campo: CampoParaValidar,
    conHora: boolean,
  ): Date {
    if (valor instanceof Date && !isNaN(valor.getTime())) return valor;
    const s = limpiar(valor);
    if (!s)
      throw new BadRequestException(`"${campo.nombre}" necesita una fecha.`);

    if (conHora) {
      const d = new Date(s);
      if (isNaN(d.getTime()))
        throw new BadRequestException(
          `"${campo.nombre}" tiene una fecha y hora inválida: "${describir(valor)}".`,
        );
      return d;
    }

    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    const barras = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    let anio: number, mes: number, dia: number;
    if (iso) [anio, mes, dia] = [+iso[1], +iso[2], +iso[3]];
    else if (barras) [dia, mes, anio] = [+barras[1], +barras[2], +barras[3]];
    else
      throw new BadRequestException(
        `"${campo.nombre}" tiene una fecha inválida: "${describir(valor)}". Usa aaaa-mm-dd.`,
      );

    const f = new Date(Date.UTC(anio, mes - 1, dia));
    if (
      f.getUTCFullYear() !== anio ||
      f.getUTCMonth() !== mes - 1 ||
      f.getUTCDate() !== dia
    )
      throw new BadRequestException(
        `"${campo.nombre}": ese día no existe ("${describir(valor)}").`,
      );
    return f;
  }

  /** La opción elegida tiene que ser de ESTE campo y estar activa. */
  private opcion(valor: unknown, campo: CampoParaValidar) {
    const id = Number(valor);
    const opcion = campo.opciones.find((o) => o.id === id);
    if (!opcion)
      throw new BadRequestException(
        `"${describir(valor)}" no es una opción de "${campo.nombre}".`,
      );
    if (!opcion.activo)
      throw new BadRequestException(
        `La opción "${opcion.etiqueta}" de "${campo.nombre}" está desactivada.`,
      );
    return opcion;
  }

  /** El molde vacío. Solo se llena la columna del tipo que toca. */
  private base(campo: CampoParaValidar): ValorNormalizado {
    return {
      definicionCampoId: campo.id,
      valorTexto: null,
      valorNumero: null,
      valorEntero: null,
      valorFecha: null,
      valorBooleano: null,
      opcionId: null,
      claveArchivo: null,
      opcionesIds: [],
      textoLegible: '',
    };
  }

  /**
   * Valida UN valor contra su campo.
   *
   * Devuelve `null` cuando viene vacío y el campo no es obligatorio: eso
   * significa "no hay fila que escribir", no "escribe una fila vacía".
   */
  normalizar(campo: CampoParaValidar, valor: unknown): ValorNormalizado | null {
    if (this.estaVacio(valor)) {
      if (campo.obligatorio)
        throw new BadRequestException(`"${campo.nombre}" es obligatorio.`);
      return null;
    }

    const v = this.base(campo);

    switch (campo.tipo) {
      case TipoCampo.TEXTO:
      case TipoCampo.TEXTO_LARGO:
      case TipoCampo.CORREO:
      case TipoCampo.TELEFONO:
      case TipoCampo.URL: {
        const s = limpiar(valor) as string;
        if (
          campo.tipo === TipoCampo.CORREO &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)
        )
          throw new BadRequestException(
            `"${campo.nombre}" no parece un correo válido.`,
          );
        if (campo.tipo === TipoCampo.URL && !/^https?:\/\/\S+$/i.test(s))
          throw new BadRequestException(
            `"${campo.nombre}" debe empezar por http:// o https://.`,
          );
        v.valorTexto = s;
        v.textoLegible = s;
        break;
      }

      case TipoCampo.NUMERO_ENTERO: {
        const n = this.numero(valor, campo);
        if (!Number.isInteger(n))
          throw new BadRequestException(
            `"${campo.nombre}" debe ser un número entero.`,
          );
        v.valorEntero = n;
        v.textoLegible = String(n);
        break;
      }

      case TipoCampo.NUMERO_DECIMAL:
      case TipoCampo.MONEDA: {
        const n = this.numero(valor, campo);
        // La columna es Decimal(14,4): se guarda como texto para no
        // perder precisión al pasar por el punto flotante de JS.
        v.valorNumero = n.toFixed(4);
        v.textoLegible =
          campo.tipo === TipoCampo.MONEDA ? n.toFixed(2) : String(n);
        break;
      }

      case TipoCampo.FECHA:
      case TipoCampo.FECHA_HORA: {
        const f = this.fecha(valor, campo, campo.tipo === TipoCampo.FECHA_HORA);
        v.valorFecha = f;
        v.textoLegible =
          campo.tipo === TipoCampo.FECHA
            ? f.toISOString().slice(0, 10)
            : f.toISOString();
        break;
      }

      case TipoCampo.BOOLEANO: {
        const s =
          typeof valor === 'boolean' ? valor : limpiar(valor)?.toLowerCase();
        const si =
          s === true || s === 'true' || s === 'si' || s === 'sí' || s === '1';
        const no = s === false || s === 'false' || s === 'no' || s === '0';
        if (!si && !no)
          throw new BadRequestException(
            `"${campo.nombre}" debe ser sí o no. Recibido: "${describir(valor)}".`,
          );
        v.valorBooleano = si;
        v.textoLegible = si ? 'Sí' : 'No';
        break;
      }

      case TipoCampo.LISTA: {
        const opcion = this.opcion(valor, campo);
        v.opcionId = opcion.id;
        v.textoLegible = opcion.etiqueta;
        break;
      }

      case TipoCampo.SELECCION_MULTIPLE: {
        const lista = Array.isArray(valor) ? valor : [valor];
        const opciones = lista.map((x) => this.opcion(x, campo));
        v.opcionesIds = [...new Set(opciones.map((o) => o.id))];
        v.textoLegible = opciones.map((o) => o.etiqueta).join(', ');
        break;
      }

      case TipoCampo.ARCHIVO:
      case TipoCampo.IMAGEN: {
        // Clave de R2, nunca una URL: el bucket es privado y los enlaces
        // firmados caducan en minutos.
        const s = limpiar(valor) as string;
        v.claveArchivo = s;
        v.textoLegible = s;
        break;
      }
    }

    return v;
  }

  /**
   * Valida el paquete completo que llega del formulario.
   *
   * `valores` viene indexado por la CLAVE del campo, no por su id: así
   * el frontend manda algo legible y el payload sobrevive a que se
   * reordenen los campos.
   */
  normalizarTodos(
    campos: CampoParaValidar[],
    valores: Record<string, unknown>,
  ): ValorNormalizado[] {
    const salida: ValorNormalizado[] = [];
    for (const campo of campos) {
      const normalizado = this.normalizar(campo, valores[campo.clave]);
      if (normalizado) salida.push(normalizado);
    }
    return salida;
  }

  /**
   * Reemplaza los valores de un equipo dentro de una transacción.
   *
   * Se borra y se reescribe en vez de hacer upsert campo a campo: la
   * lista que llega ES la del equipo, y así un campo que se vació deja
   * de tener fila en lugar de quedarse con el valor viejo.
   */
  async reemplazar(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    equipoId: number,
    valores: ValorNormalizado[],
  ) {
    await tx.valorCampoEquipo.deleteMany({ where: { equipoId } });

    for (const v of valores) {
      const fila = await tx.valorCampoEquipo.create({
        data: {
          equipoId,
          definicionCampoId: v.definicionCampoId,
          valorTexto: v.valorTexto,
          valorNumero: v.valorNumero,
          valorEntero: v.valorEntero,
          valorFecha: v.valorFecha,
          valorBooleano: v.valorBooleano,
          opcionId: v.opcionId,
          claveArchivo: v.claveArchivo,
        },
        select: { id: true },
      });

      if (v.opcionesIds.length > 0)
        await tx.valorCampoOpcion.createMany({
          data: v.opcionesIds.map((opcionId) => ({
            valorCampoEquipoId: fila.id,
            opcionId,
          })),
        });
    }
  }
}
