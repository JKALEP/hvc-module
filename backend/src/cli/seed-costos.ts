/**
 * Siembra los maestros mínimos del módulo Costos para poder probar el
 * flujo: los tres catálogos de §58, un cliente, un supervisor y dos
 * proveedores.
 *
 *   npm run seed:costos
 *
 * Es IDEMPOTENTE: se puede correr las veces que haga falta. Usa `upsert`
 * contra las claves únicas de cada tabla, así que no duplica nada y no
 * pisa lo que ya hayas editado a mano salvo el propio valor sembrado.
 *
 * Los datos son de ejemplo y están pensados para desarrollo. Las
 * unidades y los tipos de mantenimiento sí son los reales de HVC; el
 * cliente, el supervisor y los proveedores son inventados y hay que
 * reemplazarlos por los de verdad desde la pantalla de administración
 * (Fase 7) o con la API.
 *
 * NO siembra usuarios: para eso está `seed:superadmin`. Y no escribe en
 * la bitácora `costos_eventos` a propósito — la auditoría registra lo
 * que hace una PERSONA, y un script de arranque no es nadie.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import type { TipoCatalogo } from '../../generated/prisma/enums';

/** Los tres catálogos de §58, con el orden en que deben salir. */
const CATALOGOS: { tipo: TipoCatalogo; valores: string[] }[] = [
  {
    tipo: 'TIPO_MANTENIMIENTO',
    valores: ['Preventivo', 'Correctivo', 'Predictivo', 'Instalación'],
  },
  {
    tipo: 'TIPO_REQUERIMIENTO',
    valores: ['Emergencia', 'Programado', 'Stock', 'Proyecto'],
  },
  {
    // Las del formato de HVC. `RequerimientoItem.unidad` guarda TEXTO,
    // así que esto alimenta el selector pero no restringe lo que se
    // puede escribir.
    tipo: 'UNIDAD_MEDIDA',
    valores: [
      'UND',
      'MT',
      'M2',
      'KG',
      'GLN',
      'LT',
      'JGO',
      'CJA',
      'ROLLO',
      'PZA',
    ],
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('\nFalta DATABASE_URL en backend/.env.\n');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  // ── Catálogos ──
  let opciones = 0;
  for (const { tipo, valores } of CATALOGOS) {
    for (const [i, valor] of valores.entries()) {
      await prisma.opcionCatalogo.upsert({
        where: { tipo_valor: { tipo, valor } },
        create: { tipo, valor, orden: i, estado: 'ACTIVO' },
        // Solo se reordena: si alguien lo desactivó, se respeta.
        update: { orden: i },
      });
      opciones++;
    }
  }

  // ── Cliente ──
  const cliente = await prisma.clienteCostos.upsert({
    where: { nombre: 'Cliente de prueba S.A.C.' },
    create: {
      nombre: 'Cliente de prueba S.A.C.',
      ruc: '20100070970',
      contacto: 'Área de Mantenimiento',
      correo: 'mantenimiento@clientedeprueba.com',
      telefono: '01 555 0100',
      direccion: 'Av. Siempre Viva 123, Lima',
    },
    update: {},
    select: { id: true, nombre: true, ruc: true },
  });

  // ── Supervisor ──
  const supervisor = await prisma.supervisor.upsert({
    where: { documento: '00000001' },
    create: {
      nombre: 'Supervisor de prueba',
      documento: '00000001',
      cargo: 'Supervisor de mantenimiento',
      correo: 'supervisor@hvc.com.pe',
      telefono: '999 000 001',
    },
    update: {},
    select: { id: true, nombre: true, documento: true },
  });

  // ── Proveedores ──
  // Dos y no uno: comparar cotizaciones (§37) necesita al menos dos.
  const proveedores: { id: number; razonSocial: string; ruc: string | null }[] =
    [];
  for (const p of [
    {
      ruc: '20512345671',
      razonSocial: 'Ferretería Industrial del Sur S.A.C.',
      nombreComercial: 'Ferrisur',
      correo: 'ventas@ferrisur.com.pe',
      telefono: '01 555 0201',
      direccion: 'Av. Argentina 1500, Callao',
    },
    {
      ruc: '20598765432',
      razonSocial: 'Suministros HVAC Perú E.I.R.L.',
      nombreComercial: 'HVAC Perú',
      correo: 'cotizaciones@hvacperu.com.pe',
      telefono: '01 555 0202',
      direccion: 'Jr. Paruro 800, Lima',
    },
  ]) {
    proveedores.push(
      await prisma.proveedor.upsert({
        where: { ruc: p.ruc },
        create: p,
        update: {},
        select: { id: true, razonSocial: true, ruc: true },
      }),
    );
  }

  console.log(`\nCatálogos: ${opciones} opción(es) en 3 catálogos.\n`);
  console.log('Cliente:');
  console.table([cliente]);
  console.log('Supervisor:');
  console.table([supervisor]);
  console.log('Proveedores:');
  console.table(proveedores);
  console.log(
    'Listo. Con esto ya se puede emitir un requerimiento en cuanto exista\n' +
      'la Fase 3b.\n',
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Falló la semilla de Costos:', e);
  process.exit(1);
});
