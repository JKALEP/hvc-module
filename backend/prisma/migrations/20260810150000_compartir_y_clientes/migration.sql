-- Compartir unificado (carpetas y álbumes) + clientes externos.
--
-- Escrita a mano: la migración automática TIRABA `accesos_album`, que no
-- está vacía. Aquí la tabla nueva se crea primero, se copian las filas y
-- solo entonces se borra la vieja.

-- CreateEnum
CREATE TYPE "EstadoInvitacion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'CANCELADA');

-- AlterEnum
-- No se usa el valor nuevo en esta misma migración, así que puede ir en
-- la misma transacción sin que Postgres proteste.
ALTER TYPE "RolGlobal" ADD VALUE 'CLIENTE';

-- CreateTable
CREATE TABLE "accesos_compartidos" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "sedeId" INTEGER,
    "albumId" INTEGER,
    "otorgadoPorId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accesos_compartidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitaciones_cliente" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "sedeId" INTEGER,
    "albumId" INTEGER,
    "invitadoPorId" INTEGER NOT NULL,
    "estado" "EstadoInvitacion" NOT NULL DEFAULT 'PENDIENTE',
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceptadaEn" TIMESTAMP(3),
    "clienteId" INTEGER,

    CONSTRAINT "invitaciones_cliente_pkey" PRIMARY KEY ("id")
);

-- ── Traspaso de datos ────────────────────────────────────────────────
-- Cada acceso a un álbum pasa tal cual: sedeId queda NULL.
INSERT INTO "accesos_compartidos" ("usuarioId", "albumId", "otorgadoPorId", "creadoEn")
SELECT "usuarioId", "albumId", "otorgadoPorId", "creadoEn" FROM "accesos_album";

-- DropForeignKey
ALTER TABLE "accesos_album" DROP CONSTRAINT "accesos_album_albumId_fkey";
ALTER TABLE "accesos_album" DROP CONSTRAINT "accesos_album_otorgadoPorId_fkey";
ALTER TABLE "accesos_album" DROP CONSTRAINT "accesos_album_usuarioId_fkey";

-- DropTable
DROP TABLE "accesos_album";

-- CreateIndex
CREATE INDEX "accesos_compartidos_usuarioId_idx" ON "accesos_compartidos"("usuarioId");
CREATE UNIQUE INDEX "accesos_compartidos_usuarioId_sedeId_key" ON "accesos_compartidos"("usuarioId", "sedeId");
CREATE UNIQUE INDEX "accesos_compartidos_usuarioId_albumId_key" ON "accesos_compartidos"("usuarioId", "albumId");
CREATE UNIQUE INDEX "invitaciones_cliente_tokenHash_key" ON "invitaciones_cliente"("tokenHash");
CREATE INDEX "invitaciones_cliente_email_estado_idx" ON "invitaciones_cliente"("email", "estado");

-- AddForeignKey
ALTER TABLE "accesos_compartidos" ADD CONSTRAINT "accesos_compartidos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accesos_compartidos" ADD CONSTRAINT "accesos_compartidos_otorgadoPorId_fkey" FOREIGN KEY ("otorgadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accesos_compartidos" ADD CONSTRAINT "accesos_compartidos_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accesos_compartidos" ADD CONSTRAINT "accesos_compartidos_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "albumes_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitaciones_cliente" ADD CONSTRAINT "invitaciones_cliente_invitadoPorId_fkey" FOREIGN KEY ("invitadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invitaciones_cliente" ADD CONSTRAINT "invitaciones_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invitaciones_cliente" ADD CONSTRAINT "invitaciones_cliente_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitaciones_cliente" ADD CONSTRAINT "invitaciones_cliente_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "albumes_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
