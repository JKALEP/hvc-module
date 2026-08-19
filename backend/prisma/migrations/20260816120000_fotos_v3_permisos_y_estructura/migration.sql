-- ═════════════════════════════════════════════════════════════
-- Módulo Fotos v3 — permisos de dos niveles y estructura de trabajo
--
-- Reescribe el módulo entero sobre la especificación funcional de HVC:
--   · `sedes` → `carpetas_fotos`, con propietario (§6), tipo y FK opcional
--     al catálogo de equipos (§12).
--   · `lotes_fotos` → `albumes_fotos`, con nombre y descripción (§16).
--   · tareas (§13) y comentarios (§14) como tablas nuevas.
--   · `accesos_compartidos.permiso` — el grado de §5, que v2 no tenía.
--   · bitácora propia `eventos_fotos` (§23) y plantillas de estructura (§20).
--
-- Se PRESERVAN `usuarios` y `permisos_modulo`: las cuentas son lo único
-- de la demo que cuesta reconstruir. El contenido de Fotos (11 carpetas,
-- 3 álbumes, 3 fotos, 1 invitación) se borra a propósito — no hay forma
-- de darle un propietario ni un permiso a filas que nacieron sin ellos, y
-- HVC confirmó que es material de demo.
--
-- ⚠️ Las 3 fotos borradas dejan sus objetos huérfanos en R2. No se limpian
-- desde aquí: una migración de esquema no debe hablar con el object
-- storage, y el bucket es de desarrollo.
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 0. Vaciado del contenido de Fotos v2, en orden de dependencia.
--
-- Va ANTES de tocar las columnas porque los ALTER de más abajo añaden
-- `carpetaId` y `permiso` como NOT NULL sin default: con filas dentro,
-- Postgres no tiene qué poner ahí y el paso falla.
-- ─────────────────────────────────────────────────────────────
DELETE FROM "fotos";
DELETE FROM "invitaciones_carpeta";
DELETE FROM "invitaciones_cliente";
DELETE FROM "accesos_compartidos";

-- ─────────────────────────────────────────────────────────────
-- 1. Enums nuevos.
-- ─────────────────────────────────────────────────────────────
CREATE TYPE "PermisoCarpeta" AS ENUM ('LECTURA', 'EDICION', 'TOTAL', 'SIN_ACCESO');
CREATE TYPE "TipoCarpetaFotos" AS ENUM ('CARPETA', 'EQUIPO');
CREATE TYPE "EstadoTareaFotos" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA');
CREATE TYPE "PrioridadTareaFotos" AS ENUM ('BAJA', 'MEDIA', 'ALTA');
CREATE TYPE "TipoNodoPlantilla" AS ENUM ('CARPETA', 'TAREA', 'ALBUM');
CREATE TYPE "EntidadFotos" AS ENUM ('CARPETA', 'ALBUM', 'TAREA', 'COMENTARIO', 'FOTO', 'ACCESO', 'INVITACION', 'PLANTILLA', 'IMPORTACION', 'EQUIPO');
CREATE TYPE "AccionFotos" AS ENUM ('CREACION', 'EDICION', 'ELIMINACION', 'MOVIMIENTO', 'ARCHIVADO', 'REAPERTURA', 'TAREA_COMPLETADA', 'TAREA_REABIERTA', 'SUBIDA_FOTO', 'DESCARGA_FOTO', 'CLASIFICACION', 'COMPARTIR', 'CAMBIO_PERMISO', 'REVOCAR_ACCESO', 'INVITACION_ENVIADA', 'INVITACION_ACEPTADA', 'IMPORTACION_EXCEL', 'CREACION_DESDE_PLANTILLA', 'EQUIPO_CREADO_DESDE_FOTOS');

-- ─────────────────────────────────────────────────────────────
-- 2. `NivelFotos` pasa de dos valores a tres, y cambian de significado.
--
-- v2 mezclaba las dos preguntas de §2 en una columna: ADMIN_FOTOS era un
-- alcance global, pero COLABORADOR no —era la AUSENCIA de alcance global,
-- «solo lo que me compartieron»—. En v3 eso es `NULL`, así que la
-- traducción es:
--
--   COLABORADOR  → NULL           (el supervisor de §4)
--   ADMIN_FOTOS  → ADMIN_GLOBAL   (§3.4)
--
-- El UPDATE va primero porque la columna sigue siendo del tipo viejo, que
-- es el único que admite escribir 'COLABORADOR' en el WHERE. Después el
-- USING solo tiene que traducir el valor que queda.
-- ─────────────────────────────────────────────────────────────
UPDATE "permisos_modulo" SET "nivelFotos" = NULL WHERE "nivelFotos" = 'COLABORADOR';

CREATE TYPE "NivelFotos_new" AS ENUM ('LECTURA_GLOBAL', 'EDITOR_GLOBAL', 'ADMIN_GLOBAL');
ALTER TABLE "permisos_modulo" ALTER COLUMN "nivelFotos" TYPE "NivelFotos_new"
  USING (CASE "nivelFotos"::text WHEN 'ADMIN_FOTOS' THEN 'ADMIN_GLOBAL' END::"NivelFotos_new");
ALTER TYPE "NivelFotos" RENAME TO "NivelFotos_old";
ALTER TYPE "NivelFotos_new" RENAME TO "NivelFotos";
DROP TYPE "public"."NivelFotos_old";

-- ─────────────────────────────────────────────────────────────
-- 3. Fuera lo de v2 que cambia de forma.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "accesos_compartidos" DROP CONSTRAINT "accesos_compartidos_sedeId_fkey";
ALTER TABLE "fotos" DROP CONSTRAINT "fotos_loteId_fkey";
ALTER TABLE "invitaciones_carpeta" DROP CONSTRAINT "invitaciones_carpeta_sedeId_fkey";
ALTER TABLE "lotes_fotos" DROP CONSTRAINT "lotes_fotos_creadoPorId_fkey";
ALTER TABLE "lotes_fotos" DROP CONSTRAINT "lotes_fotos_sedeId_fkey";
ALTER TABLE "sedes" DROP CONSTRAINT "sedes_parentId_fkey";

DROP INDEX "accesos_compartidos_usuarioId_sedeId_key";
DROP INDEX "fotos_loteId_creadoEn_idx";
DROP INDEX "fotos_subidaPorId_idx";
DROP INDEX "invitaciones_carpeta_invitacionId_sedeId_key";
DROP INDEX "invitaciones_carpeta_sedeId_idx";

ALTER TABLE "accesos_compartidos" DROP COLUMN "sedeId",
  ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL,
  ADD COLUMN "carpetaId" INTEGER NOT NULL,
  ADD COLUMN "permiso" "PermisoCarpeta" NOT NULL;

ALTER TABLE "fotos" DROP COLUMN "loteId",
  ADD COLUMN "albumId" INTEGER,
  ADD COLUMN "nombreOriginal" TEXT,
  ADD COLUMN "tareaId" INTEGER;

ALTER TABLE "invitaciones_carpeta" DROP COLUMN "sedeId",
  ADD COLUMN "carpetaId" INTEGER NOT NULL,
  ADD COLUMN "permiso" "PermisoCarpeta" NOT NULL;

ALTER TABLE "invitaciones_cliente" ADD COLUMN "nombre" TEXT;

DROP TABLE "lotes_fotos";
DROP TABLE "sedes";

-- `EstadoSede` (ACTIVA/INACTIVA) se retira sin sustituto: era un segundo
-- estado que nadie hacía cumplir y que se pisaba con `cerrada`, el único
-- que sí corta la escritura. La especificación no pide ninguno de los dos
-- salvo el archivado.
DROP TYPE "EstadoSede";

-- ─────────────────────────────────────────────────────────────
-- 4. Tablas nuevas.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE "carpetas_fotos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "parentId" INTEGER,
    "ruta" TEXT NOT NULL,
    "tipo" "TipoCarpetaFotos" NOT NULL DEFAULT 'CARPETA',
    "equipoId" INTEGER,
    "propietarioId" INTEGER NOT NULL,
    "cerrada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carpetas_fotos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "albumes_fotos" (
    "id" SERIAL NOT NULL,
    "carpetaId" INTEGER NOT NULL,
    "nombre" TEXT,
    "descripcion" TEXT,
    "fecha" DATE,
    "creadoPorId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "albumes_fotos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tareas_fotos" (
    "id" SERIAL NOT NULL,
    "carpetaId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoTareaFotos" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "PrioridadTareaFotos",
    "fecha" DATE,
    "responsableId" INTEGER,
    "creadoPorId" INTEGER NOT NULL,
    "completadaEn" TIMESTAMP(3),
    "completadaPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tareas_fotos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comentarios_fotos" (
    "id" SERIAL NOT NULL,
    "carpetaId" INTEGER,
    "tareaId" INTEGER,
    "albumId" INTEGER,
    "fotoId" INTEGER,
    "texto" TEXT NOT NULL,
    "autorId" INTEGER,
    "autorNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEn" TIMESTAMP(3),

    CONSTRAINT "comentarios_fotos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plantillas_estructura_fotos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_estructura_fotos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plantillas_estructura_nodos_fotos" (
    "id" SERIAL NOT NULL,
    "plantillaId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "tipo" "TipoNodoPlantilla" NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plantillas_estructura_nodos_fotos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "eventos_fotos" (
    "id" SERIAL NOT NULL,
    "carpetaId" INTEGER,
    "entidad" "EntidadFotos" NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "accion" "AccionFotos" NOT NULL,
    "usuarioId" INTEGER,
    "usuarioNombre" TEXT,
    "campoAfectado" TEXT,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "descripcion" TEXT,
    "ip" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_fotos_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────
-- 5. Índices.
-- ─────────────────────────────────────────────────────────────
CREATE INDEX "carpetas_fotos_parentId_idx" ON "carpetas_fotos"("parentId");
CREATE INDEX "carpetas_fotos_ruta_idx" ON "carpetas_fotos"("ruta");
CREATE INDEX "carpetas_fotos_equipoId_idx" ON "carpetas_fotos"("equipoId");
CREATE INDEX "carpetas_fotos_propietarioId_idx" ON "carpetas_fotos"("propietarioId");
CREATE UNIQUE INDEX "carpetas_fotos_parentId_nombre_key" ON "carpetas_fotos"("parentId", "nombre");
CREATE INDEX "albumes_fotos_carpetaId_creadoEn_idx" ON "albumes_fotos"("carpetaId", "creadoEn");
CREATE INDEX "tareas_fotos_carpetaId_estado_idx" ON "tareas_fotos"("carpetaId", "estado");
CREATE INDEX "tareas_fotos_responsableId_estado_idx" ON "tareas_fotos"("responsableId", "estado");
CREATE INDEX "comentarios_fotos_carpetaId_creadoEn_idx" ON "comentarios_fotos"("carpetaId", "creadoEn");
CREATE INDEX "comentarios_fotos_tareaId_creadoEn_idx" ON "comentarios_fotos"("tareaId", "creadoEn");
CREATE INDEX "comentarios_fotos_albumId_creadoEn_idx" ON "comentarios_fotos"("albumId", "creadoEn");
CREATE INDEX "comentarios_fotos_fotoId_creadoEn_idx" ON "comentarios_fotos"("fotoId", "creadoEn");
CREATE UNIQUE INDEX "plantillas_estructura_fotos_nombre_key" ON "plantillas_estructura_fotos"("nombre");
CREATE INDEX "plantillas_estructura_nodos_fotos_plantillaId_parentId_orde_idx" ON "plantillas_estructura_nodos_fotos"("plantillaId", "parentId", "orden");
CREATE INDEX "eventos_fotos_carpetaId_creadoEn_idx" ON "eventos_fotos"("carpetaId", "creadoEn");
CREATE INDEX "eventos_fotos_entidad_entidadId_creadoEn_idx" ON "eventos_fotos"("entidad", "entidadId", "creadoEn");
CREATE INDEX "accesos_compartidos_carpetaId_idx" ON "accesos_compartidos"("carpetaId");
CREATE UNIQUE INDEX "accesos_compartidos_usuarioId_carpetaId_key" ON "accesos_compartidos"("usuarioId", "carpetaId");
CREATE INDEX "fotos_albumId_creadoEn_idx" ON "fotos"("albumId", "creadoEn");
CREATE INDEX "fotos_tareaId_creadoEn_idx" ON "fotos"("tareaId", "creadoEn");
CREATE INDEX "fotos_subidaPorId_creadoEn_idx" ON "fotos"("subidaPorId", "creadoEn");
CREATE INDEX "invitaciones_carpeta_carpetaId_idx" ON "invitaciones_carpeta"("carpetaId");
CREATE UNIQUE INDEX "invitaciones_carpeta_invitacionId_carpetaId_key" ON "invitaciones_carpeta"("invitacionId", "carpetaId");

-- ─────────────────────────────────────────────────────────────
-- 6. Claves ajenas.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "carpetas_fotos" ADD CONSTRAINT "carpetas_fotos_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "carpetas_fotos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "carpetas_fotos" ADD CONSTRAINT "carpetas_fotos_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "carpetas_fotos" ADD CONSTRAINT "carpetas_fotos_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "albumes_fotos" ADD CONSTRAINT "albumes_fotos_carpetaId_fkey" FOREIGN KEY ("carpetaId") REFERENCES "carpetas_fotos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "albumes_fotos" ADD CONSTRAINT "albumes_fotos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tareas_fotos" ADD CONSTRAINT "tareas_fotos_carpetaId_fkey" FOREIGN KEY ("carpetaId") REFERENCES "carpetas_fotos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tareas_fotos" ADD CONSTRAINT "tareas_fotos_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tareas_fotos" ADD CONSTRAINT "tareas_fotos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tareas_fotos" ADD CONSTRAINT "tareas_fotos_completadaPorId_fkey" FOREIGN KEY ("completadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accesos_compartidos" ADD CONSTRAINT "accesos_compartidos_carpetaId_fkey" FOREIGN KEY ("carpetaId") REFERENCES "carpetas_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitaciones_carpeta" ADD CONSTRAINT "invitaciones_carpeta_carpetaId_fkey" FOREIGN KEY ("carpetaId") REFERENCES "carpetas_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "albumes_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comentarios_fotos" ADD CONSTRAINT "comentarios_fotos_carpetaId_fkey" FOREIGN KEY ("carpetaId") REFERENCES "carpetas_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comentarios_fotos" ADD CONSTRAINT "comentarios_fotos_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comentarios_fotos" ADD CONSTRAINT "comentarios_fotos_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "albumes_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comentarios_fotos" ADD CONSTRAINT "comentarios_fotos_fotoId_fkey" FOREIGN KEY ("fotoId") REFERENCES "fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comentarios_fotos" ADD CONSTRAINT "comentarios_fotos_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plantillas_estructura_fotos" ADD CONSTRAINT "plantillas_estructura_fotos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plantillas_estructura_nodos_fotos" ADD CONSTRAINT "plantillas_estructura_nodos_fotos_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_estructura_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plantillas_estructura_nodos_fotos" ADD CONSTRAINT "plantillas_estructura_nodos_fotos_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "plantillas_estructura_nodos_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_fotos" ADD CONSTRAINT "eventos_fotos_carpetaId_fkey" FOREIGN KEY ("carpetaId") REFERENCES "carpetas_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_fotos" ADD CONSTRAINT "eventos_fotos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- 7. Los tres CHECK que Prisma no sabe declarar.
--
-- Son invariantes de forma, no reglas de negocio: si la base puede
-- impedir que exista una fila imposible, la impide. Los services siguen
-- validándolos para dar un mensaje en español, pero el último candado
-- está aquí — un service se puede saltar, un CHECK no.
--
-- Se documentan en el schema con un comentario cada uno, porque
-- `prisma migrate diff` no los ve y nada en el .prisma delata que existen.
-- ─────────────────────────────────────────────────────────────

-- Una foto cuelga de un álbum O de una tarea, nunca de los dos. Las dos
-- en null es válido y significativo: es la bandeja de §18.
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_un_solo_dueno_chk"
  CHECK (NOT ("albumId" IS NOT NULL AND "tareaId" IS NOT NULL));

-- Un comentario cuelga de EXACTAMENTE uno de los cuatro (§14). Aquí sí
-- es exactamente uno: un comentario sin dueño no es nada.
ALTER TABLE "comentarios_fotos" ADD CONSTRAINT "comentarios_fotos_un_solo_dueno_chk"
  CHECK (
    (("carpetaId" IS NOT NULL)::int
     + ("tareaId" IS NOT NULL)::int
     + ("albumId" IS NOT NULL)::int
     + ("fotoId" IS NOT NULL)::int) = 1
  );

-- `equipoId` va con `tipo = EQUIPO` y solo con él (§12). Sin este CHECK
-- cabía una carpeta corriente apuntando a un equipo, o una de tipo
-- EQUIPO sin equipo, y las dos rompen la pantalla que las pinta.
ALTER TABLE "carpetas_fotos" ADD CONSTRAINT "carpetas_fotos_equipo_segun_tipo_chk"
  CHECK (("tipo" = 'EQUIPO') = ("equipoId" IS NOT NULL));

-- ─────────────────────────────────────────────────────────────
-- 8. Corrección de drift ajena a este cambio.
--
-- `20260814190000_costos_edicion_post_emision` creó este índice a mano y
-- le puso un nombre más corto del que Prisma deriva de
-- `@@index([requerimientoId, requiereRevision])`. Las columnas y el orden
-- ya son los que el schema declara: lo único que cambia es el NOMBRE del
-- índice, para que `migrate diff` deje de reportar la diferencia en cada
-- migración futura. No toca ninguna tabla, columna ni línea de código de
-- Costos.
-- ─────────────────────────────────────────────────────────────
ALTER INDEX "costos_cotizaciones_proveedor_requiereRevision_idx"
  RENAME TO "costos_cotizaciones_proveedor_requerimientoId_requiereRevis_idx";
