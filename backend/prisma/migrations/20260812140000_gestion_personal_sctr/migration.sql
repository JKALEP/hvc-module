-- Gestión de personal — listas SCTR.
--
-- Escrita a mano, como las anteriores. Aquí no había riesgo de pérdida
-- de datos (todo es CREATE), pero sí de que la automática tocara algo
-- que no debe: `trabajadores`, `supervisores`, `empresas_contratistas`,
-- `nomina_mensual`, `participaciones` y `reportes_diarios` quedan
-- EXACTAMENTE como estaban. Lo único que cambia de lo existente son dos
-- relaciones inversas en `usuarios`, que en Prisma no crean columna ni
-- tocan la tabla: la clave foránea vive en el lado de las nuevas.
--
-- Verificar después de aplicar:
--   SELECT count(*) FROM trabajadores;      -- sin cambios
--   SELECT count(*) FROM participaciones;   -- sin cambios

-- ── 1. Tipos ────────────────────────────────────────────────────────
CREATE TYPE "TipoPersonal" AS ENUM ('SUPERVISOR', 'CONTRATISTA');

CREATE TYPE "CampoPersonal" AS ENUM (
  'TIPO_TRABAJADOR',
  'PAIS_NACIMIENTO',
  'TIPO_DOCUMENTO',
  'SEXO',
  'MONEDA',
  'ESTADO_CIVIL',
  'SEDE'
);

-- ── 2. Periodo: año + mes + tipo ────────────────────────────────────
CREATE TABLE "periodos_personal" (
  "id"            SERIAL         NOT NULL,
  "anio"          INTEGER        NOT NULL,
  "mes"           INTEGER        NOT NULL,
  "tipo"          "TipoPersonal" NOT NULL,
  -- Hex sin almohadilla. El importador no asume un color fijo: en los
  -- archivos reales OPERATIVO viene FFC000 y SUPERVISORES 3B7D23.
  "colorGrupo"    TEXT           NOT NULL DEFAULT 'FFC000',
  "creadoPorId"   INTEGER,
  "creadoEn"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3)   NOT NULL,

  CONSTRAINT "periodos_personal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "periodos_personal_anio_mes_tipo_key"
  ON "periodos_personal"("anio", "mes", "tipo");
CREATE INDEX "periodos_personal_tipo_anio_mes_idx"
  ON "periodos_personal"("tipo", "anio", "mes");
CREATE INDEX "periodos_personal_creadoPorId_idx"
  ON "periodos_personal"("creadoPorId");

-- ── 3. Grupo: Área o Empresa Contratista ────────────────────────────
-- `nombre` es texto libre del Excel, NO una FK a empresas_contratistas:
-- atarlo obligaría a crear empresas reales al importar.
CREATE TABLE "grupos_personal" (
  "id"            SERIAL       NOT NULL,
  "periodoId"     INTEGER      NOT NULL,
  "nombre"        TEXT         NOT NULL,
  "orden"         INTEGER      NOT NULL DEFAULT 0,
  "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "grupos_personal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grupos_personal_periodoId_nombre_key"
  ON "grupos_personal"("periodoId", "nombre");
CREATE INDEX "grupos_personal_periodoId_idx"
  ON "grupos_personal"("periodoId");

-- ── 4. Ficha: una persona en la lista de un mes ─────────────────────
-- `numeroDocumento` es TEXT y no numérico: 136 de 573 filas de los
-- archivos reales vienen como número de Excel, y guardarlas así
-- perdería los ceros a la izquierda (003017132 pasaría a 3017132).
CREATE TABLE "fichas_personal" (
  "id"               SERIAL        NOT NULL,
  "periodoId"        INTEGER       NOT NULL,
  "grupoId"          INTEGER       NOT NULL,
  "orden"            INTEGER       NOT NULL DEFAULT 0,

  "nombres"          TEXT          NOT NULL,
  "apellidoPaterno"  TEXT          NOT NULL,
  "apellidoMaterno"  TEXT          NOT NULL,
  "tipoTrabajador"   TEXT          NOT NULL,
  "paisNacimiento"   TEXT          NOT NULL,
  "tipoDocumento"    TEXT          NOT NULL,
  "numeroDocumento"  TEXT          NOT NULL,
  "sexo"             TEXT          NOT NULL,
  "fechaNacimiento"  DATE          NOT NULL,
  "moneda"           TEXT          NOT NULL,
  "remuneracion"     DECIMAL(12,2) NOT NULL,
  "estadoCivil"      TEXT          NOT NULL,
  "sede"             TEXT          NOT NULL,

  "creadoEn"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"    TIMESTAMP(3)  NOT NULL,
  "actualizadoPorId" INTEGER,

  CONSTRAINT "fichas_personal_pkey" PRIMARY KEY ("id")
);

-- El control que hace fiable una lista de fiscalización: el documento no
-- se repite dentro del mismo periodo. `periodoId` está duplicado en la
-- tabla justamente para poder exigirlo aquí.
CREATE UNIQUE INDEX "fichas_personal_periodoId_numeroDocumento_key"
  ON "fichas_personal"("periodoId", "numeroDocumento");
CREATE INDEX "fichas_personal_grupoId_idx"
  ON "fichas_personal"("grupoId");
CREATE INDEX "fichas_personal_periodoId_idx"
  ON "fichas_personal"("periodoId");
CREATE INDEX "fichas_personal_apellidoPaterno_idx"
  ON "fichas_personal"("apellidoPaterno");
CREATE INDEX "fichas_personal_actualizadoPorId_idx"
  ON "fichas_personal"("actualizadoPorId");

-- ── 5. Catálogo de los selectores ───────────────────────────────────
-- Sugerencias, no restricción: las fichas guardan texto libre, así que
-- un valor que no esté aquí entra igual y a partir de ahí se ofrece.
CREATE TABLE "opciones_personal" (
  "id"       SERIAL          NOT NULL,
  "campo"    "CampoPersonal" NOT NULL,
  "valor"    TEXT            NOT NULL,
  "orden"    INTEGER         NOT NULL DEFAULT 0,
  "creadoEn" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "opciones_personal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "opciones_personal_campo_valor_key"
  ON "opciones_personal"("campo", "valor");
CREATE INDEX "opciones_personal_campo_idx"
  ON "opciones_personal"("campo");

-- ── 6. Claves foráneas ──────────────────────────────────────────────
-- Cascade hacia abajo: borrar un periodo se lleva sus grupos y fichas,
-- que es lo que significa "este mes no va". SetNull en la auditoría:
-- dar de baja a un usuario no puede borrar la lista que dejó firmada.
ALTER TABLE "periodos_personal"
  ADD CONSTRAINT "periodos_personal_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "grupos_personal"
  ADD CONSTRAINT "grupos_personal_periodoId_fkey"
  FOREIGN KEY ("periodoId") REFERENCES "periodos_personal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fichas_personal"
  ADD CONSTRAINT "fichas_personal_periodoId_fkey"
  FOREIGN KEY ("periodoId") REFERENCES "periodos_personal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fichas_personal"
  ADD CONSTRAINT "fichas_personal_grupoId_fkey"
  FOREIGN KEY ("grupoId") REFERENCES "grupos_personal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fichas_personal"
  ADD CONSTRAINT "fichas_personal_actualizadoPorId_fkey"
  FOREIGN KEY ("actualizadoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 7. Semillas del catálogo ────────────────────────────────────────
-- Los valores que ya aparecen en los archivos reales de HVC. Son
-- sugerencias iniciales; se añaden y quitan desde la pantalla.
INSERT INTO "opciones_personal" ("campo", "valor", "orden") VALUES
  ('TIPO_TRABAJADOR', 'RIESGO MEDIO', 1),
  ('TIPO_TRABAJADOR', 'RIESGO ALTO',  2),
  ('PAIS_NACIMIENTO', 'PERU',         1),
  ('PAIS_NACIMIENTO', 'VENEZOLANO',   2),
  ('TIPO_DOCUMENTO',  'DNI',          1),
  ('TIPO_DOCUMENTO',  'CE',           2),
  ('SEXO',            'M',            1),
  ('SEXO',            'F',            2),
  ('MONEDA',          'S/.',          1),
  ('ESTADO_CIVIL',    'SOLTERO',      1),
  ('ESTADO_CIVIL',    'CASADO',       2),
  ('SEDE',            'PRINCIPAL',    1);
