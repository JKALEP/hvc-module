import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Modulo, NivelFotos } from '../../generated/prisma/enums';
import {
  CLAVE_PUBLICO,
  CLAVE_MODULO,
  CLAVE_SUPERADMIN,
  CLAVE_NIVEL_FOTOS,
  CLAVE_CLIENTE,
} from './decoradores';
import type { PeticionConUsuario } from './tipos';

const ETIQUETA_MODULO: Record<Modulo, string> = {
  COSTOS: 'Costos',
  PERSONAL_PROYECTOS: 'Personal y proyectos',
  FOTOS: 'Fotos',
};

/**
 * Comprueba módulo, nivel y rol global. Corre después de JwtGuard, que ya
 * dejó el usuario en la petición.
 *
 * Toda la lógica de permisos vive aquí: los controllers solo declaran qué
 * exigen con un decorador de clase.
 */
@Injectable()
export class ModuloGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const objetivos = [contexto.getHandler(), contexto.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos))
      return true;

    const peticion = contexto.switchToHttp().getRequest<PeticionConUsuario>();
    const usuario = peticion.usuario;
    // JwtGuard ya habría lanzado 401; esto solo cubre un mal orden de guards.
    if (!usuario) throw new ForbiddenException('Sesión no resuelta.');

    /**
     * Un CLIENTE se rechaza SIEMPRE salvo donde se le abrió la puerta a
     * mano. Se comprueba antes que nada porque no tiene filas en
     * PermisoModulo y la regla de más abajo —"ruta sin módulo exigido,
     * pasa"— le habría dejado entrar a todo lo que no declara módulo.
     */
    if (usuario.rol === 'CLIENTE') {
      const permitido = this.reflector.getAllAndOverride<boolean>(
        CLAVE_CLIENTE,
        objetivos,
      );
      if (!permitido)
        throw new ForbiddenException(
          'Tu cuenta es de acceso externo: solo puedes ver lo que compartieron contigo.',
        );
      return true;
    }

    // El SuperAdmin pasa por encima de los módulos: es quien los reparte.
    if (usuario.rol === 'SUPERADMIN') return true;

    if (this.reflector.getAllAndOverride<boolean>(CLAVE_SUPERADMIN, objetivos))
      throw new ForbiddenException(
        'Solo el SuperAdmin puede gestionar usuarios y permisos.',
      );

    const modulo = this.reflector.getAllAndOverride<Modulo>(
      CLAVE_MODULO,
      objetivos,
    );
    if (!modulo) return true; // ruta autenticada pero sin módulo (p. ej. /auth/yo)

    const permiso = usuario.permisos.find((p) => p.modulo === modulo);
    if (!permiso)
      throw new ForbiddenException(
        `No tienes acceso al módulo ${ETIQUETA_MODULO[modulo]}.`,
      );

    const nivel = this.reflector.getAllAndOverride<NivelFotos>(
      CLAVE_NIVEL_FOTOS,
      objetivos,
    );
    if (nivel && permiso.nivelFotos !== nivel)
      throw new ForbiddenException(
        nivel === 'ADMIN_FOTOS'
          ? 'Esta acción requiere ser administrador de Fotos.'
          : 'No tienes el nivel necesario dentro del módulo Fotos.',
      );

    return true;
  }
}
