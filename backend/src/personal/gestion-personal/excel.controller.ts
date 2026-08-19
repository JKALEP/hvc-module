import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ImportacionPersonalService } from './importacion-personal.service';
import { EscrituraExcelService } from './escritura-excel.service';
import { RequiereModulo, UsuarioActual } from '../../auth/decoradores';
import { Modulo, TipoPersonal } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { aTipo } from './validacion';
import type { ConfirmarImportacionDto, HojaAImportar } from './dto';

/** 5 MB. Una lista SCTR de 90 personas pesa unos 20 KB. */
const TAMANO_MAXIMO = 5 * 1024 * 1024;

@RequiereModulo(Modulo.PERSONAL_PROYECTOS)
@Controller('gestion-personal/excel')
export class ExcelController {
  constructor(
    private readonly importacion: ImportacionPersonalService,
    private readonly escritura: EscrituraExcelService,
  ) {}

  private exigirArchivo(file?: Express.Multer.File): Buffer {
    if (!file)
      throw new BadRequestException(
        'Debes adjuntar el archivo Excel (campo "file").',
      );
    if (!/\.xlsx$/i.test(file.originalname))
      throw new BadRequestException(
        'El archivo debe ser .xlsx. Si tienes un .xls antiguo, ábrelo en Excel y guárdalo como .xlsx.',
      );
    return file.buffer;
  }

  /**
   * Paso 1 — vista previa. No escribe nada: devuelve las hojas con sus
   * bloques, el color detectado y el tipo sugerido para que el usuario
   * confirme el mapeo.
   */
  @Post('previsualizar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: TAMANO_MAXIMO } }),
  )
  previsualizar(@UploadedFile() file?: Express.Multer.File) {
    return this.importacion.previsualizar(this.exigirArchivo(file));
  }

  /**
   * Paso 2 — confirmar. Vuelve a subir el archivo junto con el mapeo:
   * así no hay que guardarlo en disco entre los dos pasos, que en Render
   * es efímero y se pierde en cada deploy.
   */
  @Post('importar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: TAMANO_MAXIMO } }),
  )
  importar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ConfirmarImportacionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const buffer = this.exigirArchivo(file);
    // Viaja como multipart, así que `hojas` llega en texto.
    let hojas: HojaAImportar[];
    try {
      hojas =
        typeof dto.hojas === 'string'
          ? (JSON.parse(dto.hojas) as HojaAImportar[])
          : (dto.hojas as HojaAImportar[]);
    } catch {
      throw new BadRequestException('El campo "hojas" no es una lista válida.');
    }
    return this.importacion.confirmar(usuario, buffer, hojas, dto.conflictos);
  }

  /**
   * Exporta un periodo. Sin `tipo` salen los dos en un solo libro, igual
   * que el archivo original de HVC (OPERATIVO + SUPERVISORES).
   *
   * GET /gestion-personal/excel/exportar?anio=2026&mes=7&tipo=CONTRATISTA
   */
  @Get('exportar')
  async exportar(
    @Res() res: Response,
    @Query('anio') anio: string,
    @Query('mes') mes: string,
    @Query('tipo') tipo?: string,
  ) {
    const tipos = tipo
      ? [aTipo(tipo)]
      : [TipoPersonal.CONTRATISTA, TipoPersonal.SUPERVISOR];

    const { buffer, nombreArchivo } = await this.escritura.generar(
      anio,
      mes,
      tipos,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }
}
