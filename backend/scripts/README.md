# scripts/

Herramientas de verificación y mantenimiento que se ejecutan **contra un
entorno vivo**: hablan con la API por HTTP y con Postgres por SQL, y no
importan nada de `src/`.

Viven aquí y no en `src/cli/` a propósito. `src/cli/` es código de la
aplicación —importa Nest y Prisma, y `nest build` lo compila a
`dist/src/cli/`—; esto son comprobaciones de caja negra que no deben
entrar en el bundle del servidor. Por eso son `.cjs` planos: se corren con
`node` sin compilar, y siguen funcionando aunque el build esté roto, que
es justo cuando hacen falta.

| Script | Para qué | Comando |
|---|---|---|
| `verificar-fotos.cjs` | Comprueba el módulo Fotos contra la API y la BD reales, fase por fase. Necesita el backend levantado. | `npm run verificar:fotos` |
| `limpiar-r2-huerfanos.cjs` | Busca objetos en R2 que ya no tiene ninguna fila de `fotos`. **En seco por defecto.** | `npm run r2:huerfanos` / `npm run r2:huerfanos -- --borrar` |

Los dos leen `backend/.env`.

## Por qué existe `limpiar-r2-huerfanos`

`AlmacenamientoService.borrar()` no propaga sus fallos: si R2 no responde,
lo importante —que la fila desaparezca de la BD— ya ocurrió, y hacer
fallar el borrado lógico por un archivo perdido sería peor. A cambio, deja
el aviso en el log y el objeto en el bucket. Este script es la otra mitad
de ese trato.

También hace falta tras una migración que vacíe tablas de fotos: el SQL no
habla con el object storage.
