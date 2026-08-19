import {
  SetMetadata,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type {
  Modulo,
  NivelFotos,
  RolCostos,
} from '../../generated/prisma/enums';
import type { PeticionConUsuario, UsuarioAutenticado } from './tipos';

// Claves de metadata que leen los guards.
export const CLAVE_PUBLICO = 'auth:publico';
export const CLAVE_MODULO = 'auth:modulo';
export const CLAVE_SUPERADMIN = 'auth:superadmin';
export const CLAVE_NIVEL_FOTOS = 'auth:nivelFotos';
export const CLAVE_ROL_COSTOS = 'auth:rolCostos';
export const CLAVE_CLIENTE = 'auth:cliente';

/**
 * Marca una ruta como abierta. Los guards son globales, así que esto es
 * la ÚNICA forma de dejar algo sin autenticar — y por eso salta a la
 * vista en la revisión de código.
 */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/**
 * Exige que el usuario tenga asignado ese módulo.
 * Va sobre la CLASE del controller: un decorador por controller, cero
 * lógica de permisos dentro de los métodos.
 */
export const RequiereModulo = (modulo: Modulo) =>
  SetMetadata(CLAVE_MODULO, modulo);

/** Solo la cuenta SuperAdmin. Para la gestión de usuarios. */
export const SoloSuperAdmin = () => SetMetadata(CLAVE_SUPERADMIN, true);

/**
 * Exige un nivel dentro del módulo FOTOS (Fase B).
 * Se combina con @RequiereModulo(Modulo.FOTOS).
 */
export const RequiereNivelFotos = (nivel: NivelFotos) =>
  SetMetadata(CLAVE_NIVEL_FOTOS, nivel);

/**
 * Exige uno de estos roles dentro del módulo COSTOS.
 *
 * Se combina con `@RequiereModulo(Modulo.COSTOS)`, que va en la clase; el
 * rol va en el MÉTODO, porque dentro de un mismo controller conviven
 * acciones de roles distintos —listar un requerimiento lo hacen los tres,
 * aprobarlo solo uno—.
 *
 * Variádico a propósito: `@RequiereRolCostos('SOLICITANTE', 'APROBADOR')`.
 * Un endpoint por rol para devolver lo mismo habría triplicado el
 * controller.
 *
 * El SUPERADMIN pasa por encima sin declarar nada: `reglaSuperAdmin` va
 * antes en la cadena.
 */
export const RequiereRolCostos = (...roles: RolCostos[]) =>
  SetMetadata(CLAVE_ROL_COSTOS, roles);

/**
 * Abre una ruta a las cuentas CLIENTE.
 *
 * Un cliente externo no tiene módulos, así que sin esto no llega a
 * ninguna parte: `ModuloGuard` lo rechaza por defecto. Marcar la ruta es
 * la única forma de abrirle una puerta, igual que `@Publico()` es la
 * única forma de dejar algo sin autenticar.
 */
export const PermiteCliente = () => SetMetadata(CLAVE_CLIENTE, true);

/** Inyecta el usuario ya validado en un handler. */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): UsuarioAutenticado | undefined => {
    const peticion = ctx.switchToHttp().getRequest<PeticionConUsuario>();
    return peticion.usuario;
  },
);
