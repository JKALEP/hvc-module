import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoCampo } from '../../generated/prisma/enums';
import { limpiar } from '../common/texto';
import type { Exportable } from '../common/exportacion.service';

/** Una dimensión por la que se puede repartir el inventario. */
export interface Dimension {
  /** `organizacion`, `nodo`, o `campo-<id>`. */
  clave: string;
  etiqueta: string;
  /** Los campos son de una organización; sin elegirla no se pueden usar. */
  requiereOrganizacion: boolean;
}

/**
 * Los tipos de campo por los que agrupar significa algo.
 *
 * Se dejan fuera los continuos —números, fechas, moneda— y los que no
 * son categorías —texto largo, archivo, imagen—: agrupar por ellos da
 * casi tantos grupos como equipos, que es una tabla larga sin ninguna
 * lectura. Los ejemplos de la especificación (tipo, marca, estado) son
 * todos LISTA o TEXTO.
 */
const AGRUPABLES: TipoCampo[] = [
  TipoCampo.TEXTO,
  TipoCampo.BOOLEANO,
  TipoCampo.LISTA,
  TipoCampo.SELECCION_MULTIPLE,
];

const SIN_VALOR = '(sin valor)';

/**
 * Reportes consolidados: cómo se reparte el inventario.
 *
 * La especificación pide distribución «por cliente, sede, tipo, marca,
 * estado». Las dos primeras son relaciones fijas (Organizacion,
 * NodoEstructura); las otras tres NO existen como columnas —cada
 * organización define sus propios campos y los llama como quiere—, así
 * que agrupar por «marca» a secas sería inventarse un campo que en otra
 * organización no existe.
 *
 * Por eso la dimensión es un parámetro y no cinco endpoints: se agrupa
 * por organización, por ubicación, o por CUALQUIER campo agrupable que
 * esa organización tenga configurado. «Tipo», «Marca» y «Estado» salen
 * de ahí cuando el cliente los definió, con el nombre que él les puso.
 */
@Injectable()
export class ReporteConsolidadoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Los KPIs de la cabecera. */
  async resumen(organizacionId: number | null) {
    const deLaOrg = organizacionId ? { organizacionId } : {};
    const [
      equipos,
      organizaciones,
      nodos,
      incidenciasAbiertas,
      cotizacionesPendientes,
      ordenesActivas,
    ] = await Promise.all([
      this.prisma.equipo.count({ where: deLaOrg }),
      organizacionId
        ? Promise.resolve(1)
        : this.prisma.organizacion.count({ where: { activo: true } }),
      this.prisma.nodoEstructura.count({ where: deLaOrg }),
      this.prisma.incidencia.count({
        where: {
          estado: { in: ['ABIERTA', 'EN_ATENCION'] },
          ...(organizacionId ? { equipo: { organizacionId } } : {}),
        },
      }),
      this.prisma.cotizacion.count({
        where: { estado: 'PENDIENTE', ...deLaOrg },
      }),
      this.prisma.ordenCompra.count({
        where: { estado: { in: ['EMITIDA', 'EN_PROCESO'] }, ...deLaOrg },
      }),
    ]);

    return {
      equipos,
      organizaciones,
      nodos,
      incidenciasAbiertas,
      cotizacionesPendientes,
      ordenesActivas,
    };
  }

  /** Por qué se puede agrupar. Sin organización, solo las fijas. */
  async dimensiones(organizacionId: number | null): Promise<Dimension[]> {
    const fijas: Dimension[] = [
      {
        clave: 'organizacion',
        etiqueta: 'Organización',
        requiereOrganizacion: false,
      },
      { clave: 'nodo', etiqueta: 'Ubicación', requiereOrganizacion: true },
    ];
    if (organizacionId === null) return fijas;

    const campos = await this.prisma.definicionCampo.findMany({
      where: { organizacionId, tipo: { in: AGRUPABLES } },
      select: { id: true, nombre: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    });

    return [
      ...fijas,
      ...campos.map((c) => ({
        clave: `campo-${c.id}`,
        etiqueta: c.nombre,
        requiereOrganizacion: true,
      })),
    ];
  }

  async distribucion(dimension: string, organizacionId: number | null) {
    const clave = limpiar(dimension) ?? 'organizacion';
    const total = await this.prisma.equipo.count({
      where: organizacionId ? { organizacionId } : {},
    });

    const { etiqueta, filas, multiple } = await this.repartir(
      clave,
      organizacionId,
      total,
    );

    return {
      dimension: clave,
      etiqueta,
      total,
      /** Con selección múltiple un equipo cae en varias filas. */
      multiple,
      filas: filas
        .filter((f) => f.cantidad > 0)
        .sort(
          (a, b) =>
            b.cantidad - a.cantidad || a.etiqueta.localeCompare(b.etiqueta),
        )
        .map((f) => ({
          ...f,
          porcentaje:
            total === 0 ? 0 : Math.round((f.cantidad / total) * 1000) / 10,
        })),
    };
  }

  private async repartir(
    clave: string,
    organizacionId: number | null,
    total: number,
  ): Promise<{
    etiqueta: string;
    multiple: boolean;
    filas: { etiqueta: string; cantidad: number }[];
  }> {
    if (clave === 'organizacion')
      return {
        etiqueta: 'Organización',
        multiple: false,
        filas: await this.porOrganizacion(organizacionId),
      };

    if (organizacionId === null)
      throw new BadRequestException(
        'Esa dimensión necesita que elijas una organización.',
      );

    if (clave === 'nodo')
      return {
        etiqueta: 'Ubicación',
        multiple: false,
        filas: await this.porNodo(organizacionId),
      };

    const id = Number(clave.replace(/^campo-/, ''));
    if (!clave.startsWith('campo-') || !Number.isInteger(id) || id <= 0)
      throw new BadRequestException(`Dimensión desconocida: "${clave}".`);

    return this.porCampo(id, organizacionId, total);
  }

  private async porOrganizacion(organizacionId: number | null) {
    const grupos = await this.prisma.equipo.groupBy({
      by: ['organizacionId'],
      where: organizacionId ? { organizacionId } : {},
      _count: { _all: true },
    });
    const nombres = new Map(
      (
        await this.prisma.organizacion.findMany({
          where: { id: { in: grupos.map((g) => g.organizacionId) } },
          select: { id: true, nombre: true },
        })
      ).map((o) => [o.id, o.nombre]),
    );
    return grupos.map((g) => ({
      etiqueta:
        nombres.get(g.organizacionId) ?? `Organización ${g.organizacionId}`,
      cantidad: g._count._all,
    }));
  }

  /**
   * Por ubicación, con el camino completo como etiqueta.
   *
   * El árbol se trae entero de una vez y los caminos se arman en
   * memoria: son pocos nodos por organización, y subir padre a padre
   * contra la base habría sido una consulta por nodo.
   */
  private async porNodo(organizacionId: number) {
    const nodos = await this.prisma.nodoEstructura.findMany({
      where: { organizacionId },
      select: { id: true, nombre: true, padreId: true },
    });
    const porId = new Map(nodos.map((n) => [n.id, n]));
    const camino = (id: number): string => {
      const partes: string[] = [];
      let actual = porId.get(id);
      let guarda = 0;
      while (actual && guarda++ < 50) {
        partes.unshift(actual.nombre);
        actual =
          actual.padreId === null ? undefined : porId.get(actual.padreId);
      }
      return partes.join(' / ');
    };

    const grupos = await this.prisma.equipo.groupBy({
      by: ['nodoId'],
      where: { organizacionId },
      _count: { _all: true },
    });
    return grupos.map((g) => ({
      etiqueta: camino(g.nodoId) || `Ubicación ${g.nodoId}`,
      cantidad: g._count._all,
    }));
  }

  /** Por un campo dinámico, según cómo guarde su valor cada tipo. */
  private async porCampo(
    definicionCampoId: number,
    organizacionId: number,
    total: number,
  ) {
    const campo = await this.prisma.definicionCampo.findFirst({
      where: { id: definicionCampoId, organizacionId },
      select: { id: true, nombre: true, tipo: true },
    });
    if (!campo)
      throw new BadRequestException(
        'Ese campo no existe en la organización elegida.',
      );
    if (!AGRUPABLES.includes(campo.tipo))
      throw new BadRequestException(
        `No se puede agrupar por "${campo.nombre}": los campos de tipo ${campo.tipo} no son categorías.`,
      );

    const donde = { definicionCampoId, equipo: { organizacionId } };

    if (campo.tipo === TipoCampo.SELECCION_MULTIPLE) {
      // Aquí la suma de las filas puede pasar del total: un equipo con
      // dos opciones marcadas cuenta en las dos. Se avisa con `multiple`
      // en vez de repartir el equipo en fracciones, que no es lo que
      // nadie quiere leer.
      const grupos = await this.prisma.valorCampoOpcion.groupBy({
        by: ['opcionId'],
        where: { valorCampo: donde },
        _count: { _all: true },
      });
      const etiquetas = await this.etiquetasDeOpcion(
        grupos.map((g) => g.opcionId),
      );
      const conValor = await this.prisma.valorCampoEquipo.count({
        where: { ...donde, opcionesElegidas: { some: {} } },
      });
      return {
        etiqueta: campo.nombre,
        multiple: true,
        filas: [
          ...grupos.map((g) => ({
            etiqueta: etiquetas.get(g.opcionId) ?? `Opción ${g.opcionId}`,
            cantidad: g._count._all,
          })),
          { etiqueta: SIN_VALOR, cantidad: total - conValor },
        ],
      };
    }

    if (campo.tipo === TipoCampo.LISTA) {
      const grupos = await this.prisma.valorCampoEquipo.groupBy({
        by: ['opcionId'],
        where: donde,
        _count: { _all: true },
      });
      const ids = grupos
        .map((g) => g.opcionId)
        .filter((x): x is number => x !== null);
      const etiquetas = await this.etiquetasDeOpcion(ids);
      const conValor = grupos
        .filter((g) => g.opcionId !== null)
        .reduce((a, g) => a + g._count._all, 0);
      return {
        etiqueta: campo.nombre,
        multiple: false,
        filas: [
          ...grupos
            .filter((g) => g.opcionId !== null)
            .map((g) => ({
              etiqueta:
                etiquetas.get(g.opcionId as number) ?? `Opción ${g.opcionId}`,
              cantidad: g._count._all,
            })),
          { etiqueta: SIN_VALOR, cantidad: total - conValor },
        ],
      };
    }

    if (campo.tipo === TipoCampo.BOOLEANO) {
      const grupos = await this.prisma.valorCampoEquipo.groupBy({
        by: ['valorBooleano'],
        where: donde,
        _count: { _all: true },
      });
      const conValor = grupos
        .filter((g) => g.valorBooleano !== null)
        .reduce((a, g) => a + g._count._all, 0);
      return {
        etiqueta: campo.nombre,
        multiple: false,
        filas: [
          ...grupos
            .filter((g) => g.valorBooleano !== null)
            .map((g) => ({
              etiqueta: g.valorBooleano ? 'Sí' : 'No',
              cantidad: g._count._all,
            })),
          { etiqueta: SIN_VALOR, cantidad: total - conValor },
        ],
      };
    }

    // TEXTO: se agrupa por el valor literal, tal como se escribió.
    const grupos = await this.prisma.valorCampoEquipo.groupBy({
      by: ['valorTexto'],
      where: donde,
      _count: { _all: true },
    });
    const conValor = grupos
      .filter((g) => limpiar(g.valorTexto) !== null)
      .reduce((a, g) => a + g._count._all, 0);
    return {
      etiqueta: campo.nombre,
      multiple: false,
      filas: [
        ...grupos
          .filter((g) => limpiar(g.valorTexto) !== null)
          .map((g) => ({
            etiqueta: g.valorTexto as string,
            cantidad: g._count._all,
          })),
        { etiqueta: SIN_VALOR, cantidad: total - conValor },
      ],
    };
  }

  private async etiquetasDeOpcion(ids: number[]) {
    const opciones = await this.prisma.opcionCampo.findMany({
      where: { id: { in: ids } },
      select: { id: true, etiqueta: true },
    });
    return new Map(opciones.map((o) => [o.id, o.etiqueta]));
  }

  /** La distribución con la forma que entiende el exportador. */
  async exportable(
    dimension: string,
    organizacionId: number | null,
  ): Promise<Exportable> {
    const d = await this.distribucion(dimension, organizacionId);
    const organizacion = organizacionId
      ? await this.prisma.organizacion.findUnique({
          where: { id: organizacionId },
          select: { nombre: true },
        })
      : null;

    return {
      titulo: `Distribución por ${d.etiqueta.toLowerCase()}`,
      nombreArchivo: `Distribucion_${d.etiqueta.replace(/[^\w-]+/g, '_')}`,
      datos: [
        { etiqueta: 'Agrupado por', valor: d.etiqueta },
        {
          etiqueta: 'Organización',
          valor: organizacion?.nombre ?? 'Todas',
        },
        { etiqueta: 'Equipos', valor: String(d.total) },
        {
          etiqueta: 'Generado el',
          valor: new Date().toLocaleString('es-PE'),
        },
        ...(d.multiple
          ? [
              {
                etiqueta: 'Nota',
                valor:
                  'Campo de selección múltiple: un equipo puede contar en más de una fila.',
              },
            ]
          : []),
      ],
      bloques: [
        {
          titulo: '',
          columnas: [
            { titulo: d.etiqueta, ancho: 46 },
            { titulo: 'Equipos', ancho: 14, derecha: true },
            { titulo: '% del total', ancho: 14, derecha: true },
          ],
          filas: d.filas.map((f) => [f.etiqueta, f.cantidad, f.porcentaje]),
          filaFinal: ['TOTAL', d.total, ''],
          vacio: 'Sin equipos registrados.',
        },
      ],
    };
  }
}
