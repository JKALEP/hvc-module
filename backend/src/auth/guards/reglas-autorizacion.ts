import { ForbiddenException } from '@nestjs/common';
import type {
  Modulo,
  NivelFotos,
  RolCostos,
} from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../tipos';

/**
 * Las reglas de autorización, una función por regla.
 *
 * Vivían encadenadas dentro de `ModuloGuard` como una sucesión de `if`
 * con returns tempranos: leerlas exigía seguir el flujo entero y añadir
 * un rol nuevo obligaba a adivinar en qué punto de la cadena insertarlo.
 *
 * Cada función responde a UNA pregunta y devuelve una decisión explícita.
 * El guard solo las llama en orden y obedece.
 */

const ETIQUETA_MODULO: Record<Modulo, string> = {
  COSTOS: 'Costos',
  PERSONAL_PROYECTOS: 'Personal y proyectos',
  FOTOS: 'Fotos',
  EQUIPOS: 'Gestión de equipos',
};

/**
 * Qué decide una regla.
 *
 * `continuar` no es "sí": es "esta regla no opina, que decidan las
 * siguientes". Distinguirlo de `permitir` es lo que evita que una regla
 * permisiva cortocircuite a otra más estricta.
 */
export type Decision =
  | { tipo: 'permitir' }
  | { tipo: 'continuar' }
  | { tipo: 'denegar'; motivo: string };

const PERMITIR: Decision = { tipo: 'permitir' };
const CONTINUAR: Decision = { tipo: 'continuar' };
const denegar = (motivo: string): Decision => ({ tipo: 'denegar', motivo });

/** Lo que el guard extrae de los decoradores antes de preguntar. */
export interface Exigencias {
  publico: boolean;
  permiteCliente: boolean;
  soloSuperAdmin: boolean;
  modulo?: Modulo;
  nivelFotos?: NivelFotos;
  /** Vacío o ausente = la ruta no pide ningún rol concreto de Costos. */
  rolesCostos?: RolCostos[];
}

const ETIQUETA_ROL_COSTOS: Record<RolCostos, string> = {
  SOLICITANTE: 'Solicitante de requerimientos',
  GESTOR_COTIZACIONES: 'Gestor de cotizaciones',
  APROBADOR: 'Aprobador de cotizaciones',
};

/** Una ruta marcada `@Publico()` no mira ni quién pide. */
export function reglaPublica(e: Exigencias): Decision {
  return e.publico ? PERMITIR : CONTINUAR;
}

/**
 * Un CLIENTE se rechaza SIEMPRE salvo donde se le abrió la puerta a mano.
 *
 * Va antes que ninguna otra regla porque no tiene filas en PermisoModulo,
 * y `reglaModulo` —que deja pasar lo que no exige módulo— le habría
 * abierto todas las rutas que no lo declaran.
 */
export function reglaCliente(
  usuario: UsuarioAutenticado,
  e: Exigencias,
): Decision {
  if (usuario.rol !== 'CLIENTE') return CONTINUAR;
  return e.permiteCliente
    ? PERMITIR
    : denegar(
        'Tu cuenta es de acceso externo: solo puedes ver lo que compartieron contigo.',
      );
}

/** El SuperAdmin pasa por encima de los módulos: es quien los reparte. */
export function reglaSuperAdmin(usuario: UsuarioAutenticado): Decision {
  return usuario.rol === 'SUPERADMIN' ? PERMITIR : CONTINUAR;
}

/** Rutas reservadas al SuperAdmin. Se evalúa DESPUÉS de dejarle pasar a él. */
export function reglaSoloSuperAdmin(e: Exigencias): Decision {
  return e.soloSuperAdmin
    ? denegar('Solo el SuperAdmin puede gestionar usuarios y permisos.')
    : CONTINUAR;
}

/**
 * ¿Tiene el módulo que la ruta exige?
 *
 * Una ruta sin módulo declarado no opina: es el caso de `/auth/yo`, donde
 * cualquier sesión válida puede saber quién es. Devuelve `continuar` y no
 * `permitir` porque las reglas de sub-rol vienen después y tienen que
 * poder correr; con `permitir` cortocircuitaba la cadena entera.
 */
export function reglaModulo(
  usuario: UsuarioAutenticado,
  e: Exigencias,
): Decision {
  if (!e.modulo) return CONTINUAR;
  const permiso = usuario.permisos.find((p) => p.modulo === e.modulo);
  return permiso
    ? CONTINUAR
    : denegar(`No tienes acceso al módulo ${ETIQUETA_MODULO[e.modulo]}.`);
}

/**
 * Nivel dentro de FOTOS. Solo se comprueba si la ruta lo pide.
 *
 * Los dos caminos de "esta regla está conforme" devuelven `continuar`, no
 * `permitir`: da igual aquí —nivelFotos y rolCostos nunca conviven en la
 * misma ruta, son módulos distintos— pero un `permitir` en una regla
 * intermedia es una trampa para la siguiente que se añada.
 */
export function reglaNivelFotos(
  usuario: UsuarioAutenticado,
  e: Exigencias,
): Decision {
  if (!e.nivelFotos || !e.modulo) return CONTINUAR;
  const permiso = usuario.permisos.find((p) => p.modulo === e.modulo);
  if (permiso?.nivelFotos === e.nivelFotos) return CONTINUAR;
  return denegar(
    e.nivelFotos === 'ADMIN_GLOBAL'
      ? 'Esta acción requiere ser administrador global de Fotos.'
      : 'No tienes el nivel necesario dentro del módulo Fotos.',
  );
}

/**
 * Rol dentro de COSTOS. Solo se comprueba si la ruta lo pide.
 *
 * Es lo que hace cumplir en el servidor la separación de
 * responsabilidades del proceso: que el Solicitante no pueda llamar al
 * endpoint de aprobación, y que quien recomienda una cotización no sea
 * quien la aprueba. Ocultar el botón en el frontend no es una defensa.
 *
 * La ruta declara UNA LISTA de roles, no uno solo: consultar el detalle
 * de un requerimiento lo hacen los tres, y obligar a un endpoint por rol
 * habría triplicado el controller para devolver lo mismo.
 *
 * El SUPERADMIN no llega hasta aquí: `reglaSuperAdmin` ya le dejó pasar.
 * Es lo que le permite administrar catálogos, proveedores y plantillas
 * sin necesitar un rol propio dentro del módulo.
 */
export function reglaRolCostos(
  usuario: UsuarioAutenticado,
  e: Exigencias,
): Decision {
  if (!e.rolesCostos || e.rolesCostos.length === 0) return CONTINUAR;

  const permiso = usuario.permisos.find((p) => p.modulo === 'COSTOS');
  const rol = permiso?.rolCostos ?? null;

  // Sin rol asignado no se deniega con el mensaje de "te falta permiso":
  // el módulo lo tiene, lo que falta es que alguien le diga qué papel
  // juega. Es un problema de configuración de la cuenta, no del usuario.
  if (!rol)
    return denegar(
      'Tu cuenta tiene el módulo Costos pero no un rol dentro de él. ' +
        'Pide al administrador que te asigne uno.',
    );

  if (e.rolesCostos.includes(rol)) return CONTINUAR;

  const permitidos = e.rolesCostos
    .map((r) => ETIQUETA_ROL_COSTOS[r])
    .join(' o ');
  return denegar(
    `Esta acción es de: ${permitidos}. Tu rol en Costos es ${ETIQUETA_ROL_COSTOS[rol]}.`,
  );
}

/**
 * El orden ES la política. Se evalúan en secuencia y la primera que no
 * dice "continuar" manda.
 */
export function evaluar(usuario: UsuarioAutenticado, e: Exigencias): Decision {
  const cadena: Decision[] = [
    reglaPublica(e),
    reglaCliente(usuario, e),
    reglaSuperAdmin(usuario),
    reglaSoloSuperAdmin(e),
    reglaModulo(usuario, e),
    reglaNivelFotos(usuario, e),
    // Después de reglaModulo a propósito: primero se comprueba que la
    // cuenta tenga COSTOS, y solo entonces qué papel juega dentro. Al
    // revés, un usuario sin el módulo recibiría un mensaje sobre roles.
    reglaRolCostos(usuario, e),
  ];
  for (const d of cadena) if (d.tipo !== 'continuar') return d;
  return PERMITIR;
}

/** Traduce una decisión a la excepción de Nest, o deja pasar. */
export function aplicar(d: Decision): boolean {
  if (d.tipo === 'denegar') throw new ForbiddenException(d.motivo);
  return true;
}
