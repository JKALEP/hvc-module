/**
 * Siembra (o actualiza) la cuenta SuperAdmin.
 *
 * Las credenciales salen SIEMPRE de variables de entorno: nunca se
 * escriben en el código ni quedan en el historial de git.
 *
 *   SUPERADMIN_EMAIL=...  SUPERADMIN_PASSWORD=...  npm run seed:superadmin
 *
 * Es idempotente: si la cuenta ya existe le actualiza nombre y contraseña
 * en vez de fallar, así sirve también para recuperar el acceso.
 */
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

const RONDAS_BCRYPT = 10;
const LARGO_MINIMO = 8;

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = (process.env.SUPERADMIN_PASSWORD ?? '').trim();
  const nombre = (process.env.SUPERADMIN_NOMBRE ?? 'SuperAdmin').trim();

  if (!email || !password) {
    console.error(
      '\nFaltan variables de entorno.\n\n' +
        'Define en backend/.env antes de correr esto:\n' +
        '  SUPERADMIN_EMAIL=tu-correo@dominio.com\n' +
        '  SUPERADMIN_PASSWORD=una-contraseña-larga\n' +
        '  SUPERADMIN_NOMBRE=Tu Nombre        (opcional)\n',
    );
    process.exit(1);
  }
  if (password.length < LARGO_MINIMO) {
    console.error(
      `\nSUPERADMIN_PASSWORD debe tener al menos ${LARGO_MINIMO} caracteres.\n`,
    );
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error(
      '\nFalta JWT_SECRET en backend/.env. Sin él el backend no puede firmar tokens.\n' +
        'Genera uno largo y aleatorio, por ejemplo:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"\n",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);

  // El SuperAdmin no lleva filas en PermisoModulo: entra a todo por su rol.
  const usuario = await prisma.usuario.upsert({
    where: { email },
    create: {
      email,
      nombre,
      passwordHash,
      rol: 'SUPERADMIN',
      estado: 'ACTIVO',
    },
    update: { nombre, passwordHash, rol: 'SUPERADMIN', estado: 'ACTIVO' },
    select: { id: true, email: true, nombre: true, rol: true },
  });

  console.log('\nSuperAdmin listo:');
  console.table([usuario]);
  console.log('Ya puedes iniciar sesión en el frontend.\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Falló la semilla:', e);
  process.exit(1);
});
