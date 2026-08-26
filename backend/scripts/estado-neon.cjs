/** Diagnóstico de Neon. SOLO LECTURA — no escribe nada. */
require('dotenv').config({ path: __dirname + '/../.env', quiet: true });
const { Client } = require('pg');
const url = process.env.DATABASE_URL;
if (!new URL(url).hostname.endsWith('.neon.tech')) {
  console.error('Esta URL no es de Neon. Abortado.');
  process.exit(1);
}
(async () => {
  const db = new Client({ connectionString: url });
  await db.connect();
  const q = async (s, p) => (await db.query(s, p)).rows;
  console.log('HOST:', new URL(url).hostname);

  console.log('\n── Migraciones aplicadas HOY ──');
  for (const m of await q(
    `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations
      WHERE finished_at > now() - interval '2 hours' OR rolled_back_at IS NOT NULL
      ORDER BY started_at`,
  ))
    console.log(`  ${m.rolled_back_at ? 'REVERTIDA' : 'aplicada '}  ${m.migration_name}`);

  console.log('\n── Datos ──');
  for (const [etq, sql] of [
    ['usuarios', 'SELECT count(*)::int c FROM usuarios'],
    ['carpetas', 'SELECT count(*)::int c FROM carpetas_fotos'],
    ['  equipos', "SELECT count(*)::int c FROM carpetas_fotos WHERE tipo='EQUIPO'"],
    ['ciclos', 'SELECT count(*)::int c FROM ciclos_fotos'],
    ['actividades', 'SELECT count(*)::int c FROM actividades_fotos'],
    ['FOTOS (total)', 'SELECT count(*)::int c FROM fotos'],
    ['  en ciclo', 'SELECT count(*)::int c FROM fotos WHERE "cicloId" IS NOT NULL'],
    ['  en actividad', 'SELECT count(*)::int c FROM fotos WHERE "actividadId" IS NOT NULL'],
    ['  en BANDEJA', 'SELECT count(*)::int c FROM fotos WHERE "cicloId" IS NULL AND "actividadId" IS NULL'],
    ['albumes (histórico)', 'SELECT count(*)::int c FROM albumes_fotos'],
    ['comentarios', 'SELECT count(*)::int c FROM comentarios_fotos'],
    ['  sobre álbum', 'SELECT count(*)::int c FROM comentarios_fotos WHERE "albumId" IS NOT NULL'],
    ['observaciones', 'SELECT count(*)::int c FROM observaciones_fotos'],
  ]) {
    const r = await q(sql).catch((e) => [{ c: 'ERROR: ' + e.message.slice(0, 40) }]);
    console.log(`  ${String(r[0].c).padStart(6)}  ${etq}`);
  }
  await db.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
