/**
 * Se planta si la base que resuelve el PROCESO no es la local.
 *
 * ⚠️ Existe porque este error ya se cometió DOS veces en el proyecto, y la
 * segunda fue con la comprobación puesta: se imprimía el host y se encadenaba
 * el `migrate deploy` con `&&`, así que la orden corría igual. Mirar no es
 * comprobar — comprobar es negarse a seguir.
 *
 * Le pregunta a `process.env`, nunca al fichero: en `.env` ha llegado a haber
 * tres `DATABASE_URL` y dotenv se queda con la última sin avisar de nada.
 *
 * Para correr algo contra una base remota a propósito, `--produccion`. Es un
 * gesto explícito, que es justo lo que faltaba.
 */
require('dotenv').config({ quiet: true });

const LOCALES = ['localhost', '127.0.0.1', '::1'];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('\n⛔ No hay DATABASE_URL. Revisa el .env.\n');
  process.exit(1);
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error(`\n⛔ DATABASE_URL no es una URL válida.\n`);
  process.exit(1);
}

if (LOCALES.includes(host)) process.exit(0);

if (process.argv.includes('--produccion')) {
  console.warn(`\n⚠️  Ejecutando contra ${host} — base REMOTA, a propósito.\n`);
  process.exit(0);
}

console.error(
  `\n⛔ La base que resuelve el proceso es "${host}", no la local.\n` +
    '   Esta orden escribe, así que no se ejecuta.\n\n' +
    '   · Para trabajar: deja activa la DATABASE_URL de localhost en .env.\n' +
    '   · Para ir a la remota a propósito: añade --produccion.\n',
);
process.exit(1);
