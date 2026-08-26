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
import { ExportableFotosService } from './exportable-fotos.service';
import {
  ExportacionService,
  type Exportable,
} from '../common/exportacion.service';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { AccionFotos, EntidadFotos } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

const TIPO_EXCEL =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Las descargas del módulo Fotos (§69).
 *
 * Controller propio y no un endpoint más en `ActividadController` y
 * `AdministracionFotosController`, por lo mismo que en Costos: los tres
 * documentos comparten la forma de responder —generar al vuelo y devolver
 * como adjunto— y esa mecánica escrita tres veces son tres sitios donde se
 * puede olvidar una cabecera.
 *
 * **Sin decorador de nivel ni de permiso.** Solo el módulo, igual que el
 * resto de Fotos: quién puede exportar QUÉ ya lo decide el service del que
 * se lee —LECTURA sobre la carpeta para las actividades y para el historial de
 * una carpeta, ADMIN_GLOBAL para la bitácora del módulo—. Poner aquí un
 * segundo candado sería duplicar la política justo donde es más fácil que
 * los dos se separen.
 *
 * Nada queda en el servidor: se genera y se envía. Un archivo guardado se
 * desincroniza del dato en cuanto alguien completa una actividad.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos')
export class ExportacionFotosController {
  constructor(
    private readonly exportable: ExportableFotosService,
    private readonly exportacion: ExportacionService,
  ) {}

  /** Las actividades de UNA INTERVENCIÓN (§13). */
  @Get('intervencion/:id/actividad/exportar')
  async exportarActividades(
    @Res() res: Response,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('estado') estado?: string,
    @Query('formato') formato = 'excel',
  ) {
    await this.enviar(
      res,
      formato,
      await this.exportable.actividadesDeIntervencion(usuario, id, { estado }),
    );
  }

  /** La bitácora del módulo (§23). Pide ADMIN_GLOBAL, vía el service. */
  @Get('auditoria/exportar')
  async exportarAuditoria(
    @Res() res: Response,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('usuarioId', new ParseIntPipe({ optional: true }))
    usuarioId?: number,
    @Query('accion') accion?: string,
    @Query('entidad') entidad?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('formato') formato = 'excel',
  ) {
    await this.enviar(
      res,
      formato,
      await this.exportable.auditoriaDelModulo(usuario, {
        usuarioId,
        accion: accion as AccionFotos | undefined,
        entidad: entidad as EntidadFotos | undefined,
        desde,
        hasta,
      }),
    );
  }

  /**
   * El historial de UNA carpeta (§23).
   *
   * Va después de `auditoria/exportar` en el archivo pero son rutas
   * distintas, así que el orden no importa aquí; se declaran juntas para
   * leerlas de un vistazo.
   */
  @Get('auditoria/carpeta/:id/exportar')
  async exportarHistorialDeCarpeta(
    @Res() res: Response,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('formato') formato = 'excel',
  ) {
    await this.enviar(
      res,
      formato,
      await this.exportable.auditoriaDeCarpeta(usuario, id),
    );
  }

  /**
   * Un solo sitio arma la respuesta, para los dos formatos.
   *
   * Gemelo del de Costos a propósito: es literalmente la misma operación
   * sobre el mismo `Exportable`. No se extrajo a `common/` porque son doce
   * líneas y compartirlas obligaría a que un módulo importara el controller
   * de otro; lo que sí se comparte —y es lo que importa— es el generador.
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
