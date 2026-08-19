import type {
  Modulo,
  NivelFotos,
  RolCostos,
  RolGlobal,
} from '../../generated/prisma/enums';

/**
 * Usuario ya validado, tal como queda adjunto a la petición.
 *
 * Los permisos se leen de la BD en cada request, NO del token: si
 * vinieran en el token, quitarle un módulo a alguien no tendría efecto
 * hasta que cerrara sesión, y desactivar una cuenta no la echaría.
 */
export interface UsuarioAutenticado {
  id: number;
  email: string;
  nombre: string;
  rol: RolGlobal;
  permisos: {
    modulo: Modulo;
    /** Solo tiene valor cuando modulo === 'FOTOS'. */
    nivelFotos: NivelFotos | null;
    /** Solo tiene valor cuando modulo === 'COSTOS'. */
    rolCostos: RolCostos | null;
  }[];
}

/** Lo único que viaja dentro del JWT. */
export interface PayloadToken {
  sub: number; // usuarioId
}

/** Request de Express con el usuario ya resuelto por JwtGuard. */
export interface PeticionConUsuario {
  usuario?: UsuarioAutenticado;
  headers: Record<string, string | string[] | undefined>;
}
