import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstructuraService } from './estructura.service';
import { LineasService } from '../common/lineas.service';
import { textoDeValor } from './valor-texto';
import type {
  Exportable,
  ColumnaExportable,
} from '../common/exportacion.service';

/** Una sección de la ficha: un título y filas ya en texto. */
export interface SeccionFicha {
  titulo: string;
  columnas: string[];
  filas: string[][];
  vacio: string;
}

const FECHA = 'es-PE';

/**
 * La ficha de un equipo: todo lo suyo en una sola lectura.
 *
 * Es el reporte individual de la especificación. Vive aparte del CRUD
 * (`EquipoService`) porque responde otra pregunta: el CRUD devuelve el
 * equipo para editarlo, y esto lo devuelve para leerlo o imprimirlo,
 * con sus incidencias, documentos e historial ya aplanados a texto.
 *
 * Todo sale aplanado a `string` desde el backend, y no a medias para
 * que el navegador termine de formatear: el Excel, el PDF y la pantalla
 * tienen que decir exactamente lo mismo, y la única forma de
 * garantizarlo es que la conversión ocurra una vez.
 */
@Injectable()
export class ReporteEquipoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estructura: EstructuraService,
    private readonly lineas: LineasService,
  ) {}

  private fecha(d: Date): string {
    return d.toLocaleDateString(FECHA, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private dinero(n: number): string {
    return n.toLocaleString(FECHA, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async ficha(equipoId: number) {
    const equipo = await this.prisma.equipo.findUnique({
      where: { id: equipoId },
      include: {
        organizacion: { select: { id: true, nombre: true } },
        nodo: { select: { id: true, nombre: true } },
        creadoPor: { select: { id: true, nombre: true } },
        valores: {
          include: {
            definicionCampo: {
              select: { id: true, nombre: true, orden: true },
            },
            opcion: { select: { etiqueta: true } },
            opcionesElegidas: {
              include: { opcion: { select: { etiqueta: true } } },
            },
          },
        },
        incidencias: { orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }] },
        cotizaciones: {
          orderBy: [{ creadoEn: 'desc' }],
          include: { lineas: true },
        },
        ordenesCompra: {
          orderBy: [{ creadoEn: 'desc' }],
          include: { lineas: true },
        },
        historial: {
          orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
          include: { usuario: { select: { nombre: true } } },
          take: 200,
        },
        _count: { select: { fotos: true } },
      },
    });
    if (!equipo) throw new NotFoundException('Ese equipo ya no existe.');

    // Todos los campos de la organización, no solo los que este equipo
    // tiene llenos: una ficha con huecos dice más que una ficha corta,
    // y dos equipos de la misma organización se comparan renglón a
    // renglón.
    const definiciones = await this.prisma.definicionCampo.findMany({
      where: { organizacionId: equipo.organizacionId },
      select: { id: true, nombre: true, activo: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    });
    const porCampo = new Map(
      equipo.valores.map((v) => [v.definicionCampoId, textoDeValor(v)]),
    );

    const camino = await this.estructura.camino(equipo.nodoId);

    const total = (filas: Parameters<LineasService['calcularLineas']>[0]) =>
      this.lineas.total(this.lineas.calcularLineas(filas));

    return {
      equipo: {
        id: equipo.id,
        codigoInterno: equipo.codigoInterno,
        organizacion: equipo.organizacion,
        ubicacion: camino.map((n) => n.nombre).join(' / '),
        nodo: equipo.nodo,
        creadoPor: equipo.creadoPor?.nombre ?? null,
        creadoEn: equipo.creadoEn,
        actualizadoEn: equipo.actualizadoEn,
        fotos: equipo._count.fotos,
      },
      secciones: [
        {
          titulo: 'Características',
          columnas: ['Campo', 'Valor'],
          filas: definiciones.map((d) => [
            // Un campo desactivado sigue en la ficha si tiene valor: el
            // dato se capturó y borrarlo de la vista sería mentir.
            d.activo ? d.nombre : `${d.nombre} (campo inactivo)`,
            porCampo.get(d.id) || '—',
          ]),
          vacio: 'Esta organización todavía no configuró campos.',
        },
        {
          titulo: 'Incidencias',
          columnas: [
            'Código',
            'Tipo',
            'Prioridad',
            'Estado',
            'Fecha',
            'Descripción',
          ],
          filas: equipo.incidencias.map((i) => [
            i.codigo,
            i.tipo,
            i.prioridad ?? '—',
            i.estado,
            this.fecha(i.creadoEn),
            i.descripcion,
          ]),
          vacio: 'Sin incidencias registradas.',
        },
        {
          titulo: 'Cotizaciones',
          columnas: ['Código', 'Proveedor', 'Estado', 'Fecha', 'Total'],
          filas: equipo.cotizaciones.map((c) => [
            c.codigo,
            c.proveedor,
            c.estado,
            this.fecha(c.creadoEn),
            this.dinero(total(c.lineas)),
          ]),
          vacio: 'Sin cotizaciones.',
        },
        {
          titulo: 'Órdenes de compra',
          columnas: ['Código', 'Proveedor', 'Estado', 'Fecha', 'Total'],
          filas: equipo.ordenesCompra.map((o) => [
            o.codigo,
            o.proveedor,
            o.estado,
            this.fecha(o.creadoEn),
            this.dinero(total(o.lineas)),
          ]),
          vacio: 'Sin órdenes de compra.',
        },
        {
          titulo: 'Historial',
          columnas: ['Fecha', 'Tipo', 'Detalle', 'Usuario'],
          filas: equipo.historial.map((e) => [
            e.creadoEn.toLocaleString(FECHA),
            e.tipo,
            e.descripcion ??
              (e.campoAfectado
                ? `${e.campoAfectado}: ${e.valorAnterior ?? '(vacío)'} → ${e.valorNuevo ?? '(vacío)'}`
                : `${e.valorAnterior ?? ''} → ${e.valorNuevo ?? ''}`),
            e.usuario?.nombre ?? '—',
          ]),
          vacio: 'Sin movimientos.',
        },
      ] satisfies SeccionFicha[],
    };
  }

  /** La misma ficha, con la forma que entiende el exportador. */
  async exportable(equipoId: number): Promise<Exportable> {
    const { equipo, secciones } = await this.ficha(equipoId);
    const nombre = equipo.codigoInterno ?? `equipo-${equipo.id}`;

    return {
      titulo: `Ficha de equipo · ${nombre}`,
      nombreArchivo: `Ficha_${nombre.replace(/[^\w-]+/g, '_')}`,
      datos: [
        { etiqueta: 'Código interno', valor: equipo.codigoInterno ?? '—' },
        { etiqueta: 'Organización', valor: equipo.organizacion.nombre },
        { etiqueta: 'Ubicación', valor: equipo.ubicacion },
        { etiqueta: 'Registrado por', valor: equipo.creadoPor ?? '—' },
        { etiqueta: 'Registrado el', valor: this.fecha(equipo.creadoEn) },
        {
          etiqueta: 'Última modificación',
          valor: this.fecha(equipo.actualizadoEn),
        },
        { etiqueta: 'Fotos', valor: String(equipo.fotos) },
      ],
      bloques: secciones.map((s) => ({
        titulo: s.titulo,
        columnas: this.columnasDe(s),
        filas: s.filas,
        vacio: s.vacio,
      })),
    };
  }

  /**
   * Reparte el ancho entre las columnas de una sección.
   *
   * La última se lleva el resto porque en las cinco secciones es la
   * descriptiva —el valor, la descripción, el detalle del historial—, y
   * es la única que de verdad necesita espacio.
   */
  private columnasDe(s: SeccionFicha): ColumnaExportable[] {
    return s.columnas.map((titulo, i) => ({
      titulo,
      ancho: i === s.columnas.length - 1 ? 60 : 18,
    }));
  }
}
