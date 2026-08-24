# Módulo Fotos — Qué hace hoy, botón por botón

> Documento **funcional**, no técnico. Describe lo que el sistema hace **hoy**,
> no lo que pedía la especificación original. Escrito recorriendo el código real
> del módulo (backend y frontend) el 21 de agosto de 2026.
>
> **Cómo se comprobó cada cosa.** La mayoría de pantallas y botones se
> verificaron en el navegador durante la sesión de rediseño: el explorador de
> carpetas, el menú lateral, la galería, el diálogo de renombrar, las tablas, la
> pantalla de administración y el comportamiento en móvil. El resto —flujos que
> necesitan datos que no existen en la base local, como una invitación con
> enlace válido— se verificó leyendo el código. **Donde no pude comprobarlo en
> pantalla, lo digo.**

---

## 1. RESUMEN — qué es el módulo Fotos

Es el archivo fotográfico de los trabajos de HVC, organizado como un **gestor de
carpetas** parecido a Google Drive, pero pensado para supervisión de obra.

Sirve para tres cosas, en este orden de importancia:

1. **Que el supervisor documente en campo, desde el celular, con pocos pasos.**
   Llega a un equipo, fotografía lo que ve, marca la tarea como hecha y sigue.
2. **Que quede constancia de quién hizo qué y cuándo.** Cada foto, tarea y
   comentario lleva autor y fecha, y hay un historial de acciones.
3. **Que el cliente pueda ver su obra sin ver la de nadie más.** Se le comparte
   una carpeta y entra por un portal aparte donde solo existe eso.

La unidad básica es la **carpeta**. Dentro de una carpeta puede haber más
carpetas (sin límite de profundidad), álbumes de fotos y —si la carpeta
representa un equipo— tareas de inspección. Todo lo demás son maneras de meter
contenido ahí dentro más rápido: la captura rápida, la importación por Excel y
las plantillas.

**Lo que NO es:** no es una galería pública, no es un gestor documental (solo
imágenes), y no reemplaza al módulo de Gestión de Equipos —lo consulta—.

---

## 2. ROLES Y QUÉ PUEDE HACER CADA UNO

Hay **dos sistemas de permiso que no se mezclan**, y es la idea más importante
del módulo:

- **El nivel global** dice hasta dónde llegas en TODO el árbol de carpetas.
- **El permiso por carpeta** dice qué puedes hacer DENTRO de una carpeta
  concreta que alguien te compartió.

Una persona puede no tener ningún nivel global y aun así trabajar con normalidad
en las carpetas que le compartieron. De hecho **ése es el caso más común**.

### 2.1 Sin acceso al módulo

No ve «Fotos» en el menú lateral. Si escribe la dirección a mano, el sistema le
responde que no tiene acceso. No hay nada que pueda hacer.

### 2.2 Sin nivel global — el supervisor (el caso normal)

Tiene el módulo Fotos activado pero **ningún** nivel global. Es el perfil del
supervisor de obra.

**Qué ve:** solo las carpetas que él creó y las que le compartieron. Al entrar,
la pantalla se le parte en dos secciones: **«Mis carpetas»** y **«Compartido
conmigo»**.

**Qué puede hacer** — depende del permiso que tenga en cada carpeta:

| En una carpeta donde tiene… | Puede |
|---|---|
| **Lectura** | Ver la carpeta, sus subcarpetas, tareas, álbumes, fotos y comentarios. Descargar fotos. |
| **Edición** | Todo lo anterior, más: crear subcarpetas, subir fotos, crear álbumes, crear y completar tareas, comentar, renombrar, y borrar sus **propias** fotos y comentarios. |
| **Acceso total** | Todo lo anterior, más: compartir esa carpeta, cambiar el permiso de otros, revocar accesos, ver la lista de colaboradores, eliminar la carpeta y borrar fotos **ajenas**. |

**Lo que NO puede hacer, tenga el permiso que tenga:**

- **Crear carpetas de primer nivel.** El botón «Nueva carpeta» aparece dentro de
  una carpeta donde tenga Edición, pero no en la raíz.
- Entrar a la pantalla de Administración de Fotos.
- Ver carpetas que nadie le compartió.
- Dar a otra persona un permiso mayor del que él tiene.

⚠️ **Consecuencia práctica:** un supervisor **casi nunca verá «Mis carpetas»**,
porque no puede crear carpetas de primer nivel y todo lo que crea vive dentro de
algo que le compartieron. Es el mismo comportamiento de Google Drive, pero el
nombre de la sección sugiere otra cosa.

### 2.3 Lectura Global

Alcanza **todo** el árbol, pero solo para mirar.

**Qué ve:** una sola sección, **«Todas las carpetas»** — no se le parte en «mías»
y «compartidas», porque llega a todo por su nivel y separarlo sería mentirle.

**Qué puede hacer:** ver cualquier carpeta, tarea, álbum, foto y comentario del
sistema. Descargar fotos. Exportar el listado de tareas de una carpeta y su
historial.

**Qué NO puede:** crear, subir, editar, comentar, completar tareas, compartir,
eliminar ni entrar a Administración. En pantalla, esos botones sencillamente **no
aparecen**.

### 2.4 Editor Global

Todo lo de Lectura Global, más el trabajo diario sobre **cualquier** carpeta:
crear subcarpetas, subir fotos, crear álbumes, crear y completar tareas,
comentar, renombrar.

**Además, y a diferencia del supervisor: puede crear carpetas de primer nivel.**

**Qué NO puede:**

- **Compartir carpetas ajenas.** Compartir exige Acceso Total sobre esa carpeta
  concreta, y el nivel global le da Edición, no Total. La excepción son **las
  carpetas que él mismo creó**: ahí es propietario y sí puede compartir.
- Ver la lista de colaboradores de una carpeta ajena (son correos de terceros).
- Archivar o reabrir carpetas.
- Entrar a Administración de Fotos.

### 2.5 Administrador Global

Acceso absoluto al módulo. Todo lo anterior sobre cualquier carpeta —sin
depender de que nadie le comparta nada—, más:

- **Compartir y administrar colaboradores** de cualquier carpeta.
- **Archivar y reabrir** carpetas (dejarlas en solo lectura, y volver atrás).
- **Eliminar** carpetas, y borrar fotos y comentarios de otros.
- **Administración de Fotos**: crear plantillas de estructura y consultar el
  historial completo del módulo.

⚠️ **Una sola excepción, y es deliberada: la bandeja de fotos pendientes de
organizar es privada.** Las fotos que alguien subió sin clasificar **no las ve
nadie más, ni el Administrador Global**. Todavía no están en ninguna carpeta —son
material en borrador, lo que alguien fotografió y aún no ha decidido dónde va—.
En cuanto se clasifican pasan a regirse por su carpeta como todo lo demás, y ahí
el administrador sí llega.

### 2.6 Cliente externo (portal)

Es una cuenta distinta, que entra por **`/portal`** y no ve el sistema interno.

**Qué ve:** una sola sección, **«Compartido conmigo»**, con exactamente las
carpetas que le tocaron y todo lo que cuelga de ellas. Dentro puede navegar
subcarpetas, ver tareas, álbumes, fotos y comentarios, y descargar fotos.

**Qué NO puede hacer — nada de escritura, en absoluto.** No hay ningún botón de
crear, subir, comentar, completar ni compartir. Y no es que estén ocultos: el
servidor del portal **no tiene ninguna ruta de escritura**, así que aunque se le
compartiera una carpeta con permiso de Edición, seguiría sin poder escribir.

**Tampoco ve nombres de carpetas que no tenga autorizadas.** Si su carpeta cuelga
de otra mayor, el rastro de navegación superior se le oculta.

---

## 3. CASOS DE USO, PASO A PASO

> Los nombres entre comillas son los que aparecen literalmente en pantalla.

### 3.1 Crear y organizar carpetas

1. Entra a **Fotos** desde el menú lateral. Aterriza en el explorador de
   carpetas.
2. Si tiene nivel Editor o superior, en la cabecera hay **«Nueva carpeta»**.
   Pide un nombre y la crea.
3. Para entrar, clic en la tarjeta de la carpeta. La ruta de navegación superior
   muestra dónde está y permite volver atrás.
4. Dentro, **«Nueva carpeta»** crea una subcarpeta. **No hay límite de
   profundidad**: se puede seguir anidando indefinidamente.
5. Cada tarjeta de carpeta muestra al pasar el ratón unos botones de icono, que
   aparecen **solo si tiene permiso para cada cosa**: renombrar (lápiz),
   compartir, archivar y eliminar.
6. Arriba a la derecha hay un **ordenador** de carpetas: «Nombre (A-Z)»,
   «Nombre (Z-A)», «Actividad más reciente», «Actividad más antigua».
7. El buscador —**«Buscar carpetas en todo lo que ves…»**— recorre **todo el
   árbol visible**, no solo la carpeta abierta. Mientras se busca, la galería y
   la subida se ocultan, y aparece **«Salir de la búsqueda»**.

**Eliminar una carpeta solo funciona si está vacía.** Si tiene subcarpetas o
álbumes dentro, el sistema lo rechaza con un aviso. No es un fallo: es lo que
evita borrar trabajo por accidente.

**Archivar** deja la carpeta y todo su contenido en solo lectura, sin borrar
nada. Se puede reabrir. Solo el Administrador Global.

### 3.2 Crear una carpeta de tipo Equipo

Una carpeta puede representar un equipo físico del catálogo de Gestión de
Equipos. Sirve para colgarle tareas de inspección.

1. Dentro de una carpeta (no en la raíz), pulsa **«Añadir equipo»**.
2. Se abre un selector de **tres pasos**, en este orden:
   - **Elegir la organización** (`«Elige una organización…»`). Va primero porque
     el catálogo de equipos está separado por organización.
   - **Buscar el equipo** (`«Buscar equipo»`, con ayuda «Código, marca,
     modelo…»). Busca por código y por cualquier dato de texto del equipo.
   - **Elegir** el equipo de la lista de resultados, con **«Elegir»**.
3. La carpeta se crea automáticamente con el nombre `Equipo <código>`.

**Si el equipo no está en el catálogo**, debajo de los resultados aparece la
opción de registrarlo ahí mismo: pide **«Código»** y una ubicación
(`«Elige una ubicación…»`), y con **«Registrar y elegir»** lo crea en el catálogo
de Gestión de Equipos y lo enlaza de una vez. Esa opción **solo aparece si tiene
nivel Editor Global o superior**.

⚠️ Las columnas de la tabla de resultados **las decide el servidor**, no la
pantalla: qué datos se pueden enseñar de un equipo depende de cómo tenga
configurados sus campos cada organización.

### 3.3 Crear y completar una tarea

Las tareas **solo existen dentro de carpetas de tipo Equipo**. En una carpeta
normal no aparece el panel de tareas.

1. Entra a la carpeta del equipo. Debajo del contenido aparece **«Tareas del
   equipo»**, con un contador de pendientes.
2. Escribe el título en **«Nueva tarea…»** y pulsa **«Añadir»**. Con eso basta.
3. Si quiere más campos, **«Con detalle…»** abre un formulario con: título,
   descripción, estado (Pendiente / En proceso / Completada), prioridad
   (opcional), fecha y responsable.
   - El responsable se elige de una lista de cuentas activas con acceso a Fotos.
     Esa lista **no muestra correos** ni incluye clientes.
4. **Para completar:** la casilla ☐ a la izquierda de cada tarea. Un clic y
   queda marcada, guardando **quién** la completó y **cuándo**.
5. Reabrirla borra esa marca — no se conserva «completada por Ana el martes» en
   una tarea que vuelve a estar pendiente; para eso está el historial.
6. Cada tarea tiene su propio hilo de comentarios y sus propias fotos.

**Borrar una tarea que tiene fotos se rechaza**, para que no se lleve la
evidencia por delante. Primero se borran las fotos.

### 3.4 Comentar

Se puede comentar en **cuatro sitios**: carpeta, tarea, álbum y foto.

- **En una carpeta:** sección al pie, titulada **«Comentarios de la carpeta»**
  (o «Comentarios del equipo» si la carpeta representa un equipo).
- **En una tarea:** dentro de la tarea.
- **En un álbum:** un botón plegable en la cabecera del álbum que dice
  **«Comentar»** o «N comentario(s)». Va plegado a propósito: doce álbumes
  abiertos serían doce hilos compitiendo con las fotos.
- **En una foto:** dentro del visor, al abrir la foto.

En todos: se escribe en **«Escribe un comentario…»** y se publica con
**«Comentar»**. Cada comentario muestra autor y fecha.

**Editar y borrar:** solo **el autor** puede editar su propio comentario —ni
siquiera el Administrador Global puede reescribir lo que dijo otro—. Borrar sí
puede el autor (con Edición) o quien administre la carpeta (con Acceso Total).

⚠️ **Comentar exige permiso de Edición, no de Lectura.** Un comentario queda en
el expediente de la obra, así que ponerlo es escribir. Un cliente con Lectura
puede leerlos pero no añadir.

### 3.5 Crear un álbum y subirle fotos

Un álbum agrupa fotos de un momento — «Estado inicial» antes de intervenir un
equipo, por ejemplo.

**Crear el álbum vacío y llenarlo después** (cuando la estructura se planea antes
de ir a obra):

1. En la carpeta, pulsa **«Nuevo álbum»**.
2. Pide **nombre** (obligatorio aquí), descripción opcional y **«Fecha del
   trabajo»** — que es el día que documenta, no el de la subida.
3. Con **«Crear álbum»** queda creado y vacío.

**Subir fotos directamente** (se crea el álbum solo):

1. En la carpeta, el panel de subida: elige los archivos, opcionalmente escribe
   una **«Descripción del lote (opcional)»** —que se aplica a todas las fotos de
   esa subida— y pulsa **«Subir foto(s)»**.
2. Límites, escritos en la propia pantalla: **10 fotos por subida y 15 MB cada
   una**, en JPEG, PNG, HEIC o WebP.

**En la galería**, cada álbum muestra su nombre, quién subió, la fecha y el
número de fotos. El **lápiz** abre **«Editar álbum»** (nombre, descripción,
fecha) y, **si el álbum está vacío**, también permite **«Eliminar»**. Si tiene
fotos, ese botón no aparece: se borran las fotos y el álbum se retira solo con
la última.

Al abrir una foto se ve a tamaño grande, con **«Descargar»** y su hilo de
comentarios. Si hay muchas, **«Cargar más fotos»** trae la siguiente tanda.

**Filtros de la galería:** por fecha (**«Desde»** / **«Hasta»**) y por autor.
⚠️ El filtro de autor **solo aparece si hay más de una persona** que haya subido
en esa carpeta — en obra lo normal es que suba una sola, y un desplegable con
una única opción es ruido.

### 3.6 Captura rápida y bandeja de pendientes

Es la puerta del supervisor en campo, y está **en el menú lateral** como **«Fotos
pendientes»** — no escondida dentro de una carpeta.

**Subir con destino:**

1. Entra a **«Fotos pendientes»**. Arriba, **«1 · A dónde van»**.
2. Elige **«Proyecto»** y luego **«Estructura o equipo»**. Si la carpeta elegida
   es un equipo, se habilita además elegir **tarea**.
3. **«2 · Las fotos»**: en el celular, el selector **abre la cámara
   directamente**.
4. Sube. Listo.

⚠️ **Solo baja un nivel a propósito.** Lo que no esté a un paso se sube sin
asignar y se clasifica luego — precisamente para no repetir «entrar a carpeta →
crear subcarpeta → buscar equipo → buscar tarea».

**Subir sin asignar y clasificar después:**

1. En la misma pantalla, sube sin elegir destino (**«Sin asignar»**).
2. Las fotos caen en **«Fotos pendientes de organizar»**, con su contador.
3. Para clasificarlas: **marca las fotos** que van juntas, elige el destino
   arriba y pulsa **«Clasificar aquí»**. Se pueden hacer varios lotes: 20 fotos
   a una tarea, 15 a un álbum, 15 a otra.
4. Cuando no queda nada, la bandeja dice **«Nada pendiente»**.

Recuerda: **esa bandeja es privada**. Nadie más la ve.

### 3.7 Compartir una carpeta e invitar

Requiere **Acceso Total** sobre esa carpeta (o ser su propietario).

1. En la carpeta, pulsa **«Compartir»**.
2. El diálogo pide, en este orden: **«Correo»**, **«Nombre»** (opcional),
   **«Permiso»** (Lectura / Edición / Acceso total) y opcionalmente **«Caduca
   el»**.
3. Debajo, la lista de **«Carpetas»** permite marcar varias a la vez —se puede
   compartir más de una carpeta en el mismo gesto, con un buscador
   (**«Buscar carpeta»**) si hay muchas—.
4. Pulsa **«Compartir»**.

**Lo que pasa después lo decide el sistema, no quien comparte:**

- **Si el correo ya tiene cuenta**, se le da acceso directo. No hay invitación.
- **Si el correo es desconocido**, se crea una **invitación** con un enlace de un
  solo uso y **7 días** de vigencia (o los que se hayan puesto en «Caduca el»).

⚠️ **«Caduca el» caduca el ENLACE de invitación, no el acceso.** Una vez que la
persona entra, su acceso no vence solo.

**Ver y administrar quién tiene acceso** — requiere Acceso Total, porque son
correos de terceros:

- La lista muestra cada colaborador con su permiso, y las invitaciones
  pendientes.
- **«Reenviar»** genera un enlace nuevo e invalida el anterior, y renueva el
  plazo. **No recalcula el permiso**: el grado viaja en la invitación desde que
  se envió.
- **«Cancelar»** anula una invitación pendiente. **«Quitar»** revoca el acceso
  de alguien que ya entró.

**Restringir una subcarpeta concreta:** se cambia el permiso de esa persona en
esa subcarpeta a **«Sin acceso»**. Sirve para el caso «te comparto Proyecto A
entero, pero Inspecciones no». La subcarpeta **desaparece de su listado** — no
aparece bloqueada.

### 3.8 De la invitación a que el cliente vea su carpeta

1. Se comparte con un correo desconocido (paso anterior).
2. El sistema genera el enlace `…/invitacion/{token}`.
3. **⚠️ Hoy ese correo NO se envía**, porque falta la clave del servicio de
   correo (ver sección 5). El diálogo **muestra el enlace en pantalla con un
   botón «Copiar»** para hacérselo llegar por otro medio.
4. El cliente abre el enlace y ve la pantalla de bienvenida a la invitación.
5. Si no tiene cuenta, crea su contraseña ahí. **Nadie de HVC le crea ni le
   comparte una contraseña.**
6. Al aceptar, se crea su cuenta y se le vincula automáticamente la carpeta con
   el permiso que se había fijado.
7. Entra a **`/portal`** y ve **«Compartido conmigo»** con su carpeta, y nada más.
8. Navega subcarpetas, tareas, álbumes, fotos y comentarios. No ve ningún botón
   de administración.

El enlace es de **un solo uso** y caduca. Reenviarlo invalida el anterior.

### 3.9 Exportar

Hay **dos exportaciones**, cada una en Excel y en PDF, con los botones
**«Excel»** y **«PDF»**:

| Qué se exporta | Dónde está | Quién puede |
|---|---|---|
| **Listado de tareas** de una carpeta | Junto al título «Tareas del equipo» | Quien vea la carpeta |
| **Historial del módulo** | Administración de Fotos → Auditoría | Solo Administrador Global |

Detalles que importan:

- **Exporta lo que estás viendo.** Si filtraste las tareas por estado o la
  auditoría por acción y fechas, el archivo sale con ese mismo filtro.
- El botón de tareas **solo aparece si hay tareas** —un archivo vacío no le sirve
  a nadie— y **nunca en el portal del cliente**.
- El historial se exporta **por páginas** (tope de 200 eventos), y el propio
  archivo lo dice en su cabecera: «Eventos en este archivo» y «Quedan más». Para
  un periodo concreto se acota con las fechas.

⚠️ **No existe exportación de fotos ni de álbumes.** No se pueden descargar
varias fotos de golpe ni un álbum en ZIP: la descarga es **de una foto cada
vez**.

### 3.10 Importar estructura por Excel

Sirve para arrancar una obra entera de una vez desde la hoja del planificador.
El Excel **no lleva fotos**: define la estructura.

1. Dentro de la carpeta donde quiere crear todo, pulsa **«Importar Excel»** —está
   en el bloque **«Crear estructura»**, en el cuerpo de la pantalla.
2. Elige el archivo. Columnas: Carpeta, Subcarpeta, Equipo, Tipo, Nombre,
   Descripción.
3. El sistema lee el archivo y muestra una **vista previa** de lo que va a crear,
   con los errores detectados y las filas que se saltarán.
4. **Si algo ya existe**, lo avisa y deja elegir por cada caso: **Crear**,
   **Omitir** o **Actualizar**. Lo que no se decida **se omite** —ante la duda,
   no duplicar—.
5. Confirma con **«Importar»**.

⚠️ **Que una carpeta del camino ya exista NO es un conflicto**: se reutiliza. El
conflicto es que la tarea concreta ya esté en ese equipo.

⚠️ **La columna «Equipo» crea una carpeta corriente, no enlazada al catálogo de
Gestión de Equipos.** El código de equipo es único por organización y la hoja no
dice de qué organización es, así que enlazarlo «cuando el código coincida» haría
que el mismo archivo importara distinto según el estado del catálogo. Para
enlazar de verdad hay que usar **«Añadir equipo»** (3.2), que sí obliga a elegir
organización.

Requiere permiso de **Edición** sobre la carpeta destino — no hace falta ser
administrador.

### 3.11 Crear y aplicar una plantilla de estructura

Una plantilla es un molde pequeño que se estampa muchas veces: por ejemplo
«Inspección de equipo» con sus tareas habituales.

**Crear una** — solo Administrador Global:

1. Menú lateral → **«Administración de Fotos»** → pestaña de plantillas.
2. **«Crear plantilla»**. Pide **«Nombre de la plantilla»** y su descripción.
3. Se le añaden elementos con **«Añadir elemento…»**: carpetas, tareas y álbumes,
   con su nombre y descripción.
4. Las plantillas se pueden desactivar sin borrarlas.

**Aplicarla** — cualquiera con Edición en la carpeta:

1. Dentro de la carpeta, en el bloque **«Crear estructura»**, el desplegable
   **«Crear desde plantilla…»**.
2. Elige la plantilla y se estampa una copia dentro.

⚠️ **Ese desplegable solo aparece si existe al menos una plantilla activa.** En
un sistema recién puesto en marcha —o si todas están desactivadas— el bloque
«Crear estructura» muestra únicamente «Importar Excel», y no hay ninguna pista de
que las plantillas existan. Comprobado en pantalla.

⚠️ **Las tareas de la plantilla solo se crean si la carpeta destino es un
equipo.** Las que no caben se **omiten y se avisa con el motivo**, en vez de
fallar entera: una plantilla mixta sigue sirviendo para crear sus carpetas y
álbumes.

⚠️ **Aplicar copia.** La estructura resultante vive por su cuenta: cambiar la
plantilla después no toca lo ya creado, y nada recuerda de qué plantilla salió.

### 3.12 Ver el historial

**Historial de una carpeta:** disponible para quien tenga **Lectura** sobre ella
— es la pregunta de quien trabaja dentro: «¿qué ha pasado aquí?».

**Historial de todo el módulo:** menú → **«Administración de Fotos»** → pestaña
de auditoría. **Solo Administrador Global.**

Se filtra por **«Acción»**, **«Desde»** y **«Hasta»**, y la tabla muestra
**«Cuándo»**, **«Quién»**, **«Qué»**, **«Dónde»** y **«Acción»**. Si no hay nada,
dice «Sin eventos».

Se registran, entre otras: crear/editar/eliminar carpeta, mover, archivar y
reabrir, crear/completar/reabrir/eliminar tarea, subir y eliminar foto,
clasificar, crear álbum, compartir, cambiar permiso, revocar acceso, enviar y
aceptar invitación, importar Excel, crear desde plantilla, y equipo creado desde
Fotos.

La **dirección IP** se guarda solo en las acciones sensibles —compartir, cambiar
permiso, revocar y aceptar invitación—; en el resto no, porque sería ruido con
coste de privacidad.

⚠️ **Al eliminar una carpeta se pierde su historial.** El registro de la propia
eliminación sobrevive, pero «quién la creó» y «quién la compartió» desaparecen.
Es aceptable hoy porque una carpeta solo se puede borrar vacía, así que se pierde
la historia de algo que no llegó a tener contenido.

---

## 4. RELACIÓN CON OTROS MÓDULOS

### 4.1 Gestión de Equipos — es el MISMO equipo

Cuando se crea una carpeta de tipo Equipo, **no se copia** el equipo: se
referencia el que ya está en el catálogo de Gestión de Equipos.

**La relación va en un solo sentido.** Fotos lee del catálogo y nunca escribe en
él, con una única excepción: el atajo **«Registrar y elegir»**, que crea el
equipo en el catálogo. Editar o eliminar equipos sigue siendo exclusivo del
SuperAdmin desde su propio módulo.

**Qué pasa si el equipo no existe:** aparece la opción de registrarlo ahí mismo,
sin salir de Fotos, pidiendo lo mínimo (código y ubicación). Queda constancia en
el historial de que ese equipo nació desde Fotos.

**Qué pasa si alguien intenta dar de baja un equipo que tiene fotos:** el sistema
lo **impide** con un mensaje claro. No se lleva las fotos por delante.

⚠️ **Si no hay organizaciones o equipos cargados en Gestión de Equipos, el
selector aparece vacío** y no se puede enlazar nada. Fotos depende de ese
catálogo para esta función.

### 4.2 Usuarios y permisos — el sistema general

Fotos no tiene usuarios propios. Usa las cuentas del sistema y su tabla de
permisos por módulo; el nivel global de Fotos es una columna más de ahí.

Consecuencias:

- Dar o quitar el módulo a alguien se hace desde **Usuarios**, no desde Fotos.
- **Quitar el módulo surte efecto de inmediato**, en la siguiente acción: los
  permisos se leen de la base en cada petición, no del token de sesión.
- Los **clientes externos** son cuentas del mismo sistema con un rol distinto.
  No tienen filas de permisos por módulo, y por eso solo entran donde
  explícitamente se les permite: el portal.

### 4.3 Correo — servicio compartido

Las invitaciones usan el **mismo servicio de correo que el módulo de Costos**.
No hay una versión aparte para Fotos.

⚠️ **Hoy no está configurado** (falta la clave del proveedor). El sistema **no
finge que envió**: devuelve que no se envió, con el motivo, y el diálogo de
compartir muestra el enlace para copiarlo a mano. Ver sección 5.

### 4.4 Exportaciones — generador compartido

Los archivos Excel y PDF los produce el **mismo generador que usan Equipos y
Costos**. Fotos no tiene el suyo.

Consecuencia buena: cualquier mejora ahí beneficia a los tres módulos. Ya pasó
—se corrigió el cálculo del alto de fila del PDF, que pisaba texto en celdas de
dos líneas—.

### 4.5 Almacenamiento de imágenes

Las fotos **no se guardan en el servidor de la aplicación** sino en un
almacenamiento externo en la nube, en un depósito privado con enlaces firmados de
vencimiento corto.

Cada foto se procesa al subirla: se reduce, se convierte a un formato más ligero,
se genera una miniatura, se respeta la orientación de la cámara y **se borran los
metadatos** —incluida la ubicación GPS, que los celulares incrustan por defecto—.
La fecha de captura sí se conserva, leyéndola antes de limpiar.

⚠️ Si ese almacenamiento no está configurado o no responde, **no se pueden subir
ni ver fotos**, aunque el resto del módulo funcione.

### 4.6 El menú lateral y el armazón de la aplicación

Fotos comparte el menú, el diseño y las pantallas de acceso con el resto del
sistema. No tiene navegación propia salvo el portal del cliente, que sí es un
armazón aparte, sin menú lateral.

---

## 5. LO QUE FALTA O QUEDÓ INCOMPLETO

Estado de las **30 secciones** de la especificación original, una por una.

### 5.1 Tabla de estado por sección

| § | Sección | Estado | Detalle |
|---|---|---|---|
| 1 | Objetivo del módulo | **Completo** | Todo lo enumerado existe |
| 2 | Dos sistemas de acceso separados | **Completo** | Nivel global y permiso por carpeta, sin mezclarse |
| 3 | Roles y niveles globales | **Completo** | Los tres niveles + «sin nivel» |
| 4 | Supervisores | **Completo** | Incluida la regla de no otorgar más de lo que se tiene |
| 5 | Permisos sobre carpetas | **Completo** | Lectura / Edición / Acceso total |
| 6 | Propietario de carpeta | **Completo** | Se registra y da Acceso Total sobre lo propio |
| 7 | Herencia de permisos | **Completo** | Incluida la restricción con «Sin acceso» |
| 8 | Visualización del cliente | **Completo** | Verificado: no ve otras carpetas ni como bloqueadas |
| 9 | Invitaciones | **Parcial** | Todo el flujo funciona salvo **el envío del correo** (5.2) |
| 10 | Compartir carpetas | **Parcial** | Falta parte de la información de la lista (5.3) |
| 11 | Estructura de carpetas | **Parcial** | Falta **mover** y no hay papelera (5.4, 5.5) |
| 12 | Equipos | **Completo** | Resuelto enlazando al catálogo existente |
| 13 | Tareas | **Completo** | Los campos, los tres estados y el check rápido |
| 14 | Comentarios | **Completo** | En las cuatro entidades, incluida la foto |
| 15 | Fotografías | **Parcial** | Falta **arrastrar y soltar** y descarga múltiple (5.6) |
| 16 | Álbumes | **Completo** | Con nombre, descripción y fecha |
| 17 | Captura rápida | **Completo** | Con cámara directa en el celular |
| 18 | Bandeja de pendientes | **Completo** | Con selección y clasificación por lotes |
| 19 | Importación por Excel | **Parcial** | Funciona; el «Equipo» no se enlaza al catálogo (3.10) |
| 20 | Plantillas | **Completo** | Crear, editar, desactivar y aplicar |
| 21 | Experiencia de usuario | **Parcial** | Faltan Favoritos y Papelera, marcados opcionales (5.5) |
| 22 | Vista del cliente | **Completo** | Verificado con una cuenta de cliente real |
| 23 | Trazabilidad | **Completo** | Las trece acciones, con IP donde corresponde |
| 24 | Seguridad | **Completo** | Validado en servidor; probado cambiando identificadores |
| 25 | Modelo de permisos | **Completo** | Resolución centralizada en un solo sitio |
| 26 | Reglas resumen | **Completo** | Las 18 se cumplen |
| 27 | Flujo de referencia | **Completo** | Los 26 pasos se pueden ejecutar |
| 28 | Prioridades | **Completo** | — |
| 29 | Alcance de implementación | **Parcial** | Todo salvo lo listado abajo |
| 30 | Reglas del proyecto | **Completo** | Costos intacto; transversales reutilizados |

### 5.2 Correo de invitación — existe pero depende de configuración externa

**Qué es:** enviar automáticamente el enlace de invitación al correo del cliente.

**Estado:** el código está completo y probado, pero **falta la clave del
proveedor de correo**. Hoy no se envía nada.

**Qué se ve en pantalla:** el diálogo de compartir muestra el enlace con un botón
**«Copiar»**, y el sistema informa de que no se envió y por qué. **No dice
«enviado» sin haber enviado** — decirlo dejaría a alguien esperando una respuesta
imposible.

**Qué hace falta:** dar de alta la clave del servicio y un buzón de un dominio
verificado. Es configuración, no programación.

### 5.3 Lista de colaboradores — información incompleta

**Qué pide la especificación:** que la lista muestre usuario, correo, permiso,
**fecha de acceso**, **quién invitó** y estado.

**Qué hay:** usuario, correo, permiso y estado, con sus acciones (Reenviar,
Cancelar, Quitar).

**Qué falta:** **la fecha en que se concedió el acceso y quién lo concedió** no
se muestran en pantalla. El dato de quién concedió sí se guarda; simplemente no
se pinta.

### 5.4 Mover carpetas — el servidor sabe, pero no hay botón

**Qué es:** cambiar una carpeta de sitio dentro del árbol.

**Estado: el servidor lo implementa completo** —con sus comprobaciones de permiso
en el destino, de nombres repetidos y de arrastrar consigo los accesos
compartidos—, y **no existe ningún botón que lo llame**.

Es el caso más claro de «función construida sin puerta». Los botones de una
tarjeta de carpeta son renombrar, compartir, archivar y eliminar; **no hay
«Mover»**.

### 5.5 Papelera y Favoritos — no existen

**Qué son:** la especificación los menciona en el panel lateral, **marcándolos
como opcionales**.

**Estado: no existe ninguna opción.** Ni botón, ni pantalla, ni menú.

- En lugar de papelera está **archivar**, que deja la carpeta en solo lectura sin
  borrarla y se puede reabrir. Cubre el «no lo pierdas por accidente», pero **no
  hay restaurar lo eliminado**: lo que se borra, se borra.
- Favoritos no tiene sustituto. Lo más parecido es **«Recientes»**.

### 5.6 Fotos: arrastrar y soltar, y descarga múltiple

**Arrastrar y soltar** archivos sobre la pantalla para subirlos: **no existe**.
Hay que usar el selector de archivos. La selección múltiple sí funciona, desde el
propio selector.

**Descargar varias fotos a la vez o un álbum completo**: **no existe**. La
descarga es de una foto cada vez, desde el visor.

**Vista previa antes de subir:** existe la lista de archivos elegidos con la
opción de **«Quitar»** alguno, pero **no se ven miniaturas** de lo que se va a
subir.

### 5.7 Menú de Administración — visible solo para SuperAdmin

**Qué pasa:** el enlace **«Administración de Fotos»** del menú lateral solo lo ve
el SuperAdmin del sistema.

**Consecuencia:** un **Administrador Global de Fotos que no sea SuperAdmin no
tiene cómo llegar a esa pantalla desde el menú**, aunque el servidor sí le
permite entrar si escribe la dirección. Es una inconsistencia entre lo que el
menú ofrece y lo que el permiso concede.

### 5.8 Header superior — decidido que NO se hace

**Qué sería:** una franja superior con migas de navegación, buscador global,
notificaciones y menú de usuario.

**Estado: descartado deliberadamente.** No es un olvido:

- El menú lateral ya resuelve navegación, perfil, rol y cerrar sesión, y no tiene
  sentido duplicarlo arriba.
- Las migas ya existen dentro de cada pantalla.
- El buscador global y las notificaciones **no existen en el sistema**:
  montarlos sería inventar funcionalidad.

### 5.9 Otros puntos menores

- **Ordenar y filtrar carpetas:** ordenar sí (cuatro criterios). Filtrar carpetas
  por otros criterios, no; el buscador cubre el caso.
- **Estados de las tareas:** los tres pedidos. La prioridad es opcional y se
  puede dejar vacía.
- **Fecha de captura de la foto:** se conserva la del archivo original.
- **Notificar al usuario existente** cuando se le comparte algo (§9): **no
  ocurre**. Se le concede el acceso en silencio y lo descubre al entrar. Depende
  del mismo correo sin configurar.

---

## 6. NAVEGACIÓN — qué ve cada rol

Al entrar al sistema, quien tiene Fotos ve en el menú lateral un grupo **«Fotos»**
que se despliega solo si la ruta actual pertenece a él.

| Entrada del menú | Sin nivel global | Lectura Global | Editor Global | Admin Global | Cliente |
|---|---|---|---|---|---|
| **Carpetas** | Sí | Sí | Sí | Sí | — |
| **Mis carpetas** | Sí | **No** | **No** | **No** | — |
| **Compartido conmigo** | Sí | **No** | **No** | **No** | — |
| **Fotos pendientes** | Sí | Sí | Sí | Sí | — |
| **Recientes** | Sí | Sí | Sí | Sí | — |
| **Administración de Fotos** | No | No | No | **Solo si es SuperAdmin** (5.7) | — |

**Por qué «Mis carpetas» y «Compartido conmigo» se ocultan a quien tiene nivel
global:** a esa persona el sistema le devuelve **una sola** sección, «Todas las
carpetas», porque llega a todo por su nivel. Partírsela en dos le pondría en
«Compartido conmigo» carpetas que nadie le compartió, y eso sería mentira. Las
dos direcciones siguen existiendo y, si entra por la barra del navegador, ve una
explicación en vez de una pantalla en blanco.

**Dónde aterriza cada uno:**

- **Cualquier usuario interno con Fotos** → el explorador de carpetas.
- **Cliente externo** → el portal, directamente en **«Compartido conmigo»**.
- Si la cuenta no tiene ningún módulo asignado, ve un aviso explicándolo.

---

## 7. TABLA RESUMEN

| Funcionalidad | Quién la usa | Estado | ¿Depende de otro módulo? |
|---|---|---|---|
| Ver carpetas y navegar | Todos | Completo | No |
| Buscar en todo el árbol | Todos | Completo | No |
| Ordenar carpetas | Todos | Completo | No |
| Crear carpeta / subcarpeta | Edición o Editor Global | Completo | No |
| Crear carpeta de primer nivel | Editor Global o superior | Completo | No |
| Renombrar carpeta | Edición | Completo | No |
| **Mover carpeta** | — | **Falta el botón** (5.4) | No |
| Archivar / reabrir | Admin Global | Completo | No |
| Eliminar carpeta (solo si está vacía) | Acceso Total | Completo | No |
| **Papelera / restaurar** | — | **No existe** (5.5) | No |
| **Favoritos** | — | **No existe** (5.5) | No |
| Recientes | Todos | Completo | No |
| Carpeta de tipo Equipo | Edición | Completo | **Sí — Gestión de Equipos** |
| Registrar equipo desde Fotos | Editor Global o superior | Completo | **Sí — Gestión de Equipos** |
| Crear / editar tarea | Edición | Completo | No |
| Completar tarea con un clic | Edición | Completo | No |
| Asignar responsable | Edición | Completo | **Sí — Usuarios** |
| Comentar (carpeta, tarea, álbum, foto) | Edición | Completo | No |
| Editar comentario propio | Solo el autor | Completo | No |
| Crear álbum | Edición | Completo | No |
| Subir fotos | Edición | Completo | **Sí — almacenamiento en la nube** |
| **Arrastrar y soltar** | — | **No existe** (5.6) | No |
| Galería, visor y filtros | Lectura | Completo | No |
| Descargar foto (de una en una) | Lectura | Completo | **Sí — almacenamiento** |
| **Descarga múltiple / álbum en ZIP** | — | **No existe** (5.6) | No |
| Captura rápida | Edición | Completo | No |
| Bandeja de pendientes (privada) | Cada quien la suya | Completo | No |
| Clasificar por lotes | Edición | Completo | No |
| Compartir carpeta | Acceso Total o propietario | Completo | No |
| Invitar por correo | Acceso Total o propietario | **Parcial — no envía** (5.2) | **Sí — servicio de correo** |
| Lista de colaboradores | Acceso Total | **Parcial — faltan datos** (5.3) | No |
| Cambiar permiso / revocar | Acceso Total | Completo | No |
| Restringir subcarpeta | Acceso Total | Completo | No |
| Aceptar invitación y crear cuenta | Cliente | Completo | **Sí — Usuarios** |
| Portal del cliente (solo lectura) | Cliente | Completo | No |
| Importar estructura por Excel | Edición | **Parcial — no enlaza equipos** (3.10) | No |
| Crear plantilla | Admin Global | Completo | No |
| Aplicar plantilla | Edición | Completo | No |
| Historial de una carpeta | Lectura | Completo | No |
| Historial del módulo | Admin Global | Completo | No |
| Exportar tareas (Excel/PDF) | Lectura | Completo | **Sí — generador compartido** |
| Exportar historial (Excel/PDF) | Admin Global | Completo | **Sí — generador compartido** |
| **Exportar fotos o álbumes** | — | **No existe** (3.9) | No |
| Acceso a Administración desde el menú | Admin Global | **Parcial — solo SuperAdmin** (5.7) | **Sí — Usuarios** |
| **Header superior** | — | **Descartado a propósito** (5.8) | No |

---

## 8. LO QUE HAY QUE RESOLVER, POR ORDEN

1. **Configurar el correo.** Es lo único que bloquea un flujo completo: sin él,
   cada invitación exige copiar el enlace a mano. Es configuración, no
   desarrollo.
2. **Poner el botón «Mover».** El servidor ya lo hace todo; falta la puerta.
3. **Corregir el acceso a Administración de Fotos** para que un Administrador
   Global que no sea SuperAdmin lo vea en el menú.
4. **Completar la lista de colaboradores** con la fecha y quién concedió el
   acceso.
5. Lo demás —arrastrar y soltar, descarga múltiple, papelera, favoritos— son
   comodidades que la especificación marcaba como opcionales o secundarias.
