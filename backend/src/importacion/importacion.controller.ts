import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportacionService } from './importacion.service';
import type { EditarProductoDto } from './dto';
import { RequiereModulo } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';

@RequiereModulo(Modulo.COSTOS)
@Controller('importacion')
export class ImportacionController {
  constructor(private readonly importacion: ImportacionService) {}

  // SECCIÓN 1 — subir Excel
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file)
      throw new BadRequestException(
        'Debes adjuntar un archivo (campo "file").',
      );
    return this.importacion.importarDesdeExcel(file);
  }

  // SECCIÓN 2 — lista de importaciones
  @Get()
  listar() {
    return this.importacion.listar();
  }

  // Detalle de una importación con sus filas
  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.importacion.detalle(id);
  }

  // Editar una fila
  @Put(':id/producto/:productoId')
  editar(
    @Param('id', ParseIntPipe) id: number,
    @Param('productoId', ParseIntPipe) productoId: number,
    @Body() dto: EditarProductoDto,
  ) {
    return this.importacion.editarProducto(id, productoId, dto);
  }

  // Duplicar una fila (sin precio/proveedor/ruc)
  @Post(':id/producto/:productoId/duplicar')
  duplicar(
    @Param('id', ParseIntPipe) id: number,
    @Param('productoId', ParseIntPipe) productoId: number,
  ) {
    return this.importacion.duplicarProducto(id, productoId);
  }

  // Eliminar una fila
  @Delete(':id/producto/:productoId')
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @Param('productoId', ParseIntPipe) productoId: number,
  ) {
    return this.importacion.eliminarProducto(id, productoId);
  }

  // Eliminar una importación completa (para "Cancelar")
  @Delete(':id')
  eliminarImportacion(@Param('id', ParseIntPipe) id: number) {
    return this.importacion.eliminarImportacion(id);
  }
}
