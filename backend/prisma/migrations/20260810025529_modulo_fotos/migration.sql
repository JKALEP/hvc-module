-- CreateEnum
CREATE TYPE "EstadoSede" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "EstadoAlbum" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateTable
CREATE TABLE "sedes" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "parentId" INTEGER,
    "ruta" TEXT NOT NULL,
    "estado" "EstadoSede" NOT NULL DEFAULT 'ACTIVA',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albumes_fotos" (
    "id" SERIAL NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoAlbum" NOT NULL DEFAULT 'ABIERTO',
    "creadoPorId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "albumes_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accesos_album" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "otorgadoPorId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accesos_album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "descripcion" TEXT,
    "subidaPorId" INTEGER NOT NULL,
    "claveImagen" TEXT NOT NULL,
    "claveMiniatura" TEXT NOT NULL,
    "anchoPx" INTEGER NOT NULL,
    "altoPx" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "bytesOriginal" INTEGER NOT NULL,
    "formato" TEXT NOT NULL,
    "tomadaEn" DATE,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sedes_parentId_idx" ON "sedes"("parentId");

-- CreateIndex
CREATE INDEX "sedes_ruta_idx" ON "sedes"("ruta");

-- CreateIndex
CREATE UNIQUE INDEX "sedes_parentId_nombre_key" ON "sedes"("parentId", "nombre");

-- CreateIndex
CREATE INDEX "albumes_fotos_sedeId_idx" ON "albumes_fotos"("sedeId");

-- CreateIndex
CREATE UNIQUE INDEX "albumes_fotos_sedeId_nombre_key" ON "albumes_fotos"("sedeId", "nombre");

-- CreateIndex
CREATE INDEX "accesos_album_usuarioId_idx" ON "accesos_album"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "accesos_album_albumId_usuarioId_key" ON "accesos_album"("albumId", "usuarioId");

-- CreateIndex
CREATE INDEX "fotos_albumId_creadoEn_idx" ON "fotos"("albumId", "creadoEn");

-- CreateIndex
CREATE INDEX "fotos_subidaPorId_idx" ON "fotos"("subidaPorId");

-- AddForeignKey
ALTER TABLE "sedes" ADD CONSTRAINT "sedes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albumes_fotos" ADD CONSTRAINT "albumes_fotos_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albumes_fotos" ADD CONSTRAINT "albumes_fotos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos_album" ADD CONSTRAINT "accesos_album_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "albumes_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos_album" ADD CONSTRAINT "accesos_album_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos_album" ADD CONSTRAINT "accesos_album_otorgadoPorId_fkey" FOREIGN KEY ("otorgadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "albumes_fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_subidaPorId_fkey" FOREIGN KEY ("subidaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
