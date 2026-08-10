import { Controller, Post, Get, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import type { LoginDto } from './auth.service';
import { Publico, UsuarioActual } from './decoradores';
import type { UsuarioAutenticado } from './tipos';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Abierta a propósito, junto con la activación de invitaciones.
  @Publico()
  // 10 intentos por minuto: de sobra para quien se equivoca al teclear,
  // insuficiente para probar contraseñas.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Sesión vigente: el frontend la usa para armar el menú y las rutas.
  // Autenticada, pero sin exigir módulo: todo usuario puede saber quién es.
  @Get('yo')
  yo(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.auth.yo(usuario);
  }
}
