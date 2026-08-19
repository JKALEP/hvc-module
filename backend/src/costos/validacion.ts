import { BadRequestException } from '@nestjs/common';
import { EstadoCatalogo } from '../../generated/prisma/enums';
import { limpiar, describir } from '../common/texto';

/**
 * Las conversiones que repiten los maestros del módulo Costos.
 *
 * Mismo criterio que `personal/obra/validacion.ts`: lo que comparten dos
 * o más services del módulo vive aquí; lo que comparte todo el
 * repositorio está en `common/`. Nada de `class-validator` — la
 * validación se hace a mano y los mensajes van en español.
 */

/** Texto obligatorio, ya recortado. */
export function aTexto(valor: unknown, campo: string): string {
  const s = limpiar(valor);
  if (!s) throw new BadRequestException(`${campo} es obligatorio.`);
  return s;
}

/** Texto opcional: null, undefined y "" son null. */
export function aTextoOpcional(valor: unknown): string | null {
  return limpiar(valor);
}

/**
 * Correo opcional, normalizado a minúsculas.
 *
 * La comprobación es la misma de `UsuarioService`: deliberadamente laxa.
 * Validar un correo con una expresión regular estricta rechaza
 * direcciones legítimas, y la única prueba real de que existe es que
 * llegue el mensaje — que es justo lo que §33 pide registrar.
 */
export function aCorreoOpcional(valor: unknown): string | null {
  const s = limpiar(valor)?.toLowerCase();
  if (!s) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    throw new BadRequestException(`El correo "${s}" no es válido.`);
  return s;
}

/**
 * RUC opcional. Once dígitos: es el formato de SUNAT y no admite otro.
 *
 * Opcional porque un proveedor extranjero no tiene RUC, y porque HVC da
 * de alta proveedores antes de tener su ficha a mano (§31 deja los
 * obligatorios a criterio del negocio). Se limpian espacios y guiones
 * para que pegar "20-100-070-970" desde una factura funcione.
 */
export function aRucOpcional(valor: unknown): string | null {
  const s = limpiar(valor)?.replace(/[\s-]/g, '');
  if (!s) return null;
  if (!/^\d{11}$/.test(s))
    throw new BadRequestException(
      `El RUC debe tener 11 dígitos. Recibido: "${describir(valor)}".`,
    );
  return s;
}

/** Estado de un maestro: ACTIVO o INACTIVO. */
export function aEstadoCatalogo(valor: unknown): EstadoCatalogo {
  const s = limpiar(valor)?.toUpperCase();
  const validos = Object.values(EstadoCatalogo) as string[];
  if (s && validos.includes(s)) return s as EstadoCatalogo;
  throw new BadRequestException(
    `Estado inválido: "${describir(valor)}". Valores permitidos: ${validos.join(', ')}.`,
  );
}

/** Entero mayor o igual a 0, para los campos de orden. */
export function aOrden(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0)
    throw new BadRequestException(
      `El orden debe ser un entero mayor o igual a 0. Recibido: "${describir(valor)}".`,
    );
  return n;
}

/**
 * Corta el borrado de un maestro que alguien está usando.
 *
 * Las FK son RESTRICT, así que la base ya lo impediría — pero con un
 * error de Postgres que no dice qué lo está usando ni qué hacer en su
 * lugar. Aquí se comprueba antes para poder contarlo y para ofrecer la
 * salida correcta, que casi siempre es desactivar: §58 quiere catálogos
 * que el negocio pueda retirar sin perder lo ya registrado.
 */
export function exigirSinUso(
  usos: { cuantos: number; que: string }[],
  queEs: string,
): void {
  const enUso = usos.filter((u) => u.cuantos > 0);
  if (enUso.length === 0) return;

  const detalle = enUso.map((u) => `${u.cuantos} ${u.que}`).join(' y ');
  throw new BadRequestException(
    `No se puede eliminar ${queEs}: lo usan ${detalle}. ` +
      'Desactívalo si ya no debe ofrecerse: lo registrado se conserva.',
  );
}
