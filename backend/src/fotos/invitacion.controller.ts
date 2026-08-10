import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InvitacionService } from './invitacion.service';
import { AuthService } from '../auth/auth.service';
import { Publico } from '../auth/decoradores';

/**
 * Activación de una invitación. RUTAS PÚBLICAS.
 *
 * Son las únicas del sistema que escriben sin sesión, así que llevan
 * límite de intentos propio: sin él, el token de 32 bytes queda expuesto
 * a fuerza bruta a ritmo de red.
 */
@Publico()
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('invitacion')
export class InvitacionController {
  constructor(
    private readonly invitacion: InvitacionService,
    private readonly auth: AuthService,
  ) {}

  /** Qué hay detrás del enlace, antes de pedir la contraseña. */
  @Get(':token')
  validar(@Param('token') token: string) {
    return this.invitacion.validar(token);
  }

  /**
   * Crea la cuenta y devuelve sesión iniciada: obligar a escribir la
   * contraseña otra vez, en la pantalla siguiente, no aporta nada.
   */
  @Post(':token/activar')
  async activar(
    @Param('token') token: string,
    @Body() dto: { nombre?: string; password?: string },
  ) {
    const cliente = await this.invitacion.activar(
      token,
      dto?.nombre,
      dto?.password,
    );
    return this.auth.emitirSesion(cliente.id);
  }
}
