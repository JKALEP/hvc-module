import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type {
  Modulo,
  NivelFotos,
  RolCostos,
} from '../../../generated/prisma/enums';
import {
  CLAVE_PUBLICO,
  CLAVE_MODULO,
  CLAVE_SUPERADMIN,
  CLAVE_NIVEL_FOTOS,
  CLAVE_ROL_COSTOS,
  CLAVE_CLIENTE,
} from '../decoradores';
import type { PeticionConUsuario } from '../tipos';
import { evaluar, aplicar, type Exigencias } from './reglas-autorizacion';

/**
 * Comprueba módulo, nivel y rol global. Corre después de JwtGuard, que ya
 * dejó el usuario en la petición.
 *
 * Aquí solo se leen los decoradores y se obedece la decisión: las reglas
 * viven en `reglas-autorizacion.ts`, sueltas y comprobables una a una.
 */
@Injectable()
export class ModuloGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /** Traduce los decoradores de la ruta a lo que exige. */
  private exigencias(contexto: ExecutionContext): Exigencias {
    const objetivos = [contexto.getHandler(), contexto.getClass()];
    const leer = <T>(clave: string) =>
      this.reflector.getAllAndOverride<T>(clave, objetivos);

    return {
      publico: Boolean(leer<boolean>(CLAVE_PUBLICO)),
      permiteCliente: Boolean(leer<boolean>(CLAVE_CLIENTE)),
      soloSuperAdmin: Boolean(leer<boolean>(CLAVE_SUPERADMIN)),
      modulo: leer<Modulo>(CLAVE_MODULO),
      nivelFotos: leer<NivelFotos>(CLAVE_NIVEL_FOTOS),
      rolesCostos: leer<RolCostos[]>(CLAVE_ROL_COSTOS),
    };
  }

  canActivate(contexto: ExecutionContext): boolean {
    const e = this.exigencias(contexto);
    if (e.publico) return true;

    const peticion = contexto.switchToHttp().getRequest<PeticionConUsuario>();
    const usuario = peticion.usuario;
    // JwtGuard ya habría lanzado 401; esto solo cubre un mal orden de guards.
    if (!usuario)
      return aplicar({ tipo: 'denegar', motivo: 'Sesión no resuelta.' });

    return aplicar(evaluar(usuario, e));
  }
}
