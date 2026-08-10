import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { CompartirService } from './compartir.service';
import type { Objetivo } from './compartir.service';
import {
  RequiereModulo,
  RequiereNivelFotos,
  UsuarioActual,
} from '../auth/decoradores';
import { Modulo, NivelFotos } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Compartir carpetas y álbumes. Solo un ADMIN_FOTOS.
 *
 * `:tipo` es "carpeta" o "album" —el lenguaje de la URL es el de la UI,
 * no el del schema—, y se traduce aquí al objetivo interno.
 */
@RequiereModulo(Modulo.FOTOS)
@RequiereNivelFotos(NivelFotos.ADMIN_FOTOS)
@Controller('fotos/compartir')
export class CompartirController {
  constructor(private readonly compartir: CompartirService) {}

  private objetivo(tipo: string, id: number): Objetivo {
    if (tipo === 'carpeta') return { tipo: 'sede', id };
    if (tipo === 'album') return { tipo: 'album', id };
    throw new BadRequestException(
      `No se puede compartir "${tipo}". Solo "carpeta" o "album".`,
    );
  }

  @Get(':tipo/:id')
  listar(@Param('tipo') tipo: string, @Param('id', ParseIntPipe) id: number) {
    return this.compartir.listar(this.objetivo(tipo, id));
  }

  @Post(':tipo/:id')
  compartirCon(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('tipo') tipo: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { email?: string },
  ) {
    return this.compartir.compartir(
      usuario,
      this.objetivo(tipo, id),
      dto?.email,
    );
  }

  @Delete(':tipo/:id/acceso/:usuarioId')
  quitar(
    @Param('tipo') tipo: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
  ) {
    return this.compartir.quitarAcceso(this.objetivo(tipo, id), usuarioId);
  }

  @Post('invitacion/:invitacionId/reenviar')
  reenviar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('invitacionId', ParseIntPipe) invitacionId: number,
  ) {
    return this.compartir.reenviar(usuario, invitacionId);
  }

  @Delete('invitacion/:invitacionId')
  cancelar(@Param('invitacionId', ParseIntPipe) invitacionId: number) {
    return this.compartir.cancelar(invitacionId);
  }
}
