# Auditoría del módulo Fotos — estado actual del código

> **Alcance y método.** Todo lo que sigue está leído del árbol de trabajo el
> **2026-08-25**, no de documentación ni de memoria. Cada afirmación cita
> archivo y, cuando aporta, línea o función. Donde algo **no existe**, se dice
> explícitamente y se indica qué se buscó para concluirlo.
>
> **Equivalencia de nombres.** Lo que el diseño conceptual llama
> «Actividades» está implementado como **Tareas** (`TareaFotos`,
> `tarea.service.ts`, `PanelTareas.tsx`). Se tratan como el mismo concepto.
>
> **Stack verificado.** Backend NestJS (`backend/src/fotos/`, 27 archivos,
> ~9 069 líneas), frontend React + Vite (`frontend/src/modules/fotos/`,
> 49 archivos), Prisma sobre PostgreSQL, Cloudflare R2 vía
> `@aws-sdk/client-s3` (`almacenamiento.service.ts`).

---

## 1. Jerarquía de navegación actual

### 1.1 No existe la jerarquía fija del diseño conceptual

El ejemplo del enunciado —*Cliente → Proyecto → Sede → Pabellón → Piso →
Carpeta → Equipo*— **no está implementado como niveles**. En el código hay
**una sola tabla autorreferenciada** con **dos tipos** y **profundidad
ilimitada**:

```prisma
// backend/prisma/schema.prisma:265
enum TipoCarpetaFotos {
  CARPETA
  EQUIPO
}

// backend/prisma/schema.prisma:272
model CarpetaFotos {
  id       Int    @id @default(autoincrement())
  nombre   String
  parentId Int?          // auto-relación: árbol libre
  ruta     String        // ruta materializada "1/4/9"
  tipo     TipoCarpetaFotos @default(CARPETA)
  ...
  @@map("carpetas_fotos")
}
```

No hay tablas `Cliente`, `Sede`, `Pabellon` ni `Piso` en el módulo. Se
verificó listando todos los modelos del schema (`grep "^model"`): los únicos
del módulo Fotos son los de la sección 4.

Lo que en el diseño son niveles, aquí son **carpetas anidadas que el usuario
nombra libremente**. «Proyecto A / Frente 1 / Equipo ABC» es una convención de
nombres, no una restricción del modelo.

### 1.2 Nombres reales, base de datos ↔ frontend

| Concepto | Tabla (BD) | Modelo Prisma | Tipo TS frontend | Componente |
|---|---|---|---|---|
| Carpeta / Equipo | `carpetas_fotos` | `CarpetaFotos` | `CarpetaListada`, `ContenidoCarpeta` | `TarjetaCarpeta.tsx` |
| Álbum | `albumes_fotos` | `AlbumFotos` | `AlbumDeGaleria` | `GaleriaAlbumes.tsx` |
| Tarea (Actividad) | `tareas_fotos` | `TareaFotos` | `Tarea` | `PanelTareas.tsx` |
| Fotografía | `fotos` | `Foto` | `FotoDeAlbum` | `GaleriaAlbumes.tsx` |
| Comentario | `comentarios_fotos` | `ComentarioFotos` | `Comentario` | `HiloComentarios.tsx` |
| Campo configurable del equipo | `definiciones_campo_fotos` | `DefinicionCampoFotos` | `CampoEquipo` | `CamposDeEquipo.tsx` |
| Valor de campo | `valores_campo_fotos` | `ValorCampoFotos` | `CampoDeCarpeta` | `ControlDeCampo.tsx` |
| Acceso compartido | `accesos_compartidos` | `AccesoCompartido` | `ListaCompartidos` | `AccesosDeCarpeta.tsx` |
| Invitación externa | `invitaciones_cliente` | `InvitacionCliente` | `InvitacionAbierta` | `EnlaceInvitacion.tsx` |
| Plantilla de estructura | `plantillas_estructura_fotos` | `PlantillaEstructura` | `Plantilla` | `AdminFotos.tsx` |
| Bitácora | `eventos_fotos` | `EventoFotos` | `EventoFotos` | `AdminFotos.tsx` |

### 1.3 La única regla jerárquica real, y dónde vive

`EQUIPO` es **solo un marcador**: cambia el icono y habilita las tareas. La
restricción implementada en **backend** es una sola:

- **Tareas solo dentro de una carpeta `EQUIPO`** —
  `tarea.service.ts` (`crear`, ~línea 299) consulta el `tipo` y lanza
  `BadRequestException` si no es `EQUIPO`.

El **frontend impone una regla adicional más estricta** que el backend no
tiene (ver §9.1): en `pages/Fotos.tsx:76-80`,

> «REGLA DE JERARQUÍA: una Carpeta pura (`tipo === 'CARPETA'`) solo puede
> contener más carpetas o equipos — nunca álbumes ni comentarios.»

Y en consecuencia toda la ficha se monta con
`sedeId !== null && data && esEquipo && !buscando` (`Fotos.tsx:302`).

### 1.4 Secciones de la raíz

`navegacion.service.ts` devuelve `secciones: SeccionCarpetas[]`, no una lista
plana. Quién ve qué:

| Usuario | Secciones en la raíz |
|---|---|
| Con nivel global (`LECTURA_GLOBAL`/`EDITOR_GLOBAL`/`ADMIN_GLOBAL`) | Una: «Todas las carpetas» |
| Supervisor sin nivel global | «Mis carpetas» + «Compartido conmigo» |
| Cliente externo (portal) | Una: «Compartido conmigo» |
| Buscando (`?q=`) | Una: «Resultados de …» |

---

## 2. Inventario de pantallas

Rutas declaradas en `frontend/src/App.tsx:118-135` y `:58-59`.

### 2.1 Explorador de carpetas — `/fotos`, `/fotos/carpeta/:id`, `/fotos/mias`, `/fotos/compartidas`

**Archivo:** `frontend/src/modules/fotos/pages/Fotos.tsx` (497 líneas)

Es **una sola pantalla** para los cuatro paths; `seccion` filtra por `clave`
la misma respuesta del servidor.

**Qué se muestra:**
- Migas de pan (`RutaSedes.tsx`) con los ancestros.
- Bloque «Carpetas» (`PanelFotos`): título = nombre de la carpeta actual,
  subtítulo `«N carpeta(s) / equipo(s)»`, buscador, selector de orden, y la
  rejilla de tarjetas agrupada por sección (`EtiquetaSeccion`).
- Aviso de rama archivada (`AvisoArchivada.tsx`) si `data.ramaCerrada`.
- **Solo si la carpeta actual es de tipo `EQUIPO`**: la ficha, en grid de dos
  columnas — `CamposDeEquipo` a la izquierda, `HiloComentarios` de la carpeta
  siempre visible a la derecha (máx. `26rem` con scroll propio) — y debajo,
  a todo el ancho, `PestanasFicha`.

**Botones (texto exacto → acción):**

| Texto | Origen | Acción |
|---|---|---|
| «Nueva carpeta» | `AccionesDeCarpeta.tsx:38` | Abre `DialogoNombre` → `crear.mutate({nombre, parentId})` |
| «Añadir equipo» | `AccionesDeCarpeta.tsx:47` | Abre `FormularioEquipo` → `crear.mutate({..., tipo:'EQUIPO', valores})`. Solo si `carpetaId !== null` |
| «Compartir» | `AccionesDeCarpeta.tsx:56` | Abre `DialogoCompartir` |
| «Salir de la búsqueda» | `Fotos.tsx:202` | `setTexto('')` |
| «Nuevo álbum» | `Fotos.tsx:337` | `setAlbumEnEdicion(null)` → `DialogoAlbum` en modo alta |
| «Importar Excel» | `CrearEstructura.tsx` | Abre `DialogoImportar` |
| «Crear desde plantilla» (select + botón) | `CrearEstructura.tsx` | `useAplicarPlantilla` |

Menú por tarjeta (`TarjetaCarpeta.tsx`, iconos con `aria-label`): renombrar
(`PencilIcon`), compartir (`Share2Icon`), archivar (`ArchiveIcon`), eliminar
(`Trash2Icon`). Se calculan en `Fotos.tsx:128-133`:

```ts
renombrar: alcanza(c.permiso, 'EDICION') && !c.cerrada,
compartir: alcanza(c.permiso, 'TOTAL'),
archivar:  admin,
eliminar:  alcanza(c.permiso, 'TOTAL') && !c.cerrada,
```

### 2.2 Pestañas de la ficha del equipo

**Archivo:** `components/PestanasFicha.tsx` (60 líneas). Tres pestañas con
`role="tablist"`: **«Álbumes»**, **«Fotos»**, **«Tareas»**. Arranca en
`albumes`. Comentarios **ya no** es pestaña (se sacó al panel lateral).

- **Álbumes** → `GrillaDeAlbumes` (`GaleriaAlbumes.tsx`), + `CrearEstructura`
  y «Nuevo álbum» si `puedeEscribir`. Abrir un álbum monta
  `DetalleAlbumDialog`.
- **Fotos** → `PanelSubida` (si `puedeEscribir`) + `FiltrosDeGaleria` +
  `GaleriaFotosPlanas` (todas las fotos de la carpeta, sin agrupar por álbum).
- **Tareas** → `PanelTareas`.

### 2.3 Ficha del equipo (campos configurables)

**Archivo:** `components/CamposDeEquipo.tsx` (209 líneas)

Modo lectura: `<dl>` con cada campo y su valor; un campo desactivado que
conserva valor se rotula «(retirado)». Botón **«Editar»** (`:137`) pasa a modo
formulario con `ControlDeCampo` por campo, y **«Cancelar»** / **«Guardar»**
(`:173`, `:177`). La imagen de un campo tipo `FOTO` se sube al vuelo, sin
esperar a «Guardar».

### 2.4 Panel de tareas

**Archivo:** `components/PanelTareas.tsx` (408 líneas)

Lista de tareas; cada fila (`FilaTarea`) trae casilla de completado, título,
`Badge` de estado (`Pendiente` / `En proceso` / `Completada`) y de prioridad
(`BAJA`/`MEDIA`/`ALTA` → `secondary`/`outline`/`warning`), y al desplegar:
`FotosDeTarea` + `HiloComentarios` de la tarea.

Botones: **«Añadir»** (`:196`, alta rápida solo con título),
**«Con detalle…»** (abre `DialogoTarea` completo), lápiz (editar), papelera
(eliminar), y `BotonesExportar` («Excel» / «PDF»).

### 2.5 Captura rápida — `/fotos/captura`

**Archivo:** `pages/CapturaRapida.tsx` (345 líneas)

Tres bloques: **«1 · A dónde van»** (selects Proyecto / Estructura o equipo /
Tarea), **«2 · Las fotos»** (selector de archivos con `capture="environment"`
+ descripción del lote), y **«Fotos pendientes de organizar»** (la bandeja).

Botones: **«Guardar»**, **«Subir sin asignar»**, **«Clasificar N aquí»** y un
campo «Nombre del álbum (opcional)» que solo aparece cuando el destino es una
carpeta.

### 2.6 Recientes — `/fotos/recientes`

**Archivo:** `pages/Recientes.tsx` (69 líneas). Lista de lo actualizado más
recientemente (`GET /fotos/recientes`). Sin acciones propias.

### 2.7 Administración de Fotos — `/fotos/admin`

**Archivo:** `pages/AdminFotos.tsx` (748 líneas). Tres pestañas
(`:93-95`): **«Campos de equipo»**, **«Plantillas»**, **«Auditoría»**.

- *Campos de equipo* incluye además `ColoresDelExplorador` (`:135`): dos
  selects, «Carpeta normal» y «Carpeta de equipo», con muestra en vivo del
  icono. Debajo, alta de campo (nombre + tipo + opciones si es LISTA) con
  botón **«Añadir»**, y por campo: **«Retirar»/«Reactivar»** y papelera (solo
  si `_count.valores === 0`).
- *Plantillas*: alta con nodos (`TIPOS_NODO` = Tarea / Álbum / Carpeta).
- *Auditoría*: tabla de `EventoFotos` con filtros y `BotonesExportar`.

### 2.8 Portal del cliente externo — `/portal`, `/portal/carpeta/:id`

**Archivo:** `pages/Portal.tsx` (240 líneas). Monta `RutaSedes`,
`TarjetaCarpeta` (sin acciones), `PanelTareas` con `portal`,
`HiloComentarios` con `portal`, filtros y `GaleriaFotosPlanas`. **Todo en
modo lectura**: la prop `portal` fuerza `puedeEscribir = false`.

### 2.9 Pantalla pública de invitación

`backend/src/fotos/invitacion.controller.ts` está `@Publico()`. En el
frontend la consume `modules/auth/pages/Invitacion.tsx` (fuera del módulo
Fotos).

---

## 3. Inventario de acciones y endpoints

Todas las rutas salen de los `@Controller`/`@Get`/`@Post`… reales. Los
controladores de Fotos llevan `@RequiereModulo(Modulo.FOTOS)` a nivel de
clase, salvo `PortalController` (`@PermiteCliente()`) e
`InvitacionController` (`@Publico()`).

### 3.1 Carpetas y equipos — `carpeta.controller.ts`

| Acción | Método y ruta | Servicio | Recibe / guarda |
|---|---|---|---|
| Listar raíz o buscar | `GET /fotos/carpeta?q&orden` | `NavegacionService.contenido` | — / lectura |
| Abrir carpeta | `GET /fotos/carpeta/:id` | `NavegacionService.contenido` | — / lectura |
| Recientes | `GET /fotos/recientes` | `NavegacionService.recientes` | — / lectura |
| Crear carpeta o equipo | `POST /fotos/carpeta` | `CarpetaService.crear` | `{nombre, parentId, tipo?, valores?}` → fila en `carpetas_fotos` + `ruta` + `ValorCampoFotos` en la misma transacción |
| Renombrar / mover | `PATCH /fotos/carpeta/:id` | `CarpetaService.editar` | `{nombre?, parentId?}` → renombra y/o reprefija `ruta` de la descendencia |
| Archivar | `POST /fotos/carpeta/:id/archivar` | `CarpetaService.archivar` | → `cerrada = true` |
| Reabrir | `POST /fotos/carpeta/:id/reabrir` | `CarpetaService.archivar` | → `cerrada = false` |
| Eliminar | `DELETE /fotos/carpeta/:id` | `CarpetaService.eliminar` | Solo vacía; retira antes los objetos R2 de campos FOTO |
| Ver campos del equipo | `GET /fotos/carpeta/:id/campo` | `ValorCampoFotosService.deCarpeta` | → definiciones + valores + URLs firmadas |
| Guardar campos | `PUT /fotos/carpeta/:id/campo` | `ValorCampoFotosService.guardar` | `{valores:{clave:valor}}`, **parcial** (`null` vacía) |
| Subir imagen de campo | `POST /fotos/carpeta/:id/campo/:campoId/imagen` | `ValorCampoFotosService.subirImagen` | multipart `foto` → `claveImagen`/`claveMiniatura` |
| Quitar imagen de campo | `DELETE /fotos/carpeta/:id/campo/:campoId/imagen` | `ValorCampoFotosService.quitarImagen` | → borra fila y objetos R2 |

### 3.2 Álbumes y fotos — `album.controller.ts`

| Acción | Método y ruta | Servicio | Recibe / guarda |
|---|---|---|---|
| Galería paginada | `GET /fotos/carpeta/:id/album?cursor&desde&hasta&subidaPorId` | `AlbumService.galeria` | → álbumes con sus fotos y URLs firmadas |
| Autores (filtro) | `GET /fotos/carpeta/:id/autores` | `AlbumService.autores` | → id + nombre |
| Subir a carpeta | `POST /fotos/carpeta/:id/album` | `AlbumService.subir` | multipart `fotos[]` + `descripcion` → crea álbum y filas `Foto` |
| Crear álbum vacío | `POST /fotos/album/carpeta/:id` | `AlbumService.crearAlbum` | `{nombre, descripcion?, fecha?}`; **nombre obligatorio por esta puerta** |
| Editar álbum | `PATCH /fotos/album/:id` | `AlbumService.editarAlbum` | `{nombre?, descripcion?, fecha?}` |
| Eliminar álbum | `DELETE /fotos/album/:id` | `AlbumService.eliminarAlbum` | Solo vacío; con fotos → 400 diciendo cuántas |
| Subir a álbum existente | `POST /fotos/album/:id/foto` | `AlbumService.subir` | multipart `fotos[]` |
| Subir a tarea | `POST /fotos/tarea/:id/foto` | `AlbumService.subir` | multipart `fotos[]` → `Foto.tareaId` |
| Subir sin asignar | `POST /fotos/bandeja` | `AlbumService.subir` | → `albumId` y `tareaId` en `null` |
| Ver bandeja | `GET /fotos/bandeja` | `AlbumService.bandeja` | Solo `subidaPorId = usuario` |
| Clasificar lote | `POST /fotos/bandeja/clasificar` | `AlbumService.clasificar` | `{fotoIds[], carpetaId\|albumId\|tareaId, nombre?, descripcion?}` |
| Descargar foto | `GET /fotos/foto/:fotoId/descarga` | `AlbumService.urlDeDescarga` | → URL firmada `attachment` |
| Editar descripción | `PATCH /fotos/foto/:fotoId` | `AlbumService.editarDescripcion` | `{descripcion}` + evento con valor anterior |
| Mover foto | `POST /fotos/foto/:fotoId/mover` | `AlbumService.mover` | `{carpetaId\|albumId\|tareaId\|bandeja:true}` |
| Eliminar foto | `DELETE /fotos/foto/:fotoId` | `AlbumService.eliminar` | Borra fila + los 2 objetos R2 |

### 3.3 Tareas y comentarios — `tarea.controller.ts`

| Acción | Método y ruta | Servicio | Recibe / guarda |
|---|---|---|---|
| Listar tareas | `GET /fotos/carpeta/:id/tarea?estado` | `TareaService.listar` | → tareas de la carpeta |
| Crear tarea | `POST /fotos/carpeta/:id/tarea` | `TareaService.crear` | `{titulo, descripcion?, estado?, prioridad?, fecha?, responsableId?}` |
| Detalle | `GET /fotos/tarea/:id` | `TareaService.detalle` | — |
| Editar | `PATCH /fotos/tarea/:id` | `TareaService.editar` | Campos sueltos + evento de edición |
| Completar | `POST /fotos/tarea/:id/completar` | `TareaService.completar` | → `estado`, `completadaEn`, `completadaPorId` |
| Reabrir | `POST /fotos/tarea/:id/reabrir` | `TareaService.completar` | → las tres columnas a `null`/`PENDIENTE` |
| Eliminar | `DELETE /fotos/tarea/:id` | `TareaService.eliminar` | Rechaza con 400 si tiene fotos |
| Fotos de la tarea | `GET /fotos/tarea/:id/foto` | `TareaService.fotosDe` | Sin paginar |
| Asignables | `GET /fotos/tarea-asignables` | `TareaService.asignables` | Solo id + nombre de cuentas activas con módulo FOTOS |
| Listar comentarios | `GET /fotos/comentario/:entidad/:id` | `ComentarioService.listar` | `entidad` ∈ carpeta/tarea/album/foto |
| Comentar | `POST /fotos/comentario/:entidad/:id` | `ComentarioService.crear` | `{texto}` + `autorNombre` snapshot |
| Editar comentario | `PATCH /fotos/comentario/:id` | `ComentarioService.editar` | Solo el autor; escribe `editadoEn` |
| Eliminar comentario | `DELETE /fotos/comentario/:id` | `ComentarioService.eliminar` | Propio con EDICION, ajeno con TOTAL |

### 3.4 Compartir — `compartir.controller.ts` (`@Controller('fotos/compartir')`)

| Acción | Método y ruta | Servicio |
|---|---|---|
| Carpetas ofrecibles | `GET /fotos/compartir/carpetas` | `carpetasQuePuedeCompartir` |
| Colaboradores | `GET /fotos/compartir/carpeta/:id` | `listar` |
| Compartir | `POST /fotos/compartir` | `compartir` — `{email, carpetaIds[], permiso, expiraEn?}` |
| Cambiar grado | `PATCH /fotos/compartir/carpeta/:id/acceso/:usuarioId` | `cambiarGrado` (única puerta para `SIN_ACCESO`) |
| Revocar | `DELETE /fotos/compartir/carpeta/:id/acceso/:usuarioId` | `quitar` |
| Reenviar invitación | `POST /fotos/compartir/invitacion/:invitacionId/reenviar` | `reenviar` |
| Cancelar invitación | `DELETE /fotos/compartir/invitacion/:invitacionId` | `cancelar` |

### 3.5 Administración — `administracion.controller.ts`

| Acción | Método y ruta | Mínimo |
|---|---|---|
| Bitácora del módulo | `GET /fotos/auditoria` | `ADMIN_GLOBAL` |
| Bitácora de una carpeta | `GET /fotos/auditoria/carpeta/:id` | `LECTURA` sobre esa carpeta |
| Leer colores | `GET /fotos/configuracion/color` | Cualquiera con el módulo |
| Cambiar color | `PATCH /fotos/configuracion/color` | `ADMIN_GLOBAL` |
| Listar campos | `GET /fotos/campo?activos` | Cualquiera con el módulo |
| Crear / editar / borrar campo | `POST`,`PATCH /fotos/campo/:id`,`DELETE /fotos/campo/:id` | `ADMIN_GLOBAL` |
| Opciones de LISTA | `POST /fotos/campo/:id/opcion`, `DELETE /fotos/campo/opcion/:opcionId` | `ADMIN_GLOBAL` |
| Plantillas (CRUD) | `GET/POST/PATCH/DELETE /fotos/plantilla[/:id]` | `ADMIN_GLOBAL` |
| Aplicar plantilla | `POST /fotos/plantilla/:id/aplicar/:carpetaId` | `EDICION` en destino |
| Importar Excel | `POST /fotos/importacion/carpeta/:id/previa` y `/confirmar` | `EDICION` en destino |

### 3.6 Exportaciones — `exportacion.controller.ts`

`GET /fotos/carpeta/:id/tarea/exportar`, `GET /fotos/auditoria/exportar`,
`GET /fotos/auditoria/carpeta/:id/exportar` (`?formato=excel|pdf`).

### 3.7 Portal (solo lectura) — `portal.controller.ts`

`GET /portal/carpeta`, `/portal/carpeta/:id`, `/portal/carpeta/:id/album`,
`/portal/foto/:fotoId/descarga`, `/portal/carpeta/:id/tarea`,
`/portal/tarea/:id/foto`, `/portal/comentario/:entidad/:id`.
**No hay ni una ruta de escritura** (verificado: no existe ningún
`@Post`/`@Patch`/`@Delete` en el archivo).

### 3.8 Invitación pública — `invitacion.controller.ts`

`GET /invitacion/:token` (validar), `POST /invitacion/:token/activar`.

---

## 4. Modelo de datos actual

### 4.1 `CarpetaFotos` → `carpetas_fotos` (`schema.prisma:272`)

| Campo | Tipo | Nota |
|---|---|---|
| `id` | Int PK | |
| `nombre` | String | |
| `parentId` | Int? | FK a sí misma, `onDelete: Restrict` |
| `ruta` | String | Ruta materializada `"1/4/9"`; resuelve permisos y archivado |
| `tipo` | `TipoCarpetaFotos` | `CARPETA` \| `EQUIPO` |
| `propietarioId` | Int | FK `Usuario`, `Restrict` |
| `cerrada` | Boolean | Archivado, se hereda por `ruta` |
| `creadoEn`, `actualizadoEn` | DateTime | |

Relaciones: `hijas`, `albumes`, `tareas`, `accesos`, `invitaciones`,
`comentarios`, `eventos`, `valoresCampo`.
`@@unique([parentId, nombre])`.

### 4.2 `AlbumFotos` → `albumes_fotos` (`:525`)

`id`, `carpetaId` (FK `Restrict`), `nombre` **String?**, `descripcion`
**String?**, `fecha` `DateTime? @db.Date`, `creadoPorId`, timestamps.

### 4.3 `TareaFotos` → `tareas_fotos` (`:573`)

| Campo | Tipo |
|---|---|
| `carpetaId` | Int, FK `Restrict` |
| `titulo` | String |
| `descripcion` | String? |
| **`estado`** | **`EstadoTareaFotos` = `PENDIENTE` \| `EN_PROCESO` \| `COMPLETADA`** |
| `prioridad` | `PrioridadTareaFotos?` = `BAJA`\|`MEDIA`\|`ALTA` |
| `fecha` | `DateTime? @db.Date` |
| `responsableId` | Int? `SetNull` |
| `creadoPorId` | Int `Restrict` |
| `completadaEn` / `completadaPorId` | DateTime? / Int? |

Relaciones: `fotos: Foto[]`, `comentarios: ComentarioFotos[]`.

### 4.4 `Foto` → `fotos` (`:708`)

`id`, **`albumId` Int?**, **`tareaId` Int?**, `subidaPorId`,
`nombreOriginal?`, `descripcion?`, `claveImagen`, `claveMiniatura`,
`anchoPx`, `altoPx`, `bytes`, `bytesOriginal`, `formato` (`"webp"`),
`tomadaEn` `DateTime? @db.Date`, `creadoEn`.

**No tiene `carpetaId`**: la carpeta se deduce del álbum o de la tarea. Los
tres estados posibles son: colgada de álbum, de tarea, o de **ninguno** (la
bandeja). Un CHECK de la migración (`fotos_un_solo_dueno_chk`) impide que
cuelgue de los dos a la vez.

### 4.5 `ComentarioFotos` → `comentarios_fotos` (`:762`)

`carpetaId?`, `tareaId?`, `albumId?`, `fotoId?` (exactamente uno, CHECK
`comentarios_fotos_un_solo_dueno_chk`), `texto`, `autorId?`, `autorNombre`
(snapshot), `creadoEn`, `editadoEn?`.

### 4.6 Campos configurables del equipo

- `DefinicionCampoFotos` (`:376`): `nombre`, `clave @unique`, `tipo`,
  `orden`, `activo`.
- `TipoCampoFotos` (`:359`): `TEXTO`, `TEXTO_LARGO`, `NUMERO`, `FECHA`,
  `BOOLEANO`, `LISTA`, `FOTO`.
- `OpcionCampoFotos` (`:405`): valores de un campo LISTA.
- `ValorCampoFotos` (`:427`): columnas tipadas `valorTexto`, `valorNumero`
  `Decimal(14,4)`, `valorFecha @db.Date`, `valorBooleano`, `opcionId`, y
  `claveImagen`/`claveMiniatura` para el tipo FOTO.
  `@@unique([carpetaId, definicionId])`.

**No hay `obligatorio`**: todos los campos son opcionales por diseño
(comentario del schema, `:355`).

### 4.7 Configuración y compartir

- `ConfiguracionColorCarpeta` (`:508`): `tipo @unique` → `color`
  (`AMARILLO` \| `CELESTE`). Dos filas.
- `AccesoCompartido` (`:621`): `usuarioId` + `carpetaId` + `permiso`
  (`LECTURA`/`EDICION`/`TOTAL`/`SIN_ACCESO`), `otorgadoPorId`.
- `InvitacionCliente` (`:643`): `email`, `nombre?`, **`tokenHash @unique`**
  (SHA-256, nunca el token), `estado`, `expiraEn`, `aceptadaEn?`,
  `clienteId?`.
- `InvitacionCarpeta` (`:682`): qué carpetas cubre la invitación y con qué
  permiso cada una.

### 4.8 Plantillas y bitácora

- `PlantillaEstructura` (`:814`) + `PlantillaEstructuraNodo` (`:837`) con
  `TipoNodoPlantilla` = `CARPETA`\|`TAREA`\|`ALBUM`. **No se versiona.**
- `EventoFotos` (`:913`): `carpetaId?`, `entidad`, `entidadId`, `accion`,
  `usuarioId?`, `usuarioNombre?`, `campoAfectado?`, `valorAnterior?`,
  `valorNuevo?`, `descripcion?`, `ip?`.
  `AccionFotos` incluye `SUBIDA_FOTO`, `MOVIMIENTO`, `TAREA_COMPLETADA`,
  `COMPARTIR`, `CAMBIO_PERMISO`, etc. (19 valores, `:891`).

### 4.9 Respuesta directa a lo que se pidió comprobar

| ¿Existe? | Respuesta | Evidencia |
|---|---|---|
| Estado de la tarea/actividad | **Sí** | `TareaFotos.estado`, enum de 3 valores |
| Fotos ligadas a una tarea | **Sí** | `Foto.tareaId`, relación `TareaFotos.fotos[]` |
| Campos «antes / después» | **No** | `grep -niE "antes.*despues\|antesDespues"` → 0 resultados en schema y `src/fotos` |
| Switch de observaciones | **No** | No existe entidad ni campo «observación» en el módulo: `grep -rni "observacion" backend/src/fotos frontend/src/modules/fotos` → **0** |
| Estado del equipo | **No** | `CarpetaFotos` solo tiene `cerrada` (archivado). No hay enum de estado ni color por estado |
| Historial / versionado por ciclos o visitas | **No** | `grep -rniE "\bciclo\b\|\bvisita\b"` → 1 resultado, y es un comentario sobre el ciclo de render de React (`CamaraFotos.tsx:378`). Lo único histórico es `EventoFotos`, que es bitácora de acciones, no ciclos de trabajo |

---

## 5. Flujo real al subir una foto

Hay **dos caminos de origen** que convergen en la misma llamada.

### 5.1 Camino A — cámara en vivo (`CamaraFotos.tsx`, 1629 líneas)

1. **Apertura**: `getUserMedia` con `facingMode` `environment`/`user`. Estados
   `iniciando` \| `lista` \| `sin-camara` \| `permiso-denegado`.
2. **GPS en paralelo**: `useGeolocation(activo)` (`hooks/useGeolocation.ts`)
   observa la posición y la deja en `posicionRef`, «para que cada foto tenga
   su propio GPS». Si el navegador no soporta o se deniega el permiso, pasa a
   `error` y **el flujo continúa sin GPS**.
3. **Captura** (`CamaraFotos.tsx:470-578`): se dibuja el frame en un
   `<canvas>` del tamaño del vídeo, se toma `fechaCaptura = new Date()` y la
   posición del instante.
4. **Reverse geocoding**: `obtenerDireccionLegible(lat, lon)`
   (`lib/reverseGeocoding.ts`) dentro de `try/catch`; si falla, `direccion = null`.
5. **Marca de agua**: `dibujarEvidenciaSobreCanvas(...)`
   (`lib/composeEvidencePhoto.ts`) pinta **logo** arriba a la derecha y abajo
   a la derecha las líneas: fecha `23 ago. 2026`, hora `HH:MM:SS`,
   coordenadas `-12.0464S 77.0428W`, precisión `±8.00 m` y la dirección.
6. **Archivo**: `canvas.toBlob(...)` → `new File([blob], \`foto-evidencia-${ahora}.jpg\`, {type:'image/jpeg'})`.
   Se añade al lote del padre con `onCapturar(archivo)` — **todavía no se sube**.

⚠️ **Consecuencia del diseño:** las coordenadas quedan **quemadas en los
píxeles**, no guardadas como dato. No hay columnas `latitud`/`longitud` en
`Foto` (§4.4), así que la ubicación **no es consultable, filtrable ni
exportable**; solo se lee mirando la imagen.

### 5.2 Camino B — selector de archivos

`PanelSubida.tsx` / `SubirAAlbum.tsx` / `CapturaRapida.tsx`:
`<input type="file" multiple accept="image/jpeg,image/png,image/heic,image/heif,image/webp">`.
En `CapturaRapida.tsx:231` y `FotosDeTarea.tsx:141` lleva además
`capture="environment"`. Estas fotos **no** pasan por el compositor: van tal
cual, sin marca de agua.

### 5.3 Envío

Ambos caminos acumulan en `archivos: File[]` y llaman a una sola mutación
(`useSubirFotos` / `useSubirA`) → `POST` multipart con campo `fotos`.

### 5.4 Backend — `AlbumService.subir` (`album.service.ts:~560`)

Orden exacto:

1. `resolverDestino(usuario, destino)` — **antes de tocar un byte**: resuelve
   álbum/tarea/carpeta/bandeja y exige `EDICION` sobre la carpeta (salvo
   bandeja, que no tiene carpeta).
2. `if (!archivos || archivos.length === 0)` → 400.
3. `if (archivos.length > LIMITES.fotosPorSubida)` → 400. **`fotosPorSubida = 10`**
   (`imagen.service.ts:25`).
4. `if (!this.almacenamiento.configurado)` → 400 «El almacenamiento de fotos
   no está configurado».
5. Si el destino es una **carpeta**, crea el `AlbumFotos` que recogerá el lote.
6. Clave de agrupación en R2: `grupo = albumId ?? \`u${usuario.id}\`` — así una
   foto **no cambia de clave al clasificarse** después.
7. **Por cada archivo, en `try/catch` individual** (si uno falla, los
   anteriores se conservan):
   - `ImagenService.procesar(archivo)`:
     - `validar` (MIME de `MIME_ACEPTADOS`, tamaño ≤ 15 MB),
     - `sharp(buffer).metadata()` → `tomadaEn` se lee del **EXIF original**,
     - `.rotate()` para respetar la orientación **y descartar el resto de
       metadatos** (sharp no los copia por defecto: se eliminan GPS, marca y
       modelo),
     - salida **WebP 1600 px calidad 80** + **miniatura 400 px calidad 70**,
       con `withoutEnlargement: true`.
   - Nombre aleatorio `\`${Date.now()}-${randomUUID()}.webp\``.
   - `almacenamiento.subir(claveImagen, ...)` y `subir(claveMiniatura, ...)`
     → **dos objetos** en R2, `ContentType: image/webp`.
   - `prisma.foto.create({...})`.
8. Si **ninguna** se guardó: borra el álbum que esta subida creó y lanza 400
   con el detalle de cada fallo.
9. `marcarActividad(ruta)` propaga `actualizadoEn` por la línea de ancestros.
10. `AuditoriaFotosService.registrar` con `AccionFotos.SUBIDA_FOTO`.

### 5.5 Qué queda en PostgreSQL vs. en R2

| PostgreSQL (`fotos`) | Cloudflare R2 |
|---|---|
| `claveImagen`, `claveMiniatura` (rutas, no URLs) | El WebP 1600 px |
| `anchoPx`, `altoPx`, `bytes`, `bytesOriginal`, `formato` | La miniatura 400 px |
| `subidaPorId`, `creadoEn`, `tomadaEn`, `descripcion`, `nombreOriginal` | — |
| `albumId` **o** `tareaId` **o** ninguno | — |

El bucket es **privado**: las imágenes se sirven con **URLs firmadas de
vencimiento corto** generadas en cada lectura (`urlFirmada`), nunca se
guardan URLs en la base.

**Metadatos que NO se guardan:** ubicación (ver §5.1), dispositivo, EXIF
completo. El único metadato de captura persistido es `tomadaEn`, y **para las
fotos de cámara será `null`**, porque el JPEG que produce `canvas.toBlob` no
lleva EXIF.

---

## 6. Gestión de tareas/actividades actual

### 6.1 Cómo se crean

Dos puertas, ambas a `POST /fotos/carpeta/:id/tarea`:

- **Alta rápida**: campo «Nueva tarea…» + botón «Añadir» (`PanelTareas.tsx:196`),
  solo el título.
- **Formulario completo**: botón «Con detalle…» → `DialogoTarea.tsx` con
  título, descripción, estado, prioridad, fecha y responsable
  (`GET /fotos/tarea-asignables`).

### 6.2 ¿Catálogo reutilizable, o sueltas por equipo?

**Se crean sueltas, una por una, dentro de cada equipo.** No existe un
catálogo de tipos de tarea equivalente a `OpcionCatalogo` de Costos.

Lo más parecido son las **plantillas de estructura**
(`PlantillaEstructura` + nodos de tipo `TAREA`, administradas en
`AdminFotos.tsx` → pestaña «Plantillas»): permiten estampar un conjunto de
tareas sobre un equipo. Pero **aplicar una plantilla COPIA** — no queda
ningún vínculo con la plantilla de origen, así que no es un catálogo vivo:
editar la plantilla no cambia lo ya creado, y nada permite preguntar «qué
equipos se inspeccionaron con este checklist».

### 6.3 Restricción de ubicación

`TareaService.crear` consulta el `tipo` de la carpeta y **rechaza con 400 si
no es `EQUIPO`**. La misma regla se repite al aplicar plantillas
(`plantilla.service.ts:436`): las tareas que no caben se **omiten y se
avisa**, en vez de fallar la operación entera.

### 6.4 ¿Tienen estado?

**Sí.** `estado` con tres valores. Se cambia por dos vías:

- Casilla de la fila → `POST /fotos/tarea/:id/completar` o `/reabrir`, que
  escribe **tres columnas a la vez** (`estado`, `completadaEn`,
  `completadaPorId`).
- `PATCH /fotos/tarea/:id` desde el formulario, que escribe **la misma marca**
  para no dejar una tarea «completada» sin fecha ni firma.

Reabrir **borra** `completadaEn` y `completadaPorId`.

### 6.5 ¿Aceptan fotos? ¿Ligadas 1 a 1?

**Sí, y de forma libre — no 1 a 1.** `Foto.tareaId` es una FK nullable y la
relación es `TareaFotos.fotos: Foto[]`: **N fotos por tarea, sin límite ni
tipificación**. No hay ningún campo que distinga qué representa cada foto
(ver §8).

Se suben desde `FotosDeTarea.tsx` (`POST /fotos/tarea/:id/foto`) y se
listan con `GET /fotos/tarea/:id/foto`, **sin paginar**. Cada miniatura tiene
botón de borrado al pasar por encima, con la distinción propia/ajena.

`TareaService.eliminar` **rechaza con 400 borrar una tarea que tiene fotos**:
la evidencia no se va por delante.

### 6.6 ¿Aceptan comentarios?

**Sí.** `HiloComentarios entidad="tarea"` dentro de la fila desplegada.
`ComentarioFotos.tareaId` es una de las cuatro FK.

---

## 7. Compartir y permisos

### 7.1 Dos sistemas separados, y no se mezclan

| Sistema | Dónde vive | Qué dice |
|---|---|---|
| **Nivel global del módulo** | `PermisoModulo.nivelFotos` | Qué alcanzas sin que nadie te comparta nada |
| **Permiso por carpeta** | `AccesoCompartido.permiso` | Qué puedes hacer DENTRO de una carpeta concreta |

`NivelFotos` (`schema.prisma:53`): `LECTURA_GLOBAL`, `EDITOR_GLOBAL`,
`ADMIN_GLOBAL`. **`null` es un valor legítimo** y el más común: el supervisor
que entra al módulo y solo alcanza lo que le compartieron. No existe un valor
«sin acceso»: eso es no tener fila en `PermisoModulo`.

`PermisoCarpeta`: `LECTURA`, `EDICION`, `TOTAL`, `SIN_ACCESO` (este último es
una **negación explícita**, no la ausencia de fila).

### 7.2 Roles globales del sistema

`RolGlobal` (`schema.prisma:24`) tiene **exactamente tres**:

| Rol | Qué es |
|---|---|
| `SUPERADMIN` | Única cuenta; crea admins y reparte módulos. Pasa por encima de todo permiso |
| `ADMIN` | Cuenta interna normal; accede solo a los módulos asignados |
| `CLIENTE` | Cuenta externa del portal. **No tiene filas en `PermisoModulo`**, así que `ModuloGuard` la rechaza salvo en rutas `@PermiteCliente()` |

**No existen roles «supervisor», «técnico» ni «externo» como tales.** Lo que
en la práctica se llama «supervisor» es un `ADMIN` con el módulo FOTOS y
`nivelFotos = null`. Lo que se llama «externo» es `RolGlobal.CLIENTE`. Un rol
«técnico» no existe en ninguna forma.

### 7.3 La cascada de permisos

`AccesoService.permisoSobre(alcance, ruta)` es una función **pura**. Resuelve
seis escalones quedándose con el **MÁXIMO** (no con el primero que responda),
salvo el admin global, que corta:

1. `ADMIN_GLOBAL` o `SUPERADMIN` → `TOTAL`.
2. Nivel global → suelo (`LECTURA_GLOBAL`→LECTURA, `EDITOR_GLOBAL`→EDICION).
3. Propietario de la carpeta → `TOTAL`.
4-6. Entre las concesiones que caen en el camino de la `ruta`, gana **la de la
carpeta más profunda** — eso cubre permiso específico, herencia y restricción
explícita a la vez.

La cascada **no se materializa**: compartir es UNA fila y los descendientes se
resuelven comparando prefijos de `ruta`. Consecuencias reales: **mover una
carpeta mueve su acceso**, y revocar la madre **no** revoca un hijo compartido
aparte.

### 7.4 Tabla de verbos (los mínimos, verificados en los call sites)

| Operación | Mínimo | Dónde |
|---|---|---|
| Ver carpeta, galería, tareas, comentarios, campos | `LECTURA` | `album.service.ts:92,200`, `tarea.service.ts:270`, `valor-campo-fotos.service.ts:100` |
| Crear subcarpeta, subir fotos, crear/editar tarea, comentar, guardar campos | `EDICION` | `carpeta.service.ts:133`, `tarea.service.ts:99`, `valor-campo-fotos.service.ts:582` |
| Compartir, cambiar grado, revocar, ver colaboradores | `TOTAL` | `compartir.service.ts:207,618` |
| Eliminar carpeta | `TOTAL` | `carpeta.service.ts:379` |
| Archivar / reabrir | `LECTURA` + `ADMIN_GLOBAL` | `carpeta.service.ts:349` |
| Crear carpeta de primer nivel | `EDITOR_GLOBAL` o más | `carpeta.service.ts:127` (`puedeCrearRaiz`) |
| Configurar campos, colores, plantillas; bitácora del módulo | `ADMIN_GLOBAL` | `campo.service.ts:67`, `configuracion.service.ts:83`, `plantilla.service.ts:76`, `auditoria-fotos.service.ts:201` |

### 7.5 Compartir: qué pasa exactamente

`CompartirService.compartir` (`:353`) recibe `{email, carpetaIds[], permiso,
expiraEn?}` y **decide solo** entre dos caminos:

- **El correo ya tiene cuenta** → crea filas en `AccesoCompartido`
  directamente. **No se genera enlace.**
- **El correo es desconocido** → crea `InvitacionCliente` +
  `InvitacionCarpeta` (una por carpeta, cada una con su permiso) y **envía un
  enlace por correo**.

### 7.6 El enlace de invitación

- Token generado en el servidor; en la base se guarda **solo el SHA-256**
  (`createHash('sha256')`, `compartir.service.ts:510`) — nunca el token.
- **Un solo uso**, vigencia **7 días** por defecto
  (`const DIAS_VIGENCIA = 7`, `compartir.service.ts:33`). El campo «expira»
  del diálogo es un *override* de ese plazo.
- Reenviar **genera token nuevo e invalida el anterior**, y renueva el plazo,
  pero **no recalcula el grado**: el permiso viaja en `InvitacionCarpeta`
  desde que se envía.
- `EXPIRADA` **no es un estado guardado**: se deriva de `expiraEn < ahora`.
- La ruta pública `GET /invitacion/:token` valida y
  `POST /invitacion/:token/activar` crea la cuenta `CLIENTE` y copia los
  permisos guardados a `AccesoCompartido`.

### 7.7 Autenticación

JWT propio (`@nestjs/jwt` + `bcryptjs`, sin passport). **El token lleva solo
el `usuarioId`**; los permisos se releen de la base en cada petición, de modo
que quitar un módulo o desactivar una cuenta surte efecto inmediato. Dos
guards globales (`JwtGuard`, `ModuloGuard`): todo endpoint nace cerrado y
abrirlo exige `@Publico()` o `@PermiteCliente()` explícitos.

Throttler: 300/min global, **10/min** en `/auth/login` e `/invitacion/*`.

### 7.8 Interfaz de compartir

`DialogoCompartir.tsx` (274 líneas): correo + selector de carpetas +
selector de grado + vigencia opcional. `AccesosDeCarpeta.tsx` lista los
colaboradores con su grado. `EnlaceInvitacion.tsx` muestra el enlace para
copiarlo — necesario porque **sin `RESEND_API_KEY` el correo no sale** y el
service devuelve `enviado: false` con el motivo.

---

## 8. Lo que NO existe todavía

Cada punto se buscó explícitamente; se indica cómo.

| # | No existe | Cómo se comprobó |
|---|---|---|
| 1 | **Estado de equipo con colores** | `CarpetaFotos` solo tiene `cerrada` (archivado). El único color configurable es **por TIPO de carpeta**, no por estado: `ConfiguracionColorCarpeta` tiene 2 filas (`CARPETA`→`AMARILLO`, `EQUIPO`→`CELESTE`) y el enum `ColorCarpetaFotos` solo admite esos dos colores |
| 2 | **Campo «tipo de sistema»** | `grep -rniE "tipoSistema\|tipo_de_sistema"` → **0**. Podría crearse como campo configurable de tipo LISTA, pero no está definido |
| 3 | **Observaciones (entidad) y su estado pendiente/resuelto** | `grep -rni "observacion" backend/src/fotos frontend/src/modules/fotos` → **0**. Lo único parecido son los comentarios, que **no tienen estado**: `ComentarioFotos` solo guarda texto, autor, `creadoEn` y `editadoEn` |
| 4 | **Ciclos / visitas / historial por visita** | `grep -rniE "\bciclo\b\|\bvisita\b"` → 1 resultado y es un comentario sobre el render de React. No hay agrupador temporal de trabajo. `AlbumFotos.fecha` y `TareaFotos.fecha` son fechas sueltas, no un ciclo con identidad |
| 5 | **Fotos «antes / después» por actividad** | `grep -niE "antes.*despues\|antesDespues"` → **0** en schema y en `src/fotos`. Las fotos de una tarea son una lista plana sin tipificación |
| 6 | **Catálogo configurable de actividades** | No hay tabla de tipos de tarea. Las plantillas (§6.2) son un molde que se **copia**, no un catálogo referenciado |
| 7 | **Etiquetas de foto** | `grep -rniE "etiquetaFoto\|EtiquetaFotos\|tagFoto"` → **0**. `Foto` no tiene ningún campo de clasificación más allá de `descripcion` |
| 8 | **Credenciales de técnico para compartir** | No existe el rol. Compartir siempre produce **o** un acceso a una cuenta existente **o** una invitación que crea una cuenta `CLIENTE` (portal, solo lectura). No hay forma de dar a un técnico externo credenciales con permiso de escritura acotado |
| 9 | **Ubicación como dato** | Las coordenadas se dibujan sobre el píxel (§5.1) pero **no hay columnas** `latitud`/`longitud`/`precision` en `Foto`. No se puede filtrar, exportar ni verificar por ubicación |
| 10 | **Notificaciones / avisos** | No hay ningún sistema de notificación en el backend. Lo único que sale hacia fuera es `CorreoService` (Resend), usado para invitaciones |
| 11 | **Reemplazar el archivo de una foto** | Deliberadamente ausente: solo existe `PATCH /fotos/foto/:id` para la descripción. Cambiar la imagen exige eliminar y volver a subir |
| 12 | **Reordenar fotos dentro de un álbum** | No hay campo `orden` en `Foto`; la galería ordena por `creadoEn` |
| 13 | **Papelera / favoritos** | No hay campos ni tablas. El borrado es definitivo |

**Sí existe** (por si se daba por ausente): fotos **sueltas no ligadas a
tarea** — es la bandeja de fotos pendientes (`Foto` con `albumId` y `tareaId`
en `null`), con su pantalla en `/fotos/captura`.

---

## 9. Funciones sueltas o inconsistencias

### 9.1 El frontend impone una jerarquía que el backend no tiene

`Fotos.tsx:76-80` declara que una carpeta pura «nunca» contiene álbumes ni
comentarios, y monta toda la ficha solo si `esEquipo`. **El backend no
comparte esa regla**:

- `AlbumService.crearAlbum` solo exige `EDICION`; **no consulta el `tipo`**
  (verificado: dentro de la función solo aparece `exigirPermiso`).
- `TareaService.crear` **sí** consulta el tipo y rechaza.
- `plantilla.service.ts:436` omite las tareas fuera de un EQUIPO **pero crea
  los álbumes en cualquier carpeta**.

**Consecuencia real:** una plantilla o una importación de Excel puede crear un
álbum dentro de una carpeta corriente, y **ese álbum será invisible en la
interfaz** — no hay pestaña «Álbumes» fuera de un equipo. Lo mismo vale para
los comentarios de carpeta y para cualquier álbum creado antes de que se
introdujera la regla.

### 9.2 Límite de fotos por subida: 15 en el frontend, 10 en el backend

| Sitio | Valor |
|---|---|
| `PanelSubida.tsx:12` | `MAX_FOTOS = 15` |
| `SubirAAlbum.tsx:10` | `MAX_FOTOS = 15` |
| `CamaraFotos.tsx:64` | `MAX_FOTOS_SESION = 15` |
| `imagen.service.ts:25` | **`fotosPorSubida: 10`** |

El backend lo hace cumplir por dos vías (`FilesInterceptor('fotos', 10, …)` en
`album.controller.ts:78,129,151,178` y una comprobación explícita en
`album.service.ts:610`). **Seleccionar de 11 a 15 fotos y pulsar «Subir»
falla**, y el mensaje que ve el usuario sale de `subida.filtro.ts:38`
(«Máximo 10 fotos por subida»), contradiciendo el texto de la propia pantalla
(«Hasta 15 fotos por vez»). El comentario del frontend afirma «el backend
también lo valida» — es cierto, pero **con otro número**.

### 9.3 Nomenclatura muerta: «Sede»

El modelo `Sede` **no existe** (`grep -c "model Sede"` → 0), pero el nombre
sobrevive en **54 apariciones** repartidas por 6 archivos:
`RutaSedes.tsx` (nombre del componente), y la prop/variable `sedeId` en
`PanelSubida.tsx`, `useAlbumes.ts`, `Fotos.tsx`, `Portal.tsx` y
`fotosService.ts`. Hoy `sedeId` **siempre significa `carpetaId`**.

### 9.4 `@RequiereNivelFotos` no lo usa ninguna ruta

El decorador existe (`auth/decoradores.ts`) y su regla vive en el guard, pero
**ninguna ruta lo aplica** — solo aparece en dos comentarios que explican por
qué no se usa (`administracion.controller.ts:118`,
`compartir.controller.ts:20`). Además, `reglaNivelFotos` compara por
**igualdad exacta**, de modo que si alguna ruta lo usara, un `ADMIN_GLOBAL`
**no** satisfaría una ruta que pidiera `EDITOR_GLOBAL`. Es una trampa latente.

### 9.5 `capture="environment"` aplicado de forma desigual

Está en `CapturaRapida.tsx:231` y `FotosDeTarea.tsx:141`, pero **no** en
`PanelSubida.tsx` ni en `SubirAAlbum.tsx`. Como esas dos últimas ahora tienen
botón propio de cámara (`CamaraFotos`), el resultado es que **hay dos formas
distintas de tomar una foto** según la pantalla: unas abren la cámara nativa
del sistema (sin marca de agua) y otras la cámara interna (con marca de agua,
GPS y logo). **La misma acción produce fotos distintas según desde dónde se
haga.**

### 9.6 La marca de agua solo se aplica a una de las dos vías

Derivado de lo anterior: una foto elegida desde la galería **no lleva** fecha,
hora, coordenadas ni logo; una tomada con `CamaraFotos` **sí**. No hay ningún
campo que distinga unas de otras, así que en la galería conviven ambas sin
que se pueda saber cuál es «evidencia compuesta» y cuál no.

### 9.7 `CamaraFotos.tsx` es desproporcionadamente grande

1629 líneas en un solo componente — el archivo más grande del módulo y casi el
doble que el segundo (`GaleriaAlbumes.tsx`, 766). Contiene el ciclo de vida del
stream, la conmutación de cámaras, la sesión de fotos, la revisión, el
compositor y el manejo de errores. No está roto, pero es el punto donde más
caro sale entrar.

### 9.8 `tomadaEn` quedará casi siempre en `null`

`ImagenService.procesar` lee `tomadaEn` del EXIF del archivo original. El
JPEG que produce `canvas.toBlob` **no tiene EXIF**, así que toda foto tomada
con la cámara interna guardará `tomadaEn = null`, aunque la fecha real esté
dibujada en la imagen. El campo solo se llena con fotos importadas desde la
galería que conserven su EXIF.

### 9.9 `descripcion` es del lote, pero se edita por foto

`AlbumService.subir` copia la misma `descripcion` a **todas** las fotos del
lote, y el texto de ayuda de `PanelSubida` dice «se aplica a todas las de esta
subida». Pero `PATCH /fotos/foto/:id` la edita **por foto**. Tras la primera
corrección, el campo deja de significar «descripción del lote» sin que nada en
la interfaz lo indique.

### 9.10 Fotos de tarea sin paginar

`GET /fotos/tarea/:id/foto` (`TareaService.fotosDe`) devuelve **todas** las
fotos de la tarea sin cursor ni límite, mientras que la galería de carpeta sí
pagina (12 álbumes por página). Con una tarea muy documentada, la respuesta
crece sin tope — y cada foto exige además firmar dos URLs de R2.

### 9.11 Borrado en cascada de comentarios sin rastro

`ComentarioFotos.carpetaId`/`albumId`/`fotoId` son todos `Cascade`. Al
eliminar una carpeta o una foto, sus comentarios desaparecen **por la base de
datos**, sin pasar por ningún service y por tanto **sin generar ningún
`EventoFotos`**. La bitácora no registra que se perdió contenido escrito por
una persona. (Está anotado como pendiente en `CLAUDE.md`, no resuelto.)

### 9.12 Componentes: ninguno huérfano

Se comprobó uno a uno que los 25 componentes del módulo están importados en
algún sitio. **No hay componentes muertos.** `SubirAAlbum` y `DialogoMoverFoto`
se usan desde `GaleriaAlbumes.tsx` (`:413`, `:439`, `:626`).

---

## Resumen ejecutivo

**Lo que hay:** un explorador de árbol libre con dos tipos de nodo, álbumes,
fotos con procesamiento a WebP y almacenamiento privado en R2, tareas con
estado y responsable, comentarios en cuatro entidades, campos configurables
por EAV para los equipos, compartir con permisos en cascada, invitaciones por
enlace de un solo uso, portal externo de solo lectura, plantillas de
estructura, importación por Excel, bitácora completa y exportaciones.

**Lo que no hay:** ninguna noción de **ciclo de trabajo o visita**, ningún
**estado del equipo**, ninguna **tipificación de las fotos** (ni antes/después
ni etiquetas), ningún **catálogo de actividades**, ninguna **observación con
estado**, y ningún **rol intermedio** entre la cuenta interna y el cliente
externo de solo lectura.

**Lo más urgente de las inconsistencias:** el límite 15 vs 10 (§9.2), que
produce un fallo visible al usuario; y la divergencia de jerarquía entre
frontend y backend (§9.1), que puede dejar contenido creado e invisible.
