import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { PlantillaAdminService } from './plantilla-admin.service';
import { SoloSuperAdmin, UsuarioActual } from '../../auth/decoradores';
import type { UsuarioAutenticado } from '../../auth/tipos';
import type { CrearVersionDto, PrevisualizarDto } from './dto';

/**
 * La plantilla del correo de solicitud (§32, §68), bajo SuperAdmin.
 *
 * Cuatro rutas y ninguna de borrado ni de edición, que es la forma del
 * problema: se lee lo que hay, se publica una versión nueva, se elige
 * cuál se usa y se previsualiza antes de publicar. Modificar o borrar
 * una versión ya usada reescribiría lo que dice un correo enviado, y
 * §68 existe justamente para poder afirmar con qué texto salió cada uno.
 *
 * Va con `@SoloSuperAdmin()` como el resto de la administración: el
 * texto que HVC manda a sus proveedores en su nombre no es una
 * preferencia del Gestor.
 */
@SoloSuperAdmin()
@Controller('costos/admin/plantilla')
export class PlantillaController {
  constructor(private readonly plantillas: PlantillaAdminService) {}

  /** La plantilla, sus versiones y qué se está usando ahora. */
  @Get()
  detalle(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.plantillas.detalle(usuario);
  }

  /** Publica una versión. Por defecto pasa a ser la activa. */
  @Post('version')
  crearVersion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearVersionDto,
  ) {
    return this.plantillas.crearVersion(usuario, dto);
  }

  /** Vuelve a una versión anterior sin reescribir nada. */
  @Post('version/:id/activar')
  activar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.plantillas.activar(usuario, id);
  }

  /** Cómo quedaría, con datos de ejemplo. No manda nada. */
  @Post('previsualizar')
  previsualizar(@Body() dto: PrevisualizarDto) {
    return this.plantillas.previsualizar(dto);
  }
}
