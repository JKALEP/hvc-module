import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Res,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CotizacionService,
  type GuardarCotizacionDto,
  type EditarCotizacionDto,
} from './cotizacion.service';
import {
  OrdenCompraService,
  type GuardarOrdenDto,
  type EditarOrdenDto,
} from './orden-compra.service';
import {
  ExportacionService,
  type DocumentoExportable,
} from '../common/exportacion.service';
import { SoloSuperAdmin, UsuarioActual } from '../auth/decoradores';
import type { UsuarioAutenticado } from '../auth/tipos';

const TIPO_EXCEL =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Gestión de equipos — Fase 4: cotizaciones y órdenes de compra.
 *
 * Los dos documentos comparten controller porque comparten forma: se
 * listan, se editan y se exportan igual. Lo que cambia —estados,
 * relaciones, correlativo— vive en su service.
 */
@SoloSuperAdmin()
@Controller('equipos')
export class DocumentoController {
  constructor(
    private readonly cotizaciones: CotizacionService,
    private readonly ordenes: OrdenCompraService,
    private readonly exportacion: ExportacionService,
  ) {}

  // ── Cotizaciones ──

  @Get('organizacion/:id/cotizacion')
  listarCotizaciones(
    @Param('id', ParseIntPipe) id: number,
    @Query('estado') estado?: string,
    @Query('q') q?: string,
  ) {
    return this.cotizaciones.listar(id, { estado, q });
  }

  @Post('cotizacion')
  crearCotizacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarCotizacionDto,
  ) {
    return this.cotizaciones.crear(usuario, dto);
  }

  @Get('cotizacion/:id')
  detalleCotizacion(@Param('id', ParseIntPipe) id: number) {
    return this.cotizaciones.detalle(id);
  }

  @Patch('cotizacion/:id')
  editarCotizacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarCotizacionDto,
  ) {
    return this.cotizaciones.editar(usuario, id, dto);
  }

  @Delete('cotizacion/:id')
  eliminarCotizacion(@Param('id', ParseIntPipe) id: number) {
    return this.cotizaciones.eliminar(id);
  }

  // ── Órdenes de compra ──

  @Get('organizacion/:id/orden-compra')
  listarOrdenes(
    @Param('id', ParseIntPipe) id: number,
    @Query('estado') estado?: string,
    @Query('q') q?: string,
  ) {
    return this.ordenes.listar(id, { estado, q });
  }

  @Post('orden-compra')
  crearOrden(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarOrdenDto,
  ) {
    return this.ordenes.crear(usuario, dto);
  }

  /** Copia una cotización a una orden nueva y editable. */
  @Post('cotizacion/:id/orden-compra')
  ordenDesdeCotizacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordenes.desdeCotizacion(usuario, id);
  }

  @Get('orden-compra/:id')
  detalleOrden(@Param('id', ParseIntPipe) id: number) {
    return this.ordenes.detalle(id);
  }

  @Patch('orden-compra/:id')
  editarOrden(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarOrdenDto,
  ) {
    return this.ordenes.editar(usuario, id, dto);
  }

  @Delete('orden-compra/:id')
  eliminarOrden(@Param('id', ParseIntPipe) id: number) {
    return this.ordenes.eliminar(id);
  }

  // ── Exportación ──
  // Se genera al momento y se devuelve como descarga. No queda copia.

  @Get('cotizacion/:id/exportar')
  async exportarCotizacion(
    @Res() res: Response,
    @Param('id', ParseIntPipe) id: number,
    @Query('formato') formato = 'excel',
  ) {
    const c = await this.cotizaciones.detalle(id);
    await this.enviar(res, formato, {
      titulo: 'Cotización',
      codigo: c.codigo,
      organizacion: c.organizacion.nombre,
      proveedor: c.proveedor,
      estado: c.estado,
      fecha: c.creadoEn,
      referencias: [
        c.equipo
          ? {
              etiqueta: 'Equipo',
              valor: c.equipo.codigoInterno ?? `#${c.equipo.id}`,
            }
          : null,
        c.incidencia
          ? { etiqueta: 'Incidencia', valor: c.incidencia.codigo }
          : null,
      ].filter((r) => r !== null),
      lineas: c.lineas,
      total: c.total,
    });
  }

  @Get('orden-compra/:id/exportar')
  async exportarOrden(
    @Res() res: Response,
    @Param('id', ParseIntPipe) id: number,
    @Query('formato') formato = 'excel',
  ) {
    const o = await this.ordenes.detalle(id);
    await this.enviar(res, formato, {
      titulo: 'Orden de compra',
      codigo: o.codigo,
      organizacion: o.organizacion.nombre,
      proveedor: o.proveedor,
      estado: o.estado,
      fecha: o.creadoEn,
      referencias: [
        o.cotizacion
          ? { etiqueta: 'Cotización', valor: o.cotizacion.codigo }
          : null,
        o.equipo
          ? {
              etiqueta: 'Equipo',
              valor: o.equipo.codigoInterno ?? `#${o.equipo.id}`,
            }
          : null,
        o.incidencia
          ? { etiqueta: 'Incidencia', valor: o.incidencia.codigo }
          : null,
      ].filter((r) => r !== null),
      lineas: o.lineas,
      total: o.total,
    });
  }

  /** Un solo sitio arma la respuesta de descarga, para los dos formatos. */
  private async enviar(
    res: Response,
    formato: string,
    doc: DocumentoExportable,
  ) {
    const f = formato.toLowerCase();
    if (f !== 'excel' && f !== 'pdf')
      throw new BadRequestException(
        `Formato inválido: "${formato}". Valores permitidos: excel, pdf.`,
      );

    const { buffer, nombreArchivo } =
      f === 'pdf'
        ? await this.exportacion.pdfDocumento(doc)
        : await this.exportacion.excelDocumento(doc);

    res.set({
      'Content-Type': f === 'pdf' ? 'application/pdf' : TIPO_EXCEL,
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }
}
