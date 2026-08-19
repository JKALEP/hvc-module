import {
  Controller,
  Get,
  Post,
  Patch,
  Ip,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { CompartirService } from './compartir.service';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Compartir carpetas.
 *
 * Sin `@RequiereNivelFotos` a propósito: quien comparte no es un nivel sino
 * quien tiene Acceso Total SOBRE ESA CARPETA (§5), y eso incluye al
 * supervisor de §4 que la creó y no tiene ningún nivel global. El límite lo
 * pone `AccesoService`, que sabe QUÉ carpeta se está compartiendo; un
 * decorador solo sabe quién pide.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos/compartir')
export class CompartirController {
  constructor(private readonly compartir: CompartirService) {}

  /** Árbol que se puede ofrecer en el selector de carpetas. */
  @Get('carpetas')
  carpetas(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.compartir.carpetasQuePuedeCompartir(usuario);
  }

  /** Con quién está compartida una carpeta. */
  @Get('carpeta/:id')
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.compartir.listar(usuario, id);
  }

  /** Correo + N carpetas + el grado de §5, en un solo paso. */
  @Post()
  compartirCon(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body()
    dto: {
      email?: string;
      carpetaIds?: number[];
      permiso?: string;
      /** §9: los dos opcionales del formulario «Agregar colaborador». */
      expiraEn?: string;
      nombre?: string;
    },
    @Ip() ip: string,
  ) {
    return this.compartir.compartir(
      usuario,
      dto?.email,
      dto?.carpetaIds,
      dto?.permiso,
      dto?.expiraEn,
      dto?.nombre,
      ip,
    );
  }

  /**
   * Cambiar el grado de alguien sobre una carpeta (§10).
   *
   * PATCH y no otro POST a `/compartir`: la fila ya existe y lo que cambia
   * es su valor. Admite `SIN_ACCESO`, que es la restricción de §7.
   */
  @Patch('carpeta/:id/acceso/:usuarioId')
  cambiarGrado(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @Body() dto: { permiso?: string },
    @Ip() ip: string,
  ) {
    return this.compartir.cambiarGrado(
      usuario,
      id,
      usuarioId,
      dto?.permiso,
      ip,
    );
  }

  @Delete('carpeta/:id/acceso/:usuarioId')
  quitar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @Ip() ip: string,
  ) {
    return this.compartir.quitarAcceso(usuario, id, usuarioId, ip);
  }

  @Post('invitacion/:invitacionId/reenviar')
  reenviar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('invitacionId', ParseIntPipe) invitacionId: number,
    @Ip() ip: string,
  ) {
    return this.compartir.reenviar(usuario, invitacionId, ip);
  }

  @Delete('invitacion/:invitacionId')
  cancelar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('invitacionId', ParseIntPipe) invitacionId: number,
  ) {
    return this.compartir.cancelar(usuario, invitacionId);
  }
}
