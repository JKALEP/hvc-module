/**
 * ⚠️ AVISO (Fase 1a de «Gestión de contenido», 2026-08-23)
 *
 * Este script habla de TRES CHECK. **Hoy el módulo tiene DOS.**
 *
 * `carpetas_fotos_equipo_segun_tipo_chk` se retiró junto con la columna
 * `carpetas_fotos."equipoId"` al deshacer el enlace con Gestión de Equipos
 * (migración `..._fotos_equipo_independiente`).
 *
 * Neon quedó FUERA DE ALCANCE en esa fase por decisión explícita: no se le
 * aplicó la migración, así que ahí la columna y el CHECK **siguen
 * existiendo** y este script sigue diciendo la verdad sobre esa base — por
 * eso no se ha tocado su lógica.
 *
 * ⛔ Pero en cuanto Neon reciba la migración, la entrada de ese CHECK hay
 * que BORRARLA de aquí: aplicarlo entonces crearía una restricción sobre
 * una columna que ya no existe, y fallaría en seco.
 */
/**
 * Aplica a Neon los tres CHECK que le faltan. IDEMPOTENTE.
 *
 * Neon se montó con `db push`, que aplica el esquema pero IGNORA el SQL a
 * mano de las migraciones — y los tres CHECK de Fotos viven ahí, en
 * `20260816120000_fotos_v3_permisos_y_estructura`, porque Prisma no sabe
 * declararlos. Los services validan las tres reglas igual; el CHECK es el
 * último candado, el que un service no puede saltarse.
 *
 * ⚠️ **Esta base tiene datos reales de otra persona.** Por eso:
 *
 *   - No corre sin `--aplicar`. Sin la bandera solo enseña lo que haría.
 *   - Elige la URL por HOST (`*.neon.tech`) y se planta si no encuentra
 *     exactamente una: en `.env` hay tres `DATABASE_URL` y coger «la
 *     primera comentada» agarra la que no es.
 *   - **Vuelve a comprobar las violaciones justo antes de escribir**, no se
 *     fía de una revisión anterior: entre una y otra alguien pudo subir una
 *     foto. Si algo viola, aborta sin tocar nada.
 *   - Lo tres van en UNA transacción: se aplican los tres o ninguno.
 *   - Es idempotente por `IF NOT EXISTS` sobre `pg_constraint`, así que
 *     volver a correrlo no falla ni duplica nada. Postgres no admite
 *     `ADD CONSTRAINT IF NOT EXISTS` para un CHECK, de ahí el bloque `DO`.
 *
 * No borra ni modifica NINGUNA fila. Solo añade tres restricciones.
 *
 *     node scripts/aplicar-checks-neon.cjs             # ensayo, no escribe
 *     node scripts/aplicar-checks-neon.cjs --aplicar   # escribe
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function urlDeNeon() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const candidatas = env
    .split(/\r?\n/)
    .filter((l) => /^\s*#\s*DATABASE_URL\s*=/.test(l))
    .map((l) =>
      l
        .replace(/^\s*#\s*DATABASE_URL\s*=\s*/, '')
        .trim()
        .replace(/^["']|["']$/g, ''),
    )
    .filter((u) => {
      if (!/^postgres(ql)?:\/\//.test(u)) return false;
      try {
        return new URL(u).hostname.endsWith('.neon.tech');
      } catch {
        return false;
      }
    });
  if (candidatas.length !== 1)
    throw new Error(
      `Esperaba exactamente UNA #DATABASE_URL de neon.tech en backend/.env, encontré ${candidatas.length}.`,
    );
  return candidatas[0];
}

const describir = (url) => {
  const u = new URL(url);
  return `${u.hostname}${u.pathname}`;
};

const CHECKS = [
  {
    nombre: 'fotos_un_solo_dueno_chk',
    tabla: 'fotos',
    // Las dos en null SÍ vale: es la bandeja de §18.
    expresion: `NOT ("albumId" IS NOT NULL AND "tareaId" IS NOT NULL)`,
    violan: `SELECT count(*)::int AS n FROM fotos
              WHERE "albumId" IS NOT NULL AND "tareaId" IS NOT NULL`,
  },
  {
    nombre: 'comentarios_fotos_un_solo_dueno_chk',
    tabla: 'comentarios_fotos',
    expresion: `(("carpetaId" IS NOT NULL)::int
               + ("tareaId"   IS NOT NULL)::int
               + ("albumId"   IS NOT NULL)::int
               + ("fotoId"    IS NOT NULL)::int) = 1`,
    violan: `SELECT count(*)::int AS n FROM comentarios_fotos
              WHERE (("carpetaId" IS NOT NULL)::int
                   + ("tareaId"   IS NOT NULL)::int
                   + ("albumId"   IS NOT NULL)::int
                   + ("fotoId"    IS NOT NULL)::int) <> 1`,
  },
  {
    nombre: 'carpetas_fotos_equipo_segun_tipo_chk',
    tabla: 'carpetas_fotos',
    expresion: `(tipo = 'EQUIPO') = ("equipoId" IS NOT NULL)`,
    violan: `SELECT count(*)::int AS n FROM carpetas_fotos
              WHERE (tipo = 'EQUIPO') <> ("equipoId" IS NOT NULL)`,
  },
];

/** El SQL idempotente de un CHECK. */
const sqlDe = (c) => `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '${c.nombre}'
  ) THEN
    ALTER TABLE "${c.tabla}" ADD CONSTRAINT "${c.nombre}"
      CHECK (${c.expresion});
  END IF;
END $$;`;

(async () => {
  const aplicar = process.argv.includes('--aplicar');
  const url = urlDeNeon();

  console.log(`Base: ${describir(url)}`);
  console.log(aplicar ? 'MODO: APLICAR (escribe)\n' : 'MODO: ensayo (no escribe)\n');

  console.log('SQL que se ejecutaría:\n');
  for (const c of CHECKS) console.log(sqlDe(c) + '\n');

  const db = new Client({ connectionString: url });
  await db.connect();

  // 1 · Volver a comprobar, ahora mismo, contra los datos de ahora mismo.
  console.log('Comprobando los datos actuales…');
  let malas = 0;
  for (const c of CHECKS) {
    const yaEsta = (
      await db.query(
        `SELECT 1 FROM pg_constraint WHERE conname = $1`,
        [c.nombre],
      )
    ).rowCount;
    if (yaEsta) {
      console.log(`  ${c.nombre}: ya estaba puesto.`);
      continue;
    }
    const n = (await db.query(c.violan)).rows[0].n;
    console.log(`  ${c.nombre}: ${n} fila(s) lo violan.`);
    malas += n;
  }

  if (malas > 0) {
    console.error(
      `\nABORTADO: ${malas} fila(s) violan alguna regla. No se escribe nada.\n` +
        'Corre `node scripts/revisar-checks-neon.cjs` para ver cuáles son.',
    );
    await db.end();
    process.exit(1);
  }

  if (!aplicar) {
    console.log(
      '\nEnsayo terminado. Los datos admiten los tres CHECK.\n' +
        'Para aplicarlos de verdad: node scripts/aplicar-checks-neon.cjs --aplicar',
    );
    await db.end();
    return;
  }

  // 2 · Los tres, o ninguno.
  try {
    await db.query('BEGIN');
    for (const c of CHECKS) await db.query(sqlDe(c));
    await db.query('COMMIT');
    console.log('\nAplicado.');
  } catch (e) {
    await db.query('ROLLBACK');
    console.error('\nFALLÓ, se deshizo todo:', e.message);
    await db.end();
    process.exit(1);
  }

  // 3 · Confirmar sobre la base, no sobre la fe.
  const puestos = await db.query(
    `SELECT conname FROM pg_constraint
      WHERE contype = 'c' AND conname = ANY($1::text[]) ORDER BY conname`,
    [CHECKS.map((c) => c.nombre)],
  );
  console.log('\nCHECK presentes ahora en Neon:');
  for (const r of puestos.rows) console.log('  ✅', r.conname);
  if (puestos.rowCount !== CHECKS.length)
    console.error(`  ⛔ Esperaba ${CHECKS.length} y hay ${puestos.rowCount}.`);

  await db.end();
})().catch((e) => {
  console.error('Falló:', e.message);
  process.exit(1);
});
