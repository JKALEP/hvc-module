-- Fase 1 del módulo Costos — cimientos transversales.
--
-- Dos cosas, ninguna de ellas una tabla nueva:
--   1. El sub-rol dentro del módulo COSTOS.
--   2. La secuencia que genera el número de pedido (001-000106).
--
-- Las entidades del proceso (requerimiento, proveedor, cotización de
-- proveedor, aprobación, costo) llegan en la Fase 2. Esto es solo lo que
-- tiene que existir ANTES: sin rol no se puede cerrar un endpoint, y sin
-- secuencia no se puede numerar nada.
--
-- Verificar después de aplicar:
--   SELECT nextval('requerimiento_numero_seq');   -- 1, luego 2, luego 3…
--   SELECT modulo, "rolCostos" FROM permisos_modulo;

-- ── 1. Sub-rol del módulo Costos ────────────────────────────────────
-- Mismo patrón que "nivelFotos": columna nullable en permisos_modulo,
-- obligatoria solo cuando modulo = 'COSTOS'. Esa condición es un CHECK
-- entre columnas que Prisma no modela, así que la hace cumplir
-- UsuarioService.

CREATE TYPE "RolCostos" AS ENUM (
  'SOLICITANTE',
  'GESTOR_COTIZACIONES',
  'APROBADOR'
);

ALTER TABLE "permisos_modulo" ADD COLUMN "rolCostos" "RolCostos";

-- Las cuentas que ya tenían COSTOS se quedarían sin rol y no podrían
-- hacer nada dentro del módulo. Se les pone SOLICITANTE, que es el papel
-- de menos alcance: no aprueba ni recomienda. Reasignar el que
-- corresponda se hace desde /usuarios.
UPDATE "permisos_modulo"
   SET "rolCostos" = 'SOLICITANTE'
 WHERE "modulo" = 'COSTOS' AND "rolCostos" IS NULL;

-- ── 2. Número de pedido ─────────────────────────────────────────────
-- El 001-000106 de la especificación. La secuencia da el contador; la
-- serie ("001") y el relleno a seis dígitos los pone NumeracionService.
--
-- Por qué una SEQUENCE y no leer el último número y sumarle 1: leer y
-- sumar tiene una carrera —dos emisiones simultáneas piden el mismo
-- número y la segunda falla contra el índice único—. nextval() es
-- atómico y no bloquea.
--
-- START 1 e INCREMENT 1, sin CYCLE y sin MAXVALUE: la especificación
-- pide que el número no se repita NUNCA y no se reinicie por ningún
-- criterio, tampoco por año.
--
-- Si HVC quiere continuar su numeración actual en vez de empezar de
-- cero, es una línea:
--   ALTER SEQUENCE requerimiento_numero_seq RESTART WITH 107;

CREATE SEQUENCE "requerimiento_numero_seq"
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  NO CYCLE;
