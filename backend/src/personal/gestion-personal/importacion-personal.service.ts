import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CampoPersonal, TipoPersonal } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { LecturaExcelService, type HojaLeida } from './lectura-excel.service';
import { CatalogoService } from './catalogo.service';
import { aAnio, aMes, aTipo, aColor, COLOR_POR_TIPO } from './validacion';
import { limpiar } from '../../common/texto';
import type { HojaAImportar, ResolucionConflicto, HojaDetectada } from './dto';

/** Qué campo del catálogo alimenta cada columna de texto libre. */
const CAMPOS_CATALOGO: { clave: string; campo: CampoPersonal }[] = [
  { clave: 'tipoTrabajador', campo: CampoPersonal.TIPO_TRABAJADOR },
  { clave: 'paisNacimiento', campo: CampoPersonal.PAIS_NACIMIENTO },
  { clave: 'tipoDocumento', campo: CampoPersonal.TIPO_DOCUMENTO },
  { clave: 'sexo', campo: CampoPersonal.SEXO },
  { clave: 'moneda', campo: CampoPersonal.MONEDA },
  { clave: 'estadoCivil', campo: CampoPersonal.ESTADO_CIVIL },
  { clave: 'sede', campo: CampoPersonal.SEDE },
];

export interface ResultadoImportacion {
  hoja: string;
  anio: number;
  mes: number;
  tipo: TipoPersonal;
  gruposCreados: number;
  personasCreadas: number;
  personasSobrescritas: number;
  personasOmitidas: { fila: number; documento: string; motivo: string }[];
  filasConProblema: { fila: number; motivo: string }[];
}

@Injectable()
export class ImportacionPersonalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lectura: LecturaExcelService,
    private readonly catalogo: CatalogoService,
  ) {}

  /**
   * Paso 1: qué trae el archivo.
   *
   * No escribe nada. Devuelve las hojas con sus bloques, el color
   * detectado y el tipo sugerido, para que el usuario confirme el mapeo
   * antes de tocar la base.
   */
  async previsualizar(buffer: Buffer): Promise<HojaDetectada[]> {
    const wb = await this.lectura.abrir(buffer);
    return this.lectura.aResumen(this.lectura.analizar(wb));
  }

  /**
   * Paso 2: aplicar.
   *
   * Cada hoja se importa a su periodo en una transacción propia: si una
   * falla, las anteriores quedan guardadas y el error señala cuál fue.
   * Importar dos hojas es dos operaciones, no una.
   */
  async confirmar(
    usuario: UsuarioAutenticado,
    buffer: Buffer,
    hojas: HojaAImportar[],
    conflictosCrudo: unknown,
  ): Promise<ResultadoImportacion[]> {
    if (!Array.isArray(hojas) || hojas.length === 0)
      throw new BadRequestException(
        'Indica al menos una hoja, con su tipo y su periodo.',
      );

    const conflictos = this.aResolucion(conflictosCrudo);
    const wb = await this.lectura.abrir(buffer);
    const leidas = this.lectura.analizar(wb);
    const resultados: ResultadoImportacion[] = [];

    for (const pedido of hojas) {
      const nombre = limpiar(pedido.hoja);
      const leida = leidas.find((h) => h.hoja === nombre);
      if (!leida)
        throw new BadRequestException(
          `El archivo no tiene ninguna hoja llamada "${nombre ?? ''}".`,
        );
      resultados.push(
        await this.importarHoja(usuario, leida, pedido, conflictos),
      );
    }

    return resultados;
  }

  private aResolucion(valor: unknown): ResolucionConflicto {
    const s = limpiar(valor)?.toUpperCase();
    // SOBRESCRIBIR por defecto: el flujo real es corregir el Excel y
    // volver a subirlo esperando que reemplace lo anterior. Con OMITIR
    // por defecto, la corrección se perdía en silencio — el peor de los
    // dos fallos posibles.
    if (!s) return 'SOBRESCRIBIR';
    if (s === 'OMITIR' || s === 'SOBRESCRIBIR') return s;
    throw new BadRequestException(
      `Resolución inválida: "${s}". Valores permitidos: OMITIR, SOBRESCRIBIR.`,
    );
  }

  private async importarHoja(
    usuario: UsuarioAutenticado,
    leida: HojaLeida,
    pedido: HojaAImportar,
    conflictos: ResolucionConflicto,
  ): Promise<ResultadoImportacion> {
    const anio = aAnio(pedido.anio);
    const mes = aMes(pedido.mes);
    const tipo = aTipo(pedido.tipo);
    const color = aColor(
      pedido.colorGrupo ?? leida.colorGrupo,
      COLOR_POR_TIPO[tipo],
    );

    if (leida.bloques.length === 0)
      throw new BadRequestException(
        `La hoja "${leida.hoja}" no tiene ninguna fila importable. ` +
          (leida.problemas[0]?.motivo ?? ''),
      );

    const omitidas: ResultadoImportacion['personasOmitidas'] = [];
    let gruposCreados = 0;
    let creadas = 0;
    let sobrescritas = 0;

    await this.prisma.$transaction(async (tx) => {
      // El periodo se reutiliza si ya existe: importar dos veces el
      // mismo mes AÑADE al que hay, no lo reemplaza en silencio.
      const periodo = await tx.periodoPersonal.upsert({
        where: { anio_mes_tipo: { anio, mes, tipo } },
        create: { anio, mes, tipo, colorGrupo: color, creadoPorId: usuario.id },
        update: { colorGrupo: color },
      });

      // Documentos que ya están en el periodo, para resolver conflictos
      // sin una consulta por fila.
      const existentes = new Map(
        (
          await tx.fichaPersonal.findMany({
            where: { periodoId: periodo.id },
            select: { id: true, numeroDocumento: true },
          })
        ).map((f) => [f.numeroDocumento, f.id]),
      );

      let ordenGrupo = await tx.grupoPersonal
        .findFirst({
          where: { periodoId: periodo.id },
          orderBy: { orden: 'desc' },
          select: { orden: true },
        })
        .then((g) => (g?.orden ?? -1) + 1);

      for (const bloque of leida.bloques) {
        const nombreGrupo = bloque.grupo || 'SIN GRUPO';
        let grupo = await tx.grupoPersonal.findFirst({
          where: { periodoId: periodo.id, nombre: nombreGrupo },
          select: { id: true },
        });
        if (!grupo) {
          grupo = await tx.grupoPersonal.create({
            data: {
              periodoId: periodo.id,
              nombre: nombreGrupo,
              orden: ordenGrupo++,
            },
            select: { id: true },
          });
          gruposCreados++;
        }

        let orden = 0;
        for (const persona of bloque.personas) {
          const documento = persona.datos.numeroDocumento;
          const yaEstaba = existentes.get(documento);

          if (yaEstaba !== undefined) {
            if (conflictos === 'OMITIR') {
              omitidas.push({
                fila: persona.fila,
                documento,
                motivo: 'Ya estaba en este periodo.',
              });
              continue;
            }
            await tx.fichaPersonal.update({
              where: { id: yaEstaba },
              data: {
                ...persona.datos,
                grupoId: grupo.id,
                orden: orden++,
                actualizadoPorId: usuario.id,
              },
            });
            sobrescritas++;
            continue;
          }

          const creada = await tx.fichaPersonal.create({
            data: {
              ...persona.datos,
              periodoId: periodo.id,
              grupoId: grupo.id,
              orden: orden++,
              actualizadoPorId: usuario.id,
            },
            select: { id: true },
          });
          existentes.set(documento, creada.id);
          creadas++;
        }
      }
    });

    // Los valores nuevos pasan a estar en los desplegables. Fuera de la
    // transacción: que el catálogo falle no puede tumbar una importación
    // de 74 personas ya escrita.
    await this.catalogo.registrarValores(
      leida.bloques.flatMap((b) =>
        b.personas.flatMap((p) =>
          CAMPOS_CATALOGO.map((c) => ({
            campo: c.campo,
            valor: (p.datos as unknown as Record<string, string>)[c.clave],
          })),
        ),
      ),
    );

    return {
      hoja: leida.hoja,
      anio,
      mes,
      tipo,
      gruposCreados,
      personasCreadas: creadas,
      personasSobrescritas: sobrescritas,
      personasOmitidas: omitidas,
      filasConProblema: leida.problemas,
    };
  }
}
