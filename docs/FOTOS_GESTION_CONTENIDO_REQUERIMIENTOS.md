# Módulo Fotos — Gestión completa de contenido (Álbumes, Fotos, Tareas, Comentarios)

> Documento de **requerimientos funcionales**, no de diseño. Describe QUÉ debe
> poder hacerse, no CÓMO debe verse. El diseño y los componentes se arman
> después, sobre esta base. Todo debe quedar **configurable/escalable**, no
> con campos fijos que luego haya que rehacer.

---

## Contexto — el problema detectado

Al usar el módulo hoy, varias acciones básicas de gestión no existen o son
incompletas:

- Se puede **crear** un álbum, pero después no se puede **agregar** fotos
  nuevas, ni **eliminar** fotos ya subidas, ni **mover** fotos de un álbum a
  otro o a una carpeta distinta.
- Las tareas no tienen una forma clara de asociar evidencia fotográfica de
  "antes y después" — hoy la foto se sube suelta, sin ese contexto.
- Los comentarios no están disponibles de forma consistente para todos los
  colaboradores de una carpeta.

**El objetivo de este documento:** que CADA pieza de contenido (Álbum, Foto,
Tarea) tenga el ciclo de vida completo — crear, ver, editar, agregar/quitar
lo que le pertenece, mover, eliminar — y que los comentarios funcionen de
forma consistente en todos lados.

---

## 1. ÁLBUM — ciclo de vida completo

### 1.1 Qué ya existe (según la auditoría previa)
- Crear álbum vacío (nombre, descripción, fecha).
- Subir fotos directamente a una carpeta (crea álbum implícito).
- Editar nombre/descripción/fecha del álbum.
- Eliminar álbum, solo si está vacío.

### 1.2 Qué debe agregarse

| Acción | Descripción | Quién |
|---|---|---|
| **Agregar fotos a un álbum ya existente** | Desde dentro del álbum (no solo al crearlo), poder subir fotos nuevas que se sumen a las que ya tiene. | Edición |
| **Eliminar una foto específica del álbum** | Sin tener que eliminar el álbum entero. Si esa foto era la última, el álbum queda vacío (no se borra solo, salvo que el usuario decida borrarlo aparte). | Edición sobre la foto propia; Acceso Total sobre cualquiera |
| **Mover una foto** | De un álbum a otro, de un álbum a "sin álbum" dentro de la misma carpeta, o a una carpeta distinta. La foto conserva su historial (quién la subió, cuándo). | Edición en origen y destino |
| **Reordenar fotos dentro del álbum** | **No, por ahora.** El orden por fecha de subida ya responde a "qué pasó primero" — que es justo la trazabilidad que el módulo prioriza. Reordenar manualmente añade una interacción (arrastrar y soltar, guardar posición) que no aporta a los objetivos declarados del módulo (documentar rápido, quedar constancia). Se reconsidera solo si aparece un caso real donde el orden cronológico no sirva. | — |
| **"Duplicar" un álbum completo** | **No como función nueva — se resuelve con lo que ya existe.** El módulo ya tiene Plantillas para exactamente este propósito: reutilizar una estructura repetible. En vez de "duplicar álbum", la acción correcta es **"Guardar como plantilla"** desde un álbum ya armado — convierte su estructura (nombre, tipo de elementos) en una plantilla reutilizable, sin duplicar fotos reales (que no tendría sentido: las fotos son evidencia de un momento específico, no una plantilla). Esto reutiliza el sistema de plantillas ya construido en vez de crear un componente nuevo — menos código, mismo resultado. | Admin Global (igual que crear plantilla) |

### 1.3 Reglas que deben mantenerse
- Un álbum eliminado no debe llevarse comentarios de otras entidades por
  error (solo los suyos propios).
- Mover una foto debe validar permiso tanto en el álbum/carpeta de origen
  como en el de destino — no basta con tener permiso en uno solo.
- Todo movimiento y eliminación debe quedar en el historial (ya existe este
  patrón en el resto del módulo, debe respetarse aquí también).

---

## 2. FOTO — ciclo de vida completo

### 2.1 Qué ya existe
- Subir (una o varias), con límites de tamaño y formato.
- Ver en galería y en el visor grande.
- Descargar (de una en una).
- Comentar dentro del visor.
- Eliminar (propia con Edición, ajena con Acceso Total).

### 2.2 Qué debe agregarse
| Acción | Descripción |
|---|---|
| **Mover una foto** | Ver 1.2 — es la misma función, aplicada desde la foto individual, no solo desde el álbum. |
| **Editar la descripción de una foto ya subida** | **Sí.** Es un error humano común (descripción con typo, o escrita apurado desde el celular en campo) y corregirlo no compromete nada — igual que ya se permite corregir el lugar/fecha de un requerimiento en Costos, con su rastro en el historial (quién cambió qué). Editable con permiso de Edición, siempre auditado. |
| **Reemplazar el archivo de una foto** (mismo registro, imagen nueva) | **No.** Esto va en contra del objetivo #2 del módulo: *"que quede constancia de quién hizo qué y cuándo"*. Una foto es evidencia — si se pudiera "reemplazar en silencio" el archivo detrás de un registro ya existente, alguien podría cambiar la prueba fotográfica de una inspección sin dejar rastro claro de que la imagen original era otra. La forma correcta de corregir "subí la foto equivocada" es **eliminarla y subir la correcta** — ambas acciones ya quedan en el historial por separado, preservando la trazabilidad real. |

---

## 3. TAREA — evidencia fotográfica "antes y después"

### 3.1 El problema actual
Hoy una tarea puede tener fotos colgadas, pero sin ningún contexto de **qué
momento representa esa foto** dentro del trabajo (antes de intervenir,
durante, después de terminar).

### 3.2 Cómo debe funcionar — CONFIGURABLE, no campos fijos

**Importante, tal como lo pediste:** esto NO debe ser un campo rígido tipo
"Foto Antes" y "Foto Después" grabados en la base de datos como dos casillas
obligatorias. Debe ser un **sistema de etiquetas o categorías de evidencia**,
configurable, para que:

- Una tarea simple pueda llevar **una sola foto**, sin etiqueta, si así lo
  decide quien la sube.
- Una tarea más completa pueda llevar **varias fotos**, cada una marcada con
  una etiqueta libre (ej. "Antes", "Después", "Detalle del daño",
  "Repuesto instalado") — y esas etiquetas no deben estar fijas en el
  código, sino ser texto libre o un catálogo editable (mismo patrón que ya
  existe para "Tipo de mantenimiento" o "Tipo de requerimiento" en otros
  módulos: una lista administrable, no un enum cerrado).

**Ejemplo de flujo deseado:**
1. Entro a una tarea.
2. Subo una foto y, opcionalmente, le pongo una etiqueta de qué representa
   (o la dejo sin etiqueta si no aplica).
3. Puedo subir varias fotos con etiquetas distintas a la misma tarea.
4. Puedo ver las fotos de la tarea agrupadas por etiqueta, o en orden simple
   si ninguna tiene etiqueta.

### 3.3 Qué debe agregarse a la tarea, en general
| Acción | Descripción |
|---|---|
| **Etiqueta opcional por foto de tarea** | Texto libre o catálogo configurable, nunca obligatorio |
| **Eliminar una foto de la tarea** | Sin tener que borrar la tarea |
| **Ver todas las fotos de la tarea juntas**, agrupadas por etiqueta si las tienen | — |

---

## 4. COMENTARIOS — acceso consistente para todos los colaboradores

### 4.1 El problema
Hoy, comentar exige permiso de **Edición**. Alguien con solo **Lectura**
(por ejemplo, un cliente, o un colaborador de solo consulta) no puede
comentar en absoluto.

### 4.2 Lo que pides
Que el comentario esté disponible para **todos los colaboradores** de la
carpeta — no solo quienes tienen permiso de escritura sobre el contenido.

### 4.3 Decisión final — confirmada

Comentar se abre a **cualquiera que tenga acceso a esa carpeta o equipo**,
sin importar su nivel de permiso — **incluido el cliente en el portal**.

⚠️ **Esto es un cambio de alcance real, no cosmético.** Hoy el portal del
cliente no tiene NINGUNA ruta de escritura — es la primera vez que se le
abre una. Implica:

- Nueva ruta de escritura en el portal (hasta ahora inexistente).
- El cliente necesita ver también los comentarios de otros (colaboradores
  de HVC) en esa misma carpeta, no solo los suyos — porque "acceso a la
  carpeta" incluye ver todo el hilo.
- Hay que decidir si el supervisor recibe algún aviso cuando el cliente
  comenta (para no perderse una pregunta del cliente). Si no hay
  notificaciones todavía en el sistema, el supervisor solo lo vería si
  vuelve a entrar a esa carpeta — vale la pena que lo sepas antes de que
  alguien asuma que "comentó y ya se enteraron".

**Regla final:** comentar exige solo tener algún tipo de acceso a la
carpeta (cualquier nivel, incluida Lectura y el portal del cliente). Ver,
editar el propio, borrar según el permiso de siempre (Acceso Total o
autor).

### 4.4 Confirmado — un solo hilo, sin separación interna/cliente

Los comentarios son, a propósito, el canal de comunicación entre HVC y el
cliente — no hace falta un tipo "interno" aparte. **Regla operativa para el
equipo de HVC (no técnica, de uso):** cualquier nota que un supervisor
escriba en una carpeta compartida con un cliente, ese cliente la va a leer.
Vale la pena que quede dicho en la capacitación del equipo, no solo en el
código.

---

## 5. CAMBIO DE ARQUITECTURA — Fotos independiente de Gestión de Equipos

> ⚠️ Esto revierte una decisión anterior. Cuando se construyó el módulo
> Fotos, se decidió deliberadamente que una carpeta de tipo "Equipo"
> referencia al equipo real del catálogo de Gestión de Equipos (mismo
> equipo físico, un solo registro). Tras usarlo, se detectó fricción real
> en ese flujo (el selector de organización → buscar equipo → elegir era
> confuso, y a veces no dejaba avanzar). **Decisión nueva: separar
> completamente.**

### 5.1 Cómo debe quedar

- Al crear una carpeta de tipo "Equipo" dentro de Fotos, **ya no se elige
  de un catálogo externo**. Se crea directamente ahí, con su propia
  información: nombre, y los campos que se necesiten — configurables, no
  fijos (mismo criterio que ya se usó para el catálogo de "Tipo de
  mantenimiento": una lista de campos que se puede ampliar sin tocar
  código).
- **Color para diferenciar** — cada carpeta de tipo Equipo puede tener un
  color asignado (o heredado de una categoría), visible en el explorador,
  para identificar equipos de un vistazo entre muchas carpetas.
- Fotos deja de necesitar organización ni equipo del otro módulo para
  nada de esto.

### 5.2 Datos ya existentes — NO HAY NINGUNO

> ⚠️ **Corrección (2026-08-23).** Este apartado decía antes que «ya existen
> carpetas de tipo Equipo en el sistema que SÍ están enlazadas al catálogo
> real», y planteaba dos opciones —dejarlas enlazadas o migrarlas—. **Se
> verificó contra las dos bases de datos y no existe ni una sola.** La
> decisión que este apartado pedía tomar era sobre datos que no hay, así que
> se conserva el texto corregido en vez de borrarlo: da constancia de que se
> dio por supuesto que había datos, y de que se comprobó antes de asumirlo.

Conteo de **solo lectura** sobre las dos bases:

| | local (`hvc_costos`) | Neon (`neondb`) |
|---|---|---|
| `carpetas_fotos` con `tipo = 'EQUIPO'` | **0** | **0** |
| `carpetas_fotos` con `equipoId` no nulo | **0** | **0** |
| `equipos` en el catálogo | 1 | **0** |
| `organizaciones` | 1 | **0** |

Es decir: la funcionalidad de enlazar una carpeta al catálogo de Gestión de
Equipos se construyó, se verificó contra la API y **nunca llegó a usarse con
datos reales**. El equipo y la organización que quedan en la base local son
de las pruebas de la Fase 4 y no los referencia ninguna carpeta.

**Consecuencia:** retirar el enlace **no migra datos**. La FK, la relación
inversa y el CHECK `carpetas_fotos_equipo_segun_tipo_chk` se pueden quitar
directamente, y no hace falta ni copiar campos ni conservar un modo
«enlazado» de compatibilidad hacia atrás.

### 5.3 Lo que se retira

- El selector de 3 pasos (organización → buscar equipo → elegir).
- El atajo "Registrar y elegir" (que creaba el equipo en el catálogo
  externo desde Fotos).
- La dependencia de que existan organizaciones/equipos cargados en el otro
  módulo para poder trabajar en Fotos.

### 5.4 Lo que se mantiene igual
- Las tareas, comentarios, álbumes y fotos siguen funcionando exactamente
  igual dentro de una carpeta de tipo Equipo — lo único que cambia es de
  dónde sale la información del equipo (ahora propia, antes del catálogo).

---

## 6. RESUMEN — todas las acciones que deben existir, tabla única

| Entidad | Crear | Ver | Editar | Agregar contenido | Quitar/Eliminar | Mover |
|---|---|---|---|---|---|---|
| Álbum | ✅ existe | ✅ existe | ✅ existe | ❌ **falta** (agregar fotos después) | ✅ existe (solo vacío) | — |
| Foto | ✅ existe | ✅ existe | ❌ **falta** (editar descripción) | — | ✅ existe | ❌ **falta** |
| Tarea | ✅ existe | ✅ existe | ✅ existe | ⚠️ **falta etiquetado configurable** de sus fotos | ✅ existe (tarea); ❌ **falta** (foto suelta de la tarea) | — |
| Comentario | ✅ existe (con Edición) | ✅ existe | ✅ existe (autor) | — | ✅ existe | — |

---

## 7. DECISIONES RECOMENDADAS — resumen para confirmar

| # | Punto | Recomendación | Por qué |
|---|---|---|---|
| 1 | Reordenar fotos en álbum | **No implementar** | El orden cronológico ya cumple el objetivo de trazabilidad; no añade valor real |
| 2 | Duplicar álbum completo | **No como función nueva** — usar "Guardar como plantilla" desde un álbum existente | Reutiliza el sistema de Plantillas ya construido; las fotos no deben "duplicarse", son evidencia de un momento único |
| 3 | Editar descripción de foto | **Sí, con auditoría** | Corrige errores humanos sin comprometer la trazabilidad (queda el rastro de qué cambió) |
| 4 | Reemplazar archivo de una foto | **No** — se elimina y se sube de nuevo | Una foto es evidencia; "reemplazar en silencio" pondría en duda la integridad del historial fotográfico |
| 5 | Comentarios | **Sí, para TODOS con acceso a la carpeta, incluido el cliente en el portal** | Confirmado — primera vez que el portal tiene escritura; requiere pensar avisos al supervisor |
| 6 | Etiquetas de fotos en tareas | **Catálogo administrable** (mismo patrón que "Tipo de mantenimiento" en Costos), con opción "Otro" de texto libre como salida | Mantiene consistencia entre supervisores para poder comparar/reportar después, sin bloquear casos que no encajen en la lista |
| 7 | Crear álbum desde la bandeja de pendientes | **Sí** — acción "Crear álbum" al seleccionar fotos pendientes, con nombre y comentario opcionales | Evita el paso extra de "primero crear álbum vacío, después ir a subir" |
| 8 | Fotos y Equipos | **Separar por completo** — carpeta de tipo Equipo con info propia y configurable, más color identificador | Decisión de UX: el flujo cruzado con el catálogo generaba fricción real en el uso |

**La pieza nueva de código más grande de todas estas: el sistema de
etiquetas configurables para fotos de tarea (punto 6).** Es la única que
introduce una tabla nueva (el catálogo de etiquetas) — todo lo demás son
extensiones de funcionalidad que ya existe en su mayoría (mover, editar,
comentar con Lectura).

Si estás de acuerdo con esta tabla, el siguiente paso es la auditoría de
código para confirmar el tamaño real de cada cambio, igual que hicimos con
Costos y con Fotos la primera vez.