import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import { PlantillaService } from './plantilla.service';
import type { GuardarPlantillaDto } from './plantilla.service';
import { ImportacionFotosService } from './importacion.service';
import type { Decision } from './importacion.service';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import type { AccionFotos, EntidadFotos } from '../../generated/prisma/enums';

/** Tope del Excel. Un archivo de estructura no pesa megas. */
const MAX_BYTES_EXCEL = 5 * 1024 * 1024;

/**
 * Auditoría (§23), plantillas (§20) e importación por Excel (§19).
 *
 * Las tres viven juntas porque son la misma clase de cosa: **administrar el
 * módulo**, no trabajar dentro de una carpeta. Ninguna de las tres cuelga de
 * un `carpeta/:id` en su ruta principal.
 *
 * El permiso NO se decide aquí sino en cada service: consultar la bitácora y
 * administrar plantillas piden nivel global, mientras que APLICAR una
 * plantilla o importar un Excel piden EDICION sobre la carpeta destino —usar
 * las herramientas es de quien trabaja en obra, configurarlas es de quien
 * administra—.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos')
export class AdministracionFotosController {
  constructor(
    private readonly auditoria: AuditoriaFotosService,
    private readonly plantillas: PlantillaService,
    private readonly importacion: ImportacionFotosService,
  ) {}

  // ── Auditoría (§23) ──

  /** «Quién hizo qué y cuándo», con filtros. */
  @Get('auditoria')
  consultar(
    @Query('usuarioId', new ParseIntPipe({ optional: true }))
    usuarioId?: number,
    @Query('accion') accion?: string,
    @Query('entidad') entidad?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
  ) {
    return this.auditoria.consultar({
      usuarioId,
      accion: accion as AccionFotos | undefined,
      entidad: entidad as EntidadFotos | undefined,
      desde,
      hasta,
      cursor,
    });
  }

  /** El hilo de una carpeta: todo lo que le ha pasado (§23). */
  @Get('auditoria/carpeta/:id')
  deCarpeta(@Param('id', ParseIntPipe) id: number) {
    return this.auditoria.deCarpeta(id);
  }

  // ── Plantillas de estructura (§20) ──

  @Get('plantilla')
  listarPlantillas(@Query('activas') activas?: string) {
    return this.plantillas.listar(activas === 'true');
  }

  @Get('plantilla/:id')
  verPlantilla(@Param('id', ParseIntPipe) id: number) {
    return this.plantillas.detalle(id);
  }

  @Post('plantilla')
  crearPlantilla(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarPlantillaDto,
  ) {
    return this.plantillas.crear(usuario, dto ?? {});
  }

  @Patch('plantilla/:id')
  editarPlantilla(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarPlantillaDto,
  ) {
    return this.plantillas.editar(usuario, id, dto ?? {});
  }

  @Delete('plantilla/:id')
  eliminarPlantilla(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.plantillas.eliminar(usuario, id);
  }

  /** «Crear desde plantilla» (§20). La carpeta destino va en la ruta. */
  @Post('plantilla/:id/aplicar/:carpetaId')
  aplicarPlantilla(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('carpetaId', ParseIntPipe) carpetaId: number,
  ) {
    return this.plantillas.aplicar(usuario, id, carpetaId);
  }

  // ── Importación por Excel (§19) ──
  //
  // Dos rutas y no una: §19 exige vista previa ANTES de escribir, y el
  // archivo se manda las dos veces para no guardar estado de sesión en el
  // servidor. Ver la cabecera de `ImportacionFotosService`.

  @Post('importacion/carpeta/:id/previa')
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES_EXCEL } }),
  )
  previa(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) carpetaId: number,
    @UploadedFile() archivo?: { buffer: Buffer },
  ) {
    if (!archivo?.buffer)
      throw new BadRequestException('No se recibió ningún archivo.');
    return this.importacion.analizar(usuario, archivo.buffer, carpetaId);
  }

  @Post('importacion/carpeta/:id/confirmar')
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES_EXCEL } }),
  )
  confirmar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) carpetaId: number,
    @UploadedFile() archivo?: { buffer: Buffer },
    @Body() dto?: { decisiones?: string },
  ) {
    if (!archivo?.buffer)
      throw new BadRequestException('No se recibió ningún archivo.');

    // Las decisiones viajan como JSON en un campo del multipart: el cuerpo
    // no puede ser JSON puro porque lleva el archivo al lado.
    let decisiones: Record<number, Decision> = {};
    if (dto?.decisiones) {
      try {
        decisiones = JSON.parse(dto.decisiones) as Record<number, Decision>;
      } catch {
        throw new BadRequestException('Las decisiones no son un JSON válido.');
      }
    }

    return this.importacion.confirmar(
      usuario,
      archivo.buffer,
      carpetaId,
      decisiones,
    );
  }
}
