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
 * SOLO LECTURA. Comprueba si los datos de Neon admitirían los tres CHECK
 * que le faltan, ANTES de intentar aplicarlos.
 *
 * Neon se montó con `db push`, que aplica el esquema pero IGNORA el SQL de
 * las migraciones — y los tres CHECK de Fotos viven en el SQL a mano de
 * `20260816120000_fotos_v3_permisos_y_estructura`, porque Prisma no sabe
 * declararlos. Los services validan las tres reglas igual, así que en
 * principio nada debería violarlas; el CHECK es el último candado, el que
 * un service no puede saltarse.
 *
 * ⚠️ `ALTER TABLE ... ADD CONSTRAINT` sobre datos que ya no cumplen **falla
 * en seco**, así que esto se corre primero y se lee entero. Este archivo no
 * escribe NADA: ni ALTER, ni UPDATE, ni DELETE. Solo SELECT.
 *
 *     node scripts/revisar-checks-neon.cjs
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * La URL de Neon está COMENTADA en .env (la activa es la local). Se lee de
 * ahí en vez de pedir que se descomente, para no dejar el .env apuntando a
 * la base de producción por olvido — que es exactamente el accidente que
 * esta clase de script tiene que evitar.
 */
/**
 * ⚠️ Se elige por HOST, no por «la primera comentada».
 *
 * En `.env` hay TRES `DATABASE_URL`: la activa (local), una comentada que
 * es una URL con `api_key` —no una conexión de Postgres corriente— y la de
 * Neon. Coger «la primera comentada» agarraba la del medio, y contra una
 * base de otra persona ese error no se puede permitir: el script se conecta
 * SOLO si encuentra exactamente una candidata cuyo host sea de neon.tech, y
 * si hay cero o más de una, se planta.
 */
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
      `Esperaba exactamente UNA #DATABASE_URL de neon.tech en backend/.env, encontré ${candidatas.length}. ` +
        'No me conecto a ciegas a una base que no sé cuál es.',
    );
  return candidatas[0];
}

/** Host y base, sin credenciales: hay que poder decir a qué se conectó. */
function describir(url) {
  const u = new URL(url);
  return `${u.hostname}${u.pathname}`;
}

const CHECKS = [
  {
    nombre: 'fotos_un_solo_dueno_chk',
    tabla: 'fotos',
    regla: 'una foto cuelga de un álbum O de una tarea, nunca de las dos',
    // Las dos en null SÍ vale: es la bandeja de §18.
    violan: `SELECT id, "albumId", "tareaId", "subidaPorId", "creadoEn"
             FROM fotos
             WHERE "albumId" IS NOT NULL AND "tareaId" IS NOT NULL
             LIMIT 20`,
  },
  {
    nombre: 'comentarios_fotos_un_solo_dueno_chk',
    tabla: 'comentarios_fotos',
    regla: 'un comentario cuelga de EXACTAMENTE uno de los cuatro',
    violan: `SELECT id, "carpetaId", "tareaId", "albumId", "fotoId",
                    "autorNombre", "creadoEn"
             FROM comentarios_fotos
             WHERE (("carpetaId" IS NOT NULL)::int
                  + ("tareaId"   IS NOT NULL)::int
                  + ("albumId"   IS NOT NULL)::int
                  + ("fotoId"    IS NOT NULL)::int) <> 1
             LIMIT 20`,
  },
  {
    nombre: 'carpetas_fotos_equipo_segun_tipo_chk',
    tabla: 'carpetas_fotos',
    regla: 'tipo = EQUIPO ⟺ equipoId no nulo',
    violan: `SELECT id, nombre, tipo, "equipoId", "propietarioId", "creadoEn"
             FROM carpetas_fotos
             WHERE (tipo = 'EQUIPO') <> ("equipoId" IS NOT NULL)
             LIMIT 20`,
  },
];

(async () => {
  const url = urlDeNeon();
  const db = new Client({ connectionString: url });
  await db.connect();
  console.log(`Conectado (solo lectura) a: ${describir(url)}\n`);

  // 1 · ¿Hay datos de verdad? Para saber sobre qué estamos hablando.
  const tablas = [
    'usuarios',
    'carpetas_fotos',
    'albumes_fotos',
    'fotos',
    'tareas_fotos',
    'comentarios_fotos',
    'eventos_fotos',
  ];
  console.log('Contenido actual:');
  for (const t of tablas) {
    try {
      const r = await db.query(`SELECT count(*)::int AS n FROM "${t}"`);
      console.log(`  ${t.padEnd(20)} ${String(r.rows[0].n).padStart(6)}`);
    } catch {
      console.log(`  ${t.padEnd(20)}      — (la tabla no existe)`);
    }
  }

  // 2 · ¿Están ya los CHECK?
  const existentes = await db.query(
    `SELECT conname FROM pg_constraint
      WHERE contype = 'c' AND conname = ANY($1::text[])`,
    [CHECKS.map((c) => c.nombre)],
  );
  const puestos = new Set(existentes.rows.map((r) => r.conname));

  console.log('\nEstado de los tres CHECK:');
  for (const c of CHECKS)
    console.log(`  ${puestos.has(c.nombre) ? 'YA ESTÁ' : 'FALTA  '}  ${c.nombre}`);

  // 3 · ¿Alguna fila los violaría?
  console.log('\n¿Los datos actuales admitirían el constraint?');
  let totalMalas = 0;
  for (const c of CHECKS) {
    if (puestos.has(c.nombre)) {
      console.log(`\n  ${c.nombre}: ya está puesto, nada que comprobar.`);
      continue;
    }
    let filas;
    try {
      filas = (await db.query(c.violan)).rows;
    } catch (e) {
      console.log(`\n  ${c.nombre}: NO SE PUDO COMPROBAR — ${e.message}`);
      totalMalas++;
      continue;
    }
    if (filas.length === 0) {
      console.log(`\n  ${c.nombre}`);
      console.log(`     regla: ${c.regla}`);
      console.log('     ✅ 0 filas lo violan — el ALTER pasaría.');
    } else {
      totalMalas += filas.length;
      console.log(`\n  ${c.nombre}`);
      console.log(`     regla: ${c.regla}`);
      console.log(`     ⛔ ${filas.length} fila(s) lo violan (máx. 20 mostradas):`);
      for (const f of filas) console.log('       ', JSON.stringify(f));
    }
  }

  console.log(
    totalMalas === 0
      ? '\nRESULTADO: los datos admiten los tres CHECK.'
      : `\nRESULTADO: hay ${totalMalas} problema(s). NO aplicar nada todavía.`,
  );

  await db.end();
})().catch((e) => {
  console.error('Falló la revisión:', e.message);
  process.exit(1);
});
