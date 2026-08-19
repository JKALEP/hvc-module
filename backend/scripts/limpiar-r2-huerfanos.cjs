/**
 * Objetos de R2 que ya no tiene ninguna fila de `fotos`.
 *
 * EN SECO por defecto: lista lo que sobra y no toca nada. Para borrar de
 * verdad hay que pedirlo con `--borrar`, porque un bucket de fotos de obra
 * es registro histórico y un `delete` de más no se deshace.
 *
 * La verdad la tiene la BD, nunca el bucket: se listan los objetos, se
 * leen las claves vivas de `fotos` y sobra lo que no aparece en las dos.
 * Al revés —borrar por prefijo, por fecha o «todo lo de lotes/»— se
 * llevaría por delante lo que sí está referenciado.
 */
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const { Client } = require('pg');
const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');

/** R2 borra de 1000 en 1000 como máximo. */
const LOTE_BORRADO = 1000;

function exigirEntorno() {
  const faltan = [
    'DATABASE_URL',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
  ].filter((v) => !process.env[v]);
  if (faltan.length > 0) {
    console.error(`Faltan variables de entorno: ${faltan.join(', ')}.`);
    process.exit(1);
  }
}

function cliente() {
  return new S3Client({
    region: 'auto',
    endpoint:
      process.env.R2_ENDPOINT ??
      `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/** Todas las claves del bucket, paginando. */
async function clavesEnBucket(s3, bucket) {
  const claves = [];
  let token;
  do {
    const r = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
      }),
    );
    for (const o of r.Contents ?? []) claves.push({ clave: o.Key, bytes: o.Size });
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return claves;
}

/** Las claves que alguna fila de `fotos` sigue referenciando. */
async function clavesVivas(db) {
  const r = await db.query(
    'SELECT "claveImagen", "claveMiniatura" FROM fotos',
  );
  const vivas = new Set();
  for (const f of r.rows) {
    if (f.claveImagen) vivas.add(f.claveImagen);
    if (f.claveMiniatura) vivas.add(f.claveMiniatura);
  }
  return vivas;
}

function formatearBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

(async () => {
  exigirEntorno();
  const borrarDeVerdad = process.argv.includes('--borrar');
  const bucket = process.env.R2_BUCKET;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const s3 = cliente();

  const [enBucket, vivas] = await Promise.all([
    clavesEnBucket(s3, bucket),
    clavesVivas(db),
  ]);

  const huerfanos = enBucket.filter((o) => !vivas.has(o.clave));
  const bytesHuerfanos = huerfanos.reduce((t, o) => t + (o.bytes ?? 0), 0);

  console.log(`Bucket "${bucket}"`);
  console.log(`  objetos en el bucket: ${enBucket.length}`);
  console.log(`  claves referenciadas por la BD: ${vivas.size}`);
  console.log(`  HUÉRFANOS: ${huerfanos.length} (${formatearBytes(bytesHuerfanos)})`);

  if (huerfanos.length === 0) {
    console.log('\nNada que limpiar.');
    await db.end();
    return;
  }

  console.log('');
  for (const o of huerfanos)
    console.log(`  ${o.clave}  (${formatearBytes(o.bytes ?? 0)})`);

  if (!borrarDeVerdad) {
    console.log(
      '\nEn seco: no se ha borrado nada. Para borrarlos, repite con --borrar.',
    );
    await db.end();
    return;
  }

  let borrados = 0;
  for (let i = 0; i < huerfanos.length; i += LOTE_BORRADO) {
    const tanda = huerfanos.slice(i, i + LOTE_BORRADO);
    const r = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: tanda.map((o) => ({ Key: o.clave })) },
      }),
    );
    borrados += (r.Deleted ?? []).length;
    for (const e of r.Errors ?? [])
      console.error(`  ERROR al borrar ${e.Key}: ${e.Message}`);
  }

  console.log(`\nBorrados ${borrados}/${huerfanos.length} objeto(s).`);
  await db.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
