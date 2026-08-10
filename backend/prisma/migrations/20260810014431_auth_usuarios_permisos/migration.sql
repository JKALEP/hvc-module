-- CreateEnum
CREATE TYPE "RolGlobal" AS ENUM ('SUPERADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "Modulo" AS ENUM ('COSTOS', 'PERSONAL_PROYECTOS', 'FOTOS');

-- CreateEnum
CREATE TYPE "NivelFotos" AS ENUM ('ADMIN_FOTOS', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolGlobal" NOT NULL DEFAULT 'ADMIN',
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos_modulo" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "modulo" "Modulo" NOT NULL,
    "nivelFotos" "NivelFotos",
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permisos_modulo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_estado_idx" ON "usuarios"("estado");

-- CreateIndex
CREATE INDEX "permisos_modulo_usuarioId_idx" ON "permisos_modulo"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_modulo_usuarioId_modulo_key" ON "permisos_modulo"("usuarioId", "modulo");

-- AddForeignKey
ALTER TABLE "permisos_modulo" ADD CONSTRAINT "permisos_modulo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
