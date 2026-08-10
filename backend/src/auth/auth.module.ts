import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { UsuarioController } from './usuario.controller';
import { AuthService } from './auth.service';
import { UsuarioService } from './usuario.service';

// Vida del token: una jornada. Sin refresh token a propósito — para una
// herramienta interna no compensa la complejidad: si vence, se vuelve a
// entrar.
const EXPIRACION_TOKEN = '8h';

@Global()
@Module({
  imports: [
    JwtModule.register({
      // Sin secreto no se arranca: un default de desarrollo acabaría
      // desplegado en producción tarde o temprano.
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: EXPIRACION_TOKEN },
    }),
  ],
  controllers: [AuthController, UsuarioController],
  providers: [AuthService, UsuarioService],
  // JwtService lo necesita JwtGuard, que se registra global en AppModule.
  // AuthService lo necesita la activación de invitaciones, que emite
  // sesión en cuanto el cliente elige su contraseña.
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
