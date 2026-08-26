require('dotenv').config({
  path: require('node:path').join(__dirname, '..', '.env'),
});

const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');

const LOTE_BORRADO = 1000;

function exigirEntorno() {
  const faltan = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
  ].filter((v) => !process.env[v]);

  if (faltan.length > 0) {
    console.error(`Faltan variables de entorno: ${faltan.join(', ')}`);
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

async function listarObjetos(s3, bucket) {
  const objetos = [];
  let token;

  do {
    const respuesta = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
      }),
    );

    for (const objeto of respuesta.Contents ?? []) {
      if (objeto.Key) {
        objetos.push({
          Key: objeto.Key,
          Size: objeto.Size ?? 0,
        });
      }
    }

    token = respuesta.IsTruncated
      ? respuesta.NextContinuationToken
      : undefined;
  } while (token);

  return objetos;
}

function formatearBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function borrarObjetos(s3, bucket, objetos) {
  let borrados = 0;

  for (let i = 0; i < objetos.length; i += LOTE_BORRADO) {
    const lote = objetos.slice(i, i + LOTE_BORRADO);

    const respuesta = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: lote.map((objeto) => ({
            Key: objeto.Key,
          })),
          Quiet: false,
        },
      }),
    );

    const cantidadBorrada = (respuesta.Deleted ?? []).length;
    borrados += cantidadBorrada;

    console.log(
      `Lote ${Math.floor(i / LOTE_BORRADO) + 1}: ` +
        `${cantidadBorrada}/${lote.length} objetos eliminados`,
    );

    for (const error of respuesta.Errors ?? []) {
      console.error(
        `ERROR: ${error.Key} - ${error.Code ?? ''} ${error.Message ?? ''}`,
      );
    }
  }

  return borrados;
}

async function main() {
  exigirEntorno();

  const bucket = process.env.R2_BUCKET;
  const s3 = cliente();

  console.log('\n========================================');
  console.log('      VACIADO COMPLETO DE R2');
  console.log('========================================\n');

  console.log(`Bucket: ${bucket}`);
  console.log('Acción: eliminar TODOS los objetos');
  console.log('El bucket NO será eliminado.\n');

  const objetos = await listarObjetos(s3, bucket);

  const totalBytes = objetos.reduce(
    (total, objeto) => total + objeto.Size,
    0,
  );

  console.log(`Objetos encontrados: ${objetos.length}`);
  console.log(`Espacio ocupado: ${formatearBytes(totalBytes)}\n`);

  if (objetos.length === 0) {
    console.log('El bucket ya está vacío.');
    return;
  }

  console.log('Primeros objetos encontrados:');

  for (const objeto of objetos.slice(0, 20)) {
    console.log(
      `  ${objeto.Key} (${formatearBytes(objeto.Size)})`,
    );
  }

  if (objetos.length > 20) {
    console.log(`  ... y ${objetos.length - 20} objeto(s) más.`);
  }

  console.log('\nIniciando eliminación...\n');

  const borrados = await borrarObjetos(
    s3,
    bucket,
    objetos,
  );

  console.log('\n========================================');
  console.log('RESULTADO');
  console.log('========================================');
  console.log(`Encontrados: ${objetos.length}`);
  console.log(`Eliminados:  ${borrados}`);

  if (borrados === objetos.length) {
    console.log('\nR2 quedó completamente vacío.');
    console.log(`Bucket "${bucket}" CONSERVADO.`);
  } else {
    console.log(
      '\nATENCIÓN: algunos objetos no pudieron eliminarse.',
    );
  }
}

main().catch((error) => {
  console.error('\nFalló el vaciado de R2:');
  console.error(error);
  process.exit(1);
});