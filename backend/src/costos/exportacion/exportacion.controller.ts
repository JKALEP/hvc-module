import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ExportableService } from './exportable.service';
import {
  ExportacionService,
  type Exportable,
} from '../../common/exportacion.service';
import { RequiereModulo, UsuarioActual } from '../../auth/decoradores';
import { Modulo } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';

const TIPO_EXCEL =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Las descargas del módulo (§69).
 *
 * Se genera al momento y se devuelve como descarga; NO queda copia en el
 * servidor. Un archivo guardado se desincroniza del dato en cuanto algo
 * cambia, y aquí los ítems y los precios pueden cambiar hasta el final
 * (§54).
 *
 * Sin `@RequiereRolCostos`: quién puede ver QUÉ requerimiento es una
 * regla de alcance, no de rol, y ya la aplica `RequerimientoService`
 * dentro de cada método. Un Solicitante solo exporta lo suyo; el Gestor
 * y el Aprobador, lo que tienen que atender.
 */
@RequiereModulo(Modulo.COSTOS)
@Controller('costos/requerimiento')
export class ExportacionCostosController {
  constructor(
    private readonly exportable: ExportableService,
    private readonly exportacion: ExportacionService,
  ) {}

  /** El requerimiento con sus ítems (§19). */
  @Get(':id/exportar')
  async exportarRequerimiento(
    @Res() res: Response,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('formato') formato = 'excel',
  ) {
    await this.enviar(
      res,
      formato,
      await this.exportable.requerimiento(usuario, id),
    );
  }

  /** El comparativo de §37, con todas las cotizaciones recibidas. */
  @Get(':id/comparacion/exportar')
  async exportarComparativo(
    @Res() res: Response,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('formato') formato = 'excel',
  ) {
    await this.enviar(
      res,
      formato,
      await this.exportable.comparativo(usuario, id),
    );
  }

  /** Lo que finalmente costó (§51). */
  @Get(':id/costo/exportar')
  async exportarCosto(
    @Res() res: Response,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('formato') formato = 'excel',
  ) {
    await this.enviar(res, formato, await this.exportable.costo(usuario, id));
  }

  /**
   * Un solo sitio arma la respuesta de descarga, para los dos formatos.
   *
   * Copiado en espíritu del de Equipos —misma cabecera, mismo control de
   * formato— porque es la misma operación. Lo que NO se comparte es el
   * armado del contenido: aquello exporta `DocumentoExportable` (una
   * tabla de líneas con total), y estos tres son `Exportable` genéricos
   * con varios bloques.
   */
  private async enviar(res: Response, formato: string, doc: Exportable) {
    const f = formato.toLowerCase();
    if (f !== 'excel' && f !== 'pdf')
      throw new BadRequestException(
        `Formato inválido: "${formato}". Valores permitidos: excel, pdf.`,
      );

    const { buffer, nombreArchivo } =
      f === 'pdf'
        ? await this.exportacion.pdf(doc)
        : await this.exportacion.excel(doc);

    res.set({
      'Content-Type': f === 'pdf' ? 'application/pdf' : TIPO_EXCEL,
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }
}
