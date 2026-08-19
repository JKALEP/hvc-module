import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { CLAVE_PUBLICO } from '../decoradores';
import type { PayloadToken, PeticionConUsuario } from '../tipos';

/**
 * Valida el JWT y deja el usuario resuelto en la petición.
 *
 * Se registra como APP_GUARD, así que protege TODO por defecto: una ruta
 * nueva nace cerrada y hay que abrirla a mano con @Publico(). Es al revés
 * de tener que acordarse de proteger cada endpoint nuevo.
 *
 * Los permisos se cargan de la BD aquí, no del token: así quitarle un
 * módulo a alguien o desactivar su cuenta surte efecto en la siguiente
 * petición, sin esperar a que expire el token.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private extraerToken(peticion: PeticionConUsuario): string | null {
    const cabecera = peticion.headers['authorization'];
    const valor = Array.isArray(cabecera) ? cabecera[0] : cabecera;
    if (!valor) return null;
    const [tipo, token] = valor.split(' ');
    return tipo === 'Bearer' && token ? token : null;
  }

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico) return true;

    const peticion = contexto.switchToHttp().getRequest<PeticionConUsuario>();
    const token = this.extraerToken(peticion);
    if (!token)
      throw new UnauthorizedException(
        'Falta el token de sesión. Inicia sesión de nuevo.',
      );

    let payload: PayloadToken;
    try {
      payload = await this.jwt.verifyAsync<PayloadToken>(token);
    } catch {
      throw new UnauthorizedException(
        'La sesión expiró o el token no es válido. Inicia sesión de nuevo.',
      );
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        estado: true,
        permisos: {
          select: { modulo: true, nivelFotos: true, rolCostos: true },
        },
      },
    });

    if (!usuario) throw new UnauthorizedException('La cuenta ya no existe.');
    if (usuario.estado !== 'ACTIVO')
      throw new UnauthorizedException('La cuenta está desactivada.');

    peticion.usuario = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      permisos: usuario.permisos,
    };
    return true;
  }
}
