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
import { ReporteEquipoService } from './reporte-equipo.service';
import { ReporteConsolidadoService } from './reporte-consolidado.service';
import {
  ExportacionService,
  type Exportable,
} from '../common/exportacion.service';
import { aIdOpcional } from '../common/validacion';
import { SoloSuperAdmin } from '../auth/decoradores';

const TIPO_EXCEL =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Gestión de equipos — Fase 5: reportes.
 *
 * Dos preguntas y por eso dos services: «todo lo de este equipo» y
 * «cómo se reparte el inventario». Cada uno sabe además devolverse en
 * la forma genérica de `ExportacionService`, así que aquí solo se
 * decide el formato y se arma la descarga — la misma pieza que ya usa
 * el controlador de documentos.
 */
@SoloSuperAdmin()
@Controller('equipos/reporte')
export class ReporteController {
  constructor(
    private readonly fichas: ReporteEquipoService,
    private readonly consolidado: ReporteConsolidadoService,
    private readonly exportacion: ExportacionService,
  ) {}

  // ── Reporte individual ──

  @Get('equipo/:id')
  ficha(@Param('id', ParseIntPipe) id: number) {
    return this.fichas.ficha(id);
  }

  @Get('equipo/:id/exportar')
  async exportarFicha(
    @Res() res: Response,
    @Param('id', ParseIntPipe) id: number,
    @Query('formato') formato = 'excel',
  ) {
    await this.enviar(res, formato, await this.fichas.exportable(id));
  }

  // ── Consolidados ──

  @Get('resumen')
  resumen(@Query('organizacionId') organizacionId?: string) {
    return this.consolidado.resumen(this.aOrganizacion(organizacionId));
  }

  @Get('dimensiones')
  dimensiones(@Query('organizacionId') organizacionId?: string) {
    return this.consolidado.dimensiones(this.aOrganizacion(organizacionId));
  }

  @Get('distribucion')
  distribucion(
    @Query('dimension') dimension = 'organizacion',
    @Query('organizacionId') organizacionId?: string,
  ) {
    return this.consolidado.distribucion(
      dimension,
      this.aOrganizacion(organizacionId),
    );
  }

  @Get('distribucion/exportar')
  async exportarDistribucion(
    @Res() res: Response,
    @Query('dimension') dimension = 'organizacion',
    @Query('formato') formato = 'excel',
    @Query('organizacionId') organizacionId?: string,
  ) {
    await this.enviar(
      res,
      formato,
      await this.consolidado.exportable(
        dimension,
        this.aOrganizacion(organizacionId),
      ),
    );
  }

  /** Sin organización = todas. No es un error, es el consolidado global. */
  private aOrganizacion(valor?: string): number | null {
    return aIdOpcional(valor ?? null, 'La organización indicada no es válida.');
  }

  /** Un solo sitio arma la respuesta de descarga, para los dos formatos. */
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
