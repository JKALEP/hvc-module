import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { PayloadToken, UsuarioAutenticado } from './tipos';

export interface LoginDto {
  email?: string | null;
  password?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private limpiar(valor: unknown): string {
    return typeof valor === 'string' ? valor.trim() : '';
  }

  /**
   * Valida credenciales y devuelve el token.
   *
   * El mensaje de error es el MISMO para email inexistente y contraseña
   * incorrecta: distinguirlos le diría a un atacante qué correos están
   * registrados.
   */
  async login(dto: LoginDto) {
    const email = this.limpiar(dto.email).toLowerCase();
    const password = this.limpiar(dto.password);

    const generico = new UnauthorizedException(
      'Correo o contraseña incorrectos.',
    );
    if (!email || !password) throw generico;

    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        estado: true,
        passwordHash: true,
        permisos: { select: { modulo: true, nivelFotos: true } },
      },
    });
    if (!usuario) throw generico;

    const coincide = await bcrypt.compare(password, usuario.passwordHash);
    if (!coincide) throw generico;

    // Esta sí es específica: la cuenta existe y la clave es correcta, pero
    // está desactivada. Decir "credenciales incorrectas" mandaría a la
    // persona a resetear una contraseña que funciona.
    if (usuario.estado !== 'ACTIVO')
      throw new UnauthorizedException(
        'Tu cuenta está desactivada. Contacta al administrador.',
      );

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    // Solo el id: los permisos se leen de la BD en cada request.
    const payload: PayloadToken = { sub: usuario.id };

    return {
      token: await this.jwt.signAsync(payload),
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        permisos: usuario.permisos,
      } satisfies UsuarioAutenticado,
    };
  }

  /**
   * Emite sesión para un usuario ya identificado, sin pedir contraseña.
   *
   * Lo usa la activación de una invitación: la persona acaba de elegir su
   * contraseña, hacérsela escribir otra vez en la pantalla siguiente no
   * aporta seguridad y sí abandono. NO es un atajo de login: quien llama
   * ya demostró la identidad por otra vía.
   */
  async emitirSesion(usuarioId: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        permisos: { select: { modulo: true, nivelFotos: true } },
      },
    });
    if (!usuario) throw new UnauthorizedException('Cuenta no encontrada.');

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    const payload: PayloadToken = { sub: usuario.id };
    return {
      token: await this.jwt.signAsync(payload),
      usuario: usuario satisfies UsuarioAutenticado,
    };
  }

  /** Datos de la sesión vigente, para que el frontend arme el menú. */
  yo(usuario: UsuarioAutenticado) {
    return usuario;
  }
}
