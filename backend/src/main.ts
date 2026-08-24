import 'dotenv/config'; // carga backend/.env en process.env para el runtime
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Los orígenes que pueden llamar a esta API, desde `FRONTEND_URL`.
 *
 * ⚠️ **Sin valor por defecto en el código, y es deliberado.** Antes esto era
 * `process.env.FRONTEND_URL ?? 'http://localhost:5173'`, y ese respaldo hacía
 * daño por dos lados:
 *
 *   · en DESPLIEGUE, olvidar la variable no rompía el arranque: el servidor
 *     subía tan campante autorizando `localhost`, y el frontend real recibía
 *     un CORS que nadie sabía de dónde salía;
 *   · en DESARROLLO escondía el caso contrario —la variable puesta con un
 *     valor viejo—, que es justo lo que pasó: `.env` decía `:5176`, Vite
 *     corría en `:5173`, y el navegador contestaba «has been blocked by CORS
 *     policy» sin que nada en el arranque lo delatara.
 *
 * Ahora falta la variable → el arranque se detiene y dice qué falta.
 *
 * Es una LISTA separada por comas porque en desarrollo Vite salta de puerto
 * cuando el suyo está ocupado (5173 → 5174 → 5175), y un solo origen
 * convierte eso en un fallo incomprensible.
 */
function origenesPermitidos(): string[] {
  const crudo = process.env.FRONTEND_URL?.trim();
  if (!crudo)
    throw new Error(
      'Falta FRONTEND_URL: los orígenes que pueden llamar a esta API (CORS), ' +
        'separados por comas. Ejemplo: ' +
        'FRONTEND_URL="http://localhost:5173,https://app.hvc.com.pe". ' +
        'Ver backend/.env.example.',
    );
  const lista = crudo
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (lista.length === 0)
    throw new Error('FRONTEND_URL está puesta pero vacía.');
  return lista;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origenes = origenesPermitidos();

  // CORS para el frontend (Vite en desarrollo, el dominio real en producción)
  app.enableCors({
    origin: origenes,
    // ⚠️ Sin esto el navegador NO deja leer `Content-Disposition`, aunque
    // llegue: en una respuesta de otro origen solo son legibles seis
    // cabeceras y ésta no está entre ellas.
    //
    // Consecuencia que estuvo escondida desde el principio:
    // `shared/services/descarga.ts` la lee para nombrar el archivo —su
    // comentario dice «el nombre lo decide el servidor»— y el `exec` del
    // regex devolvía null SIEMPRE, así que TODAS las descargas de la app
    // (Costos, Equipos y ahora Fotos) caían al nombre de respaldo del
    // frontend. Nadie lo notó porque el respaldo es razonable y el archivo
    // se baja igual; se vio al comparar el aviso («tareas.xlsx») con la
    // cabecera que el backend estaba mandando de verdad.
    //
    // Es una línea de infraestructura compartida, no un cambio de Costos:
    // ese módulo no se toca y lo único que cambia para él es que sus
    // descargas empiezan a llamarse como su propio código ya decía que
    // debían llamarse (`requerimiento-001-000011.xlsx`).
    exposedHeaders: ['Content-Disposition'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Backend HVC en http://localhost:${port}`);
  // Se imprime al arrancar para que un CORS mal configurado se vea AQUÍ y no
  // en la consola del navegador media hora después.
  console.log(`   CORS permitido para: ${origenes.join(', ')}`);
}
bootstrap();
