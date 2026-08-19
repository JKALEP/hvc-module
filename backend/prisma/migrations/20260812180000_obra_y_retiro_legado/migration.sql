-- Reconstrucción del módulo de obra y retiro del modelo anterior.
--
-- ⚠ ESTA MIGRACIÓN BORRA DATOS. Es deliberado y está aprobado.
--
-- Antes de ejecutarla se volcaron las 8 tablas afectadas a
-- `backend/archivo/20260812-personal-legado.sql` (176 INSERTs), con el
-- avance verificado de CHOCAVENTO (89.85 %) y WAYRA I (84.85 %)
-- documentado en su cabecera. Ese archivo es la única copia.
--
-- QUÉ CAMBIA
--
-- El registro de obra deja de tener tablas propias de personas y
-- empresas: ahora sale de las listas SCTR (grupos_personal /
-- fichas_personal), y de cada día solo se guarda quién participó, con
-- su nombre y su empresa CONGELADOS en la fila.
--
-- `proyectos` se rehace en vez de alterarse: gana ocho columnas
-- obligatorias (sede, fechas, total de equipos, encargado, supervisor)
-- para las que las dos filas existentes no tienen ningún valor posible.
-- Rellenarlas con inventos habría sido peor que retirarlas.
--
-- QUÉ NO SE TOCA
--
-- gestión de personal (periodos_personal, grupos_personal,
-- fichas_personal, opciones_personal), fotos, costos, auth y usuarios
-- quedan exactamente igual.
--
-- Verificar después de aplicar:
--   SELECT count(*) FROM fichas_personal;   -- sin cambios
--   SELECT count(*) FROM usuarios;          -- sin cambios

-- ── 1. Tablas nuevas ────────────────────────────────────────────────
-- Se crean primero para que nada dependa del orden de los borrados.

CREATE TABLE "carpetas" (
  "id"            SERIAL       NOT NULL,
  "nombre"        TEXT         NOT NULL,
  "parentId"      INTEGER,
  -- Ruta materializada, misma convención que sedes.ruta.
  "ruta"          TEXT         NOT NULL,
  "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "carpetas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "carpetas_parentId_nombre_key" ON "carpetas"("parentId", "nombre");
CREATE INDEX "carpetas_parentId_idx" ON "carpetas"("parentId");
CREATE INDEX "carpetas_ruta_idx"     ON "carpetas"("ruta");

ALTER TABLE "carpetas"
  ADD CONSTRAINT "carpetas_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "carpetas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 2. proyectos se rehace ──────────────────────────────────────────
-- CASCADE se lleva las FK entrantes de reportes_diarios,
-- participaciones y ajustes_avance, que se retiran igualmente abajo.

DROP TABLE "proyectos" CASCADE;

CREATE TABLE "proyectos" (
  "id"                  SERIAL       NOT NULL,
  "nombre"              TEXT         NOT NULL,
  -- NULL = vive en la raíz del explorador. Un proyecto no necesita carpeta.
  "carpetaId"           INTEGER,
  -- Lugar físico de la obra; no confundir con la carpeta.
  "sede"                TEXT         NOT NULL,
  "fechaInicio"         DATE         NOT NULL,
  -- Prevista, no límite: se pueden registrar jornadas más allá.
  "fechaFinPrevista"    DATE         NOT NULL,
  -- Denominador del avance acumulado.
  "totalEquipos"        INTEGER      NOT NULL,

  -- Asignaciones fijas, con snapshot del nombre. La vigencia contra el
  -- periodo de personal actual se deriva en lectura, no se guarda.
  "encargadoGrupoId"    INTEGER      NOT NULL,
  "encargadoNombre"     TEXT         NOT NULL,
  "supervisorFichaId"   INTEGER      NOT NULL,
  "supervisorNombre"    TEXT         NOT NULL,
  "supervisorDocumento" TEXT         NOT NULL,
  "apoyoFichaId"        INTEGER,
  "apoyoNombre"         TEXT,
  "apoyoDocumento"      TEXT,

  "creadoPorId"         INTEGER,
  "creadoEn"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proyectos_carpetaId_idx"         ON "proyectos"("carpetaId");
CREATE INDEX "proyectos_nombre_idx"            ON "proyectos"("nombre");
CREATE INDEX "proyectos_encargadoGrupoId_idx"  ON "proyectos"("encargadoGrupoId");
CREATE INDEX "proyectos_supervisorFichaId_idx" ON "proyectos"("supervisorFichaId");

-- ── 3. Jornadas ─────────────────────────────────────────────────────

CREATE TABLE "jornadas" (
  "id"                      SERIAL       NOT NULL,
  "proyectoId"              INTEGER      NOT NULL,
  "fecha"                   DATE         NOT NULL,
  "equiposEjecutados"       INTEGER      NOT NULL,
  "equiposProgramados"      INTEGER      NOT NULL,
  -- Manual: el sistema no mantiene lista de esperados, así que no puede
  -- deducir este número ni saber quién faltó.
  "contratistasProgramados" INTEGER      NOT NULL,
  -- Supervisor y apoyo DEL DÍA, con snapshot del nombre.
  "supervisorFichaId"       INTEGER,
  "supervisorNombre"        TEXT,
  "apoyoFichaId"            INTEGER,
  "apoyoNombre"             TEXT,
  "creadoPorId"             INTEGER,
  "creadoEn"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "jornadas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jornadas_proyectoId_fecha_key" ON "jornadas"("proyectoId", "fecha");
CREATE INDEX "jornadas_proyectoId_fecha_idx"        ON "jornadas"("proyectoId", "fecha");

CREATE TABLE "asistencias_jornada" (
  "id"              SERIAL       NOT NULL,
  "jornadaId"       INTEGER      NOT NULL,
  -- Navegación, no identidad: lo que se muestra es el snapshot.
  "fichaPersonalId" INTEGER,
  "nombreCompleto"  TEXT         NOT NULL,
  "documento"       TEXT         NOT NULL,
  "grupoNombre"     TEXT         NOT NULL,
  "creadoEn"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "asistencias_jornada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asistencias_jornada_jornadaId_documento_key"
  ON "asistencias_jornada"("jornadaId", "documento");
CREATE INDEX "asistencias_jornada_jornadaId_idx"       ON "asistencias_jornada"("jornadaId");
CREATE INDEX "asistencias_jornada_fichaPersonalId_idx" ON "asistencias_jornada"("fichaPersonalId");

-- ── 4. Retiro del legado ────────────────────────────────────────────
-- Ya volcado. El orden respeta las dependencias entre ellas.

DROP TABLE IF EXISTS "ajustes_avance"  CASCADE;
DROP TABLE IF EXISTS "participaciones" CASCADE;
DROP TABLE IF EXISTS "reportes_diarios" CASCADE;
DROP TABLE IF EXISTS "nomina_mensual"  CASCADE;
DROP TABLE IF EXISTS "trabajadores"    CASCADE;
DROP TABLE IF EXISTS "supervisores"    CASCADE;
DROP TABLE IF EXISTS "empresas_contratistas" CASCADE;

-- ── 5. Enums huérfanos ──────────────────────────────────────────────
-- EstadoProyecto se va con el resto: los tres estados que quedan
-- (INICIO / EN_PROCESO / FINALIZADO) son función pura del avance y se
-- derivan en lectura. PAUSADO desaparece como concepto.

DROP TYPE IF EXISTS "EstadoProyecto";
DROP TYPE IF EXISTS "EstadoTrabajador";
DROP TYPE IF EXISTS "EstadoSupervisor";
DROP TYPE IF EXISTS "EstadoEmpresaContratista";

-- ── 6. Claves foráneas de las tablas nuevas ─────────────────────────
-- Restrict en encargado y supervisor: son obligatorios, así que borrar
-- su grupo o su ficha dejaría el proyecto sin un dato que no admite
-- nulo. SetNull en todo lo opcional y en la navegación.

ALTER TABLE "proyectos"
  ADD CONSTRAINT "proyectos_carpetaId_fkey"
  FOREIGN KEY ("carpetaId") REFERENCES "carpetas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proyectos"
  ADD CONSTRAINT "proyectos_encargadoGrupoId_fkey"
  FOREIGN KEY ("encargadoGrupoId") REFERENCES "grupos_personal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proyectos"
  ADD CONSTRAINT "proyectos_supervisorFichaId_fkey"
  FOREIGN KEY ("supervisorFichaId") REFERENCES "fichas_personal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proyectos"
  ADD CONSTRAINT "proyectos_apoyoFichaId_fkey"
  FOREIGN KEY ("apoyoFichaId") REFERENCES "fichas_personal"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proyectos"
  ADD CONSTRAINT "proyectos_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "jornadas"
  ADD CONSTRAINT "jornadas_proyectoId_fkey"
  FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "jornadas"
  ADD CONSTRAINT "jornadas_supervisorFichaId_fkey"
  FOREIGN KEY ("supervisorFichaId") REFERENCES "fichas_personal"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "jornadas"
  ADD CONSTRAINT "jornadas_apoyoFichaId_fkey"
  FOREIGN KEY ("apoyoFichaId") REFERENCES "fichas_personal"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "jornadas"
  ADD CONSTRAINT "jornadas_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asistencias_jornada"
  ADD CONSTRAINT "asistencias_jornada_jornadaId_fkey"
  FOREIGN KEY ("jornadaId") REFERENCES "jornadas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asistencias_jornada"
  ADD CONSTRAINT "asistencias_jornada_fichaPersonalId_fkey"
  FOREIGN KEY ("fichaPersonalId") REFERENCES "fichas_personal"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
