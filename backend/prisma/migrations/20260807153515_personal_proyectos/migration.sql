-- CreateEnum
CREATE TYPE "EstadoEmpresaContratista" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoTrabajador" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoSupervisor" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('EN_EJECUCION', 'FINALIZADO', 'PAUSADO');

-- CreateTable
CREATE TABLE "empresas_contratistas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "estado" "EstadoEmpresaContratista" NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_contratistas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trabajadores" (
    "id" SERIAL NOT NULL,
    "dni" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "estado" "EstadoTrabajador" NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trabajadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisores" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "EstadoSupervisor" NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supervisores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "cliente" TEXT,
    "ubicacion" TEXT,
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'EN_EJECUCION',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avances_semanales" (
    "id" SERIAL NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "semana" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "observacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avances_semanales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes_diarios" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "equiposProgramados" INTEGER NOT NULL,
    "equiposEjecutados" INTEGER NOT NULL,
    "tecnicosProgramados" INTEGER NOT NULL,
    "produccion" DECIMAL(5,2),
    "tecnicosLaborando" INTEGER NOT NULL DEFAULT 0,
    "calificacionPersonal" DECIMAL(5,2),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reportes_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participaciones" (
    "id" SERIAL NOT NULL,
    "reporteId" INTEGER NOT NULL,
    "trabajadorId" INTEGER NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_contratistas_ruc_key" ON "empresas_contratistas"("ruc");

-- CreateIndex
CREATE INDEX "empresas_contratistas_nombre_idx" ON "empresas_contratistas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "trabajadores_dni_key" ON "trabajadores"("dni");

-- CreateIndex
CREATE INDEX "trabajadores_empresaId_idx" ON "trabajadores"("empresaId");

-- CreateIndex
CREATE INDEX "trabajadores_apellidos_idx" ON "trabajadores"("apellidos");

-- CreateIndex
CREATE INDEX "proyectos_estado_idx" ON "proyectos"("estado");

-- CreateIndex
CREATE INDEX "avances_semanales_proyectoId_fecha_idx" ON "avances_semanales"("proyectoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "avances_semanales_proyectoId_anio_semana_key" ON "avances_semanales"("proyectoId", "anio", "semana");

-- CreateIndex
CREATE INDEX "reportes_diarios_fecha_idx" ON "reportes_diarios"("fecha");

-- CreateIndex
CREATE INDEX "reportes_diarios_supervisorId_idx" ON "reportes_diarios"("supervisorId");

-- CreateIndex
CREATE UNIQUE INDEX "reportes_diarios_proyectoId_fecha_key" ON "reportes_diarios"("proyectoId", "fecha");

-- CreateIndex
CREATE INDEX "participaciones_trabajadorId_fecha_idx" ON "participaciones"("trabajadorId", "fecha");

-- CreateIndex
CREATE INDEX "participaciones_empresaId_fecha_idx" ON "participaciones"("empresaId", "fecha");

-- CreateIndex
CREATE INDEX "participaciones_proyectoId_fecha_idx" ON "participaciones"("proyectoId", "fecha");

-- CreateIndex
CREATE INDEX "participaciones_fecha_idx" ON "participaciones"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "participaciones_reporteId_trabajadorId_key" ON "participaciones"("reporteId", "trabajadorId");

-- AddForeignKey
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas_contratistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances_semanales" ADD CONSTRAINT "avances_semanales_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_diarios" ADD CONSTRAINT "reportes_diarios_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_diarios" ADD CONSTRAINT "reportes_diarios_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones" ADD CONSTRAINT "participaciones_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "reportes_diarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones" ADD CONSTRAINT "participaciones_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "trabajadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones" ADD CONSTRAINT "participaciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas_contratistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones" ADD CONSTRAINT "participaciones_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
