import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  UseFilters,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { NavegacionService } from './navegacion.service';
import { CarpetaService } from './carpeta.service';
import type { CrearCarpetaDto, EditarCarpetaDto } from './carpeta.service';
import { ValorCampoFotosService } from './valor-campo-fotos.service';
import type { ArchivoSubido } from './foto.service';
import { LIMITES } from './imagen.service';
import { ErroresDeSubidaFilter } from './subida.filtro';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Carpetas: navegar y administrar. Todo bajo `/fotos/carpeta`.
 *
 * En v2 esto estaban repartidos entre `carpeta.controller` (leer) y
 * `sede.controller` (escribir), y eso dejaba `POST /fotos/sede` creando lo
 * que `GET /fotos/carpeta` devolvía. Un mismo recurso con dos nombres en la
 * misma API.
 *
 * Las fotos se fueron a `FotoController`: colgaban de aquí porque en v2 la
 * galería era de la carpeta, pero son otro recurso y otro service.
 *
 * `@Controller('fotos')` y no `('fotos/carpeta')` para que `recientes` sea
 * una ruta hermana y no caiga en `carpeta/:id`, que es la trampa clásica de
 * un parámetro que se come a una ruta literal declarada después.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos')
export class CarpetaController {
  constructor(
    private readonly navegacion: NavegacionService,
    private readonly carpeta: CarpetaService,
    private readonly valores: ValorCampoFotosService,
  ) {}

  /**
   * Contenido de la raíz: «Mis carpetas» y «Compartido conmigo» (§8, §21),
   * o el árbol entero para quien tiene nivel global.
   *
   * Con `q` deja de ser la raíz y pasa a ser una búsqueda en todo el árbol
   * visible, esté donde esté quien pregunta.
   */
  @Get('carpeta')
  raiz(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('q') q?: string,
    @Query('orden') orden?: string,
  ) {
    return this.navegacion.contenido(usuario, null, { q, orden });
  }

  /** Lo que cambió hace menos, de todo lo que este usuario alcanza (§21). */
  @Get('recientes')
  recientes(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.navegacion.recientes(usuario);
  }

  @Get('carpeta/:id')
  contenido(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('q') q?: string,
    @Query('orden') orden?: string,
  ) {
    return this.navegacion.contenido(usuario, id, { q, orden });
  }

  @Post('carpeta')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearCarpetaDto,
  ) {
    return this.carpeta.crear(usuario, dto);
  }

  /** Renombrar y/o mover. Archivar tiene su propia ruta: otra regla. */
  @Patch('carpeta/:id')
  editar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarCarpetaDto,
  ) {
    return this.carpeta.editar(usuario, id, dto);
  }

  /**
   * Archivar y reabrir, dos rutas y no un booleano en el PATCH.
   *
   * Es una decisión distinta de renombrar —la toma otro rol y sobre otra
   * pregunta: «esta obra ya terminó»—, y con un campo más del PATCH acababa
   * mezclada con la edición corriente en el cliente y en el servidor.
   */
  @Post('carpeta/:id/archivar')
  archivar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.carpeta.archivar(usuario, id, true);
  }

  @Post('carpeta/:id/reabrir')
  reabrir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.carpeta.archivar(usuario, id, false);
  }

  @Delete('carpeta/:id')
  eliminar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.carpeta.eliminar(usuario, id);
  }

  // ── Los datos del equipo (Fase 1b) ──
  //
  // Cuelgan de `carpeta/:id` porque son de ESTA carpeta y su permiso es el
  // de ella. Las DEFINICIONES —qué campos existen— viven en
  // `AdministracionFotosController`, que es configuración del módulo y pide
  // ADMIN_GLOBAL. Rellenar es de quien tiene EDICION aquí.

  /** La ficha: cada campo con lo que tenga rellenado. Pide LECTURA. */
  @Get('carpeta/:id/campo')
  verCampos(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.valores.deCarpeta(usuario, id);
  }

  /**
   * Guarda los campos que vengan, indexados por CLAVE.
   *
   * ⚠️ Es `PUT` pero la semántica es PARCIAL, no un reemplazo del recurso:
   * una clave ausente se deja como está y una con `null` se vacía. El
   * porqué está en `ValorCampoFotosService` — resumido: un campo de tipo
   * FOTO no cabe en un JSON, así que reemplazar en bloque se llevaría la
   * imagen cada vez que alguien corrigiera otro campo.
   */
  @Put('carpeta/:id/campo')
  guardarCampos(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { valores?: Record<string, unknown> },
  ) {
    if (!dto?.valores || typeof dto.valores !== 'object')
      throw new BadRequestException(
        'Falta `valores`: un objeto con la clave de cada campo y su valor.',
      );
    return this.valores.guardar(usuario, id, dto.valores);
  }

  /**
   * La imagen de un campo de tipo FOTO. UNA por campo: subir otra reemplaza.
   *
   * Pasa por el mismo `ImagenService` y los mismos límites de multer que
   * las fotos de obra —el riesgo es el mismo, una foto de móvil con su GPS
   * dentro— pero NO crea una fila de `Foto`: es un dato del equipo, no
   * evidencia de trabajo.
   */
  @Post('carpeta/:id/campo/:campoId/imagen')
  @UseFilters(ErroresDeSubidaFilter)
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: LIMITES.bytesMaximos } }),
  )
  subirImagenDeCampo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('campoId', ParseIntPipe) campoId: number,
    @UploadedFile() archivo?: ArchivoSubido,
  ) {
    if (!archivo)
      throw new BadRequestException('No llegó ninguna imagen (campo `foto`).');
    return this.valores.subirImagen(usuario, id, campoId, archivo);
  }

  @Delete('carpeta/:id/campo/:campoId/imagen')
  quitarImagenDeCampo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('campoId', ParseIntPipe) campoId: number,
  ) {
    return this.valores.quitarImagen(usuario, id, campoId);
  }
}
