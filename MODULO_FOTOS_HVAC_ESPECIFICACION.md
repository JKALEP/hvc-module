# Módulo Fotos — Especificación Funcional HVC

> Este documento es la única fuente de verdad para cómo debe quedar el módulo
> Fotos. Todo lo que exista hoy en el proyecto relacionado con Fotos y no
> corresponda a esta especificación se elimina directo — el proyecto es una demo,
> no hay datos reales que proteger.

---

## 1. Objetivo del módulo

Quiero que desarrolles e implementes **completamente** el Módulo Fotos de un
sistema web privado para HVC.

No es solamente un diseño visual ni una maqueta. Es una implementación funcional
completa, incluyendo frontend, backend, base de datos, permisos,
autenticación/autorización, gestión de carpetas, colaboradores, invitaciones,
tareas, comentarios, álbumes, fotografías, carga masiva e importación mediante
Excel.

El módulo debe tener una lógica similar a Google Drive en cuanto a carpetas y
permisos, pero adaptada a un entorno de supervisión de trabajos/inspecciones de
HVC.

El módulo Fotos no debe ser simplemente un almacenamiento de imágenes. Debe
permitir que HVC:

- Organice fotografías mediante carpetas y subcarpetas.
- Cree estructuras de trabajo ilimitadas en profundidad.
- Cree equipos dentro de una estructura.
- Cree tareas asociadas a equipos.
- Marque tareas como completadas o pendientes.
- Agregue comentarios/observaciones.
- Suba una o varias fotografías a una tarea.
- Cree álbumes fotográficos con descripciones.
- Suba fotografías masivamente.
- Permita que supervisores trabajen desde campo.
- Permita compartir determinadas carpetas con clientes externos.
- Permita que clientes consulten únicamente la información que se les haya
  compartido.
- Permita que determinados usuarios de oficina tengan acceso global de solo
  lectura, edición o administración.
- Mantenga un administrador global de Fotos que pueda acceder a todo.

La experiencia debe ser sencilla para el supervisor, especialmente desde celular.

---

## 2. Concepto principal: dos sistemas de acceso separados

Separar completamente:

**A. Acceso al módulo** — determina si el usuario puede entrar al módulo Fotos y,
si tiene acceso global, qué puede hacer.

**B. Permisos sobre carpetas** — determina qué puede hacer un usuario dentro de una
carpeta específica que se le haya compartido.

Estos dos conceptos **no deben mezclarse**.

### Ejemplo

Usuario Cliente A:
- Tiene acceso al módulo Fotos.
- No tiene acceso global.
- Solo tiene acceso a la carpeta "Proyecto Cliente A".
- Dentro de esa carpeta tiene permiso Lectura.

Por lo tanto: el cliente puede entrar a Fotos, pero únicamente verá el árbol de
carpetas al que tiene autorización. Nunca debe poder visualizar las demás carpetas
existentes en el sistema.

---

## 3. Roles y niveles de acceso global

### 3.1 Sin acceso
El usuario no puede entrar al módulo Fotos.

### 3.2 Lectura Global

Puede: ver todas las carpetas, subcarpetas, equipos, tareas, comentarios, álbumes,
fotografías; descargar fotografías si está habilitado.

No puede: crear carpetas/subcarpetas, crear/modificar tareas, subir fotografías,
eliminar fotografías o carpetas, compartir carpetas, administrar permisos.

### 3.3 Editor Global

Puede trabajar sobre todo el contenido: ver, crear carpetas/subcarpetas, crear
equipos, crear/editar tareas, marcar tareas como completadas, agregar comentarios,
crear álbumes, subir fotografías (incluida carga masiva), editar información,
organizar y mover contenido, eliminar contenido según las reglas definidas.

No debe administrar usuarios globales ni configurar permisos globales salvo que
tenga el permiso administrativo correspondiente.

### 3.4 Administrador Global de Fotos

Tiene acceso absoluto al módulo. Puede: ver absolutamente todo, crear, editar,
eliminar, mover, descargar, compartir, administrar colaboradores, modificar
permisos, revocar accesos, administrar usuarios del módulo, gestionar
invitaciones, gestionar configuraciones del módulo, importar estructuras mediante
Excel, administrar plantillas, acceder a cualquier carpeta aunque nadie se la haya
compartido.

**Importante:** el Administrador Global **no depende** del sistema de compartir
carpetas. Aunque una carpeta haya sido creada por un Supervisor y nunca haya sido
compartida con el administrador, el Administrador Global debe poder verla y
administrarla. Debe existir siempre al menos un Administrador Global de Fotos.

---

## 4. Usuarios normales / Supervisores

El Supervisor normalmente tendrá permisos de trabajo (ej. acceso a Fotos: Sí,
nivel: Editor Global o Editor según configuración de HVC).

El Supervisor puede: crear carpetas/subcarpetas/estructuras, crear equipos, crear
tareas, completar tareas, agregar comentarios, subir fotos, crear álbumes,
compartir determinadas carpetas, invitar colaboradores según los permisos que
tenga.

El Supervisor **no** debe poder otorgar a otro usuario un nivel de permiso
superior al que él mismo posee. Ejemplo: si el Supervisor tiene permiso Editor
sobre una carpeta, no puede convertir a otro usuario en Administrador Global.

---

## 5. Permisos sobre carpetas

Cada carpeta puede tener colaboradores, con uno de estos tres permisos:

### Lector
Puede ver carpeta, subcarpetas autorizadas, equipos, tareas, comentarios, álbumes,
fotografías; descargar si está permitido. No puede modificar.

### Editor
Puede ver, subir, crear contenido, crear subcarpetas/equipos/tareas, modificar
tareas, agregar comentarios, crear álbumes, modificar y organizar contenido.

### Acceso Total
Puede hacer todo dentro de esa carpeta y sus recursos autorizados: ver, crear,
editar, eliminar, mover, compartir, administrar colaboradores de esa carpeta,
cambiar permisos de esa carpeta.

**Importante:** "Acceso Total" sobre una carpeta **no** convierte al usuario en
Administrador Global de Fotos. Ejemplo: Cliente A tiene Acceso Total sobre
Proyecto A — puede administrar Proyecto A, pero no puede acceder a Proyecto B.

---

## 6. Propietario de carpeta

Cuando un usuario crea una carpeta, queda registrado como propietario.

Ejemplo: Supervisor Juan crea Proyecto A → Juan = Propietario, Administrador
Global = acceso absoluto, otros usuarios = solamente si tienen permisos.

El propietario puede compartir la carpeta según sus permisos. El Administrador
Global puede acceder y administrar cualquier carpeta independientemente del
propietario.

---

## 7. Herencia de permisos

Ejemplo: Proyecto A contiene Enero, Febrero, Marzo, Inspecciones. Si Cliente A
recibe Proyecto A → Lectura, entonces puede visualizar Proyecto A y todo su
contenido (Enero, Febrero, Marzo, Inspecciones), sin necesidad de compartir cada
subcarpeta individualmente.

Sin embargo, debe existir la posibilidad de restringir o controlar acceso a
subcarpetas específicas cuando el modelo de permisos lo permita. Ejemplo:
Proyecto A → Lectura, pero Inspecciones → Sin acceso. El sistema debe respetar esa
restricción.

---

## 8. Visualización del cliente

El cliente **no** debe visualizar el árbol completo del sistema. Debe recibir una
vista filtrada.

Ejemplo — estructura completa: FOTOS → Proyecto A, Proyecto B, Proyecto C,
Proyecto D.

Cliente A solamente tiene acceso a Proyecto A. Debe visualizar únicamente:

```
FOTOS
└── Compartido conmigo
    └── Proyecto A
        ├── Enero
        ├── Febrero
        └── Inspecciones
```

No debe visualizar Proyecto B, C o D — ni siquiera como elementos bloqueados.

El backend debe filtrar los datos y el frontend también debe mostrar únicamente
los recursos autorizados. **No confiar únicamente en ocultar elementos mediante
frontend.** La autorización debe validarse siempre en backend.

---

## 9. Creación de usuarios mediante invitación

No se quiere que un Supervisor tenga que crear manualmente una contraseña para un
cliente. Debe existir un sistema de invitación.

### Flujo

1. Supervisor entra a Proyecto A → Compartir.
2. Selecciona "Agregar colaborador".
3. Introduce: correo electrónico, nombre opcional, permiso (Lectura / Editor /
   Acceso Total), fecha de expiración opcional.
4. El sistema crea una invitación pendiente (ej. `email: cliente@empresa.com`,
   `estado: PENDIENTE`).
5. El sistema genera un token de invitación único, seguro y de un solo uso.
6. Se envía el enlace: `https://dominio-hvc.com/invitacion/{token}`.
7. El cliente abre el enlace.
   - Si no tiene cuenta: nombre, correo, contraseña, confirmar contraseña →
     acepta la invitación → se crea la cuenta → se vincula automáticamente al
     recurso compartido.
   - Si el usuario ya existe: simplemente se agrega el permiso y se notifica al
     usuario.

**Importante:**
- Nunca almacenar contraseñas en texto plano — usar hashing seguro.
- El token de invitación debe tener expiración y no debe poder reutilizarse una
  vez aceptado.

---

## 10. Compartir carpetas

Cada carpeta debe tener una opción "Compartir" que muestre:

- Nombre de carpeta.
- Lista de colaboradores actuales: usuario, correo, rol/permiso, fecha de acceso,
  invitado por, estado.
- Botón "+ Agregar colaborador" con formulario: correo electrónico, permiso
  (Lectura / Editor / Acceso Total).
- Acciones: enviar invitación, cambiar permiso, revocar acceso.

---

## 11. Estructura de carpetas

El módulo debe comportarse como un gestor de archivos. Permitir: crear carpeta,
crear subcarpeta, renombrar, mover, eliminar, restaurar (si se implementa
papelera), buscar, ordenar, filtrar.

**No establecer un límite artificial de profundidad.** Ejemplo:

```
Proyecto
└── Frente
    └── Zona
        └── Equipo
            └── Inspección
                └── Evidencias
                    └── Fotos
```

Debe ser posible continuar creando niveles según la necesidad.

---

## 12. Equipos

Dentro de una estructura de trabajo debe existir la posibilidad de crear un
Equipo. Ejemplo: Proyecto A → Frente 1 → Equipo ABC-001.

Campos del equipo: ID, código, nombre, tipo, marca (opcional), modelo (opcional),
número de serie (opcional), ubicación (opcional), descripción (opcional), estado
(opcional), fecha de creación, usuario creador.

No hacer obligatorios campos que no sean necesarios para el flujo básico.

> ⚠️ **Nota de auditoría (no es parte del documento original):** el proyecto ya
> tiene un módulo "Gestión de Equipos" con su propio modelo de equipo. Antes de
> implementar esta sección hay que resolver si es el mismo concepto o uno
> distinto — ver conflicto bloqueante en la fase de auditoría.

---

## 13. Tareas

Dentro de cada equipo debe existir "+ Nueva tarea" con los campos: título,
descripción (opcional), estado, prioridad (opcional), fecha, usuario responsable,
comentario/observación, fotografías, fecha de finalización, usuario que completó.

Estados mínimos: Pendiente, En proceso, Completada.

Debe existir un check visual para completar rápidamente (ej. ☐ Revisar estado
estructural → ☑ Revisar estado estructural), registrando fecha/hora y usuario que
la completó.

---

## 14. Comentarios

Permitir comentarios como mínimo en: carpeta, equipo, tarea, álbum.
Opcionalmente: fotografía individual.

Los comentarios deben registrar: texto, usuario, fecha/hora, última modificación.

El cliente podrá visualizar esta información si tiene permiso de lectura.

---

## 15. Fotografías

Permitir: subir una foto, subir varias fotos, carga masiva, arrastrar y soltar en
escritorio, selección múltiple, captura/subida desde celular, vista previa,
eliminar, descargar, visualizar en galería.

Guardar metadatos: nombre, tipo MIME, tamaño, ruta, carpeta, tarea relacionada
(opcional), álbum relacionado (opcional), usuario que subió, fecha/hora,
descripción (opcional).

Si es posible, conservar fecha original de captura e información EXIF relevante —
sin depender exclusivamente de EXIF para la fecha de trabajo.

---

## 16. Álbumes

Crear un tipo de contenido "Álbum de fotos". Ejemplo: Equipo ABC → Álbum "Estado
inicial".

Campos: nombre, descripción (opcional), fecha, usuario creador, fotografías.

Debe permitir subir múltiples fotografías directamente al álbum.

---

## 17. Captura rápida para supervisor

**Este punto es muy importante.** El Supervisor trabaja en campo y normalmente
toma muchas fotografías con su celular. No se quiere obligarlo a: entrar a
carpeta → crear subcarpeta → buscar equipo → buscar tarea → seleccionar foto →
repetir.

### Flujo de "Captura rápida"

Captura rápida → seleccionar proyecto → seleccionar estructura/equipo/tarea o
álbum → seleccionar/subir múltiples fotos → opcionalmente agregar comentario →
guardar.

También permitir "Subir fotos sin asignar" — estas fotografías quedan
temporalmente en una bandeja "Fotos pendientes de organizar", para clasificarlas
después.

---

## 18. Bandeja de fotos pendientes

Ejemplo: Supervisor toma 50 fotografías durante el día, las sube masivamente. El
sistema las guarda temporalmente en "Fotos pendientes". Después puede clasificar
por lotes: ej. 20 fotos → Equipo ABC → Tarea "Inspección"; 15 fotos → Equipo DEF
→ Álbum "Estado inicial"; 15 fotos → Equipo XYZ → Tarea "Revisión".

Esto reduce el trabajo de organización.

---

## 19. Importación mediante Excel

Función "Importar estructura". El Excel **no** contiene las fotografías — define
la estructura que el sistema debe crear.

### Ejemplo de columnas

| Carpeta | Subcarpeta | Equipo | Tipo | Nombre | Descripción |
|---|---|---|---|---|---|
| Proyecto A | Frente 1 | Equipo 01 | Tarea | Revisar pernos | Verificar estado |
| Proyecto A | Frente 1 | Equipo 01 | Tarea | Revisar soldadura | |
| Proyecto A | Frente 1 | Equipo 01 | Álbum | Estado inicial | Inspección |
| Proyecto A | Frente 2 | Equipo 02 | Tarea | Revisar estructura | |

### Flujo de importación

1. Seleccionar Excel.
2. Leer archivo.
3. Validar columnas.
4. Mostrar vista previa.
5. Detectar errores.
6. Mostrar qué se creará.
7. Confirmar importación.
8. Crear automáticamente: carpetas, subcarpetas, equipos, tareas, álbumes.

Si ya existe un recurso, no duplicarlo automáticamente — mostrar advertencias
(ej. "Proyecto A ya existe", "Equipo 01 ya existe") y permitir elegir: Crear /
Omitir / Actualizar.

La importación debe realizarse mediante una transacción segura, para evitar
estructuras incompletas.

---

## 20. Plantillas

Además de Excel, implementar el concepto de plantillas. Ejemplo: plantilla
"Inspección de Equipo" que contiene: Estado general, Pernos, Soldaduras,
Estructura, Evidencia fotográfica.

El usuario selecciona "Crear desde plantilla" y el sistema crea automáticamente
la estructura. Esto permite reutilizar procesos repetitivos.

---

## 21. Experiencia de usuario

La interfaz debe ser limpia y fácil de usar. No convertir Fotos en una interfaz
excesivamente compleja.

### Escritorio

Panel lateral: Mis carpetas, Compartido conmigo, Fotos pendientes, Recientes,
Favoritos (opcional), Papelera (opcional).

Área principal: breadcrumb, nombre de carpeta, botones de acción, vista de
carpetas, vista de archivos, vista de tareas/equipos cuando corresponda.

### Móvil

Priorizar: subir fotos, captura rápida, seleccionar tarea, completar tarea,
agregar comentario, crear álbum.

El supervisor debe poder hacer el flujo principal con pocos pasos.

---

## 22. Vista del cliente

La experiencia del cliente debe ser mucho más sencilla. El cliente entra y ve
"Compartido conmigo" → Proyecto A → Frente 1 → Equipo ABC → Tareas → Álbumes →
Fotografías → Comentarios.

No mostrar opciones de administración si tiene Lectura. No mostrar carpetas que
no tenga autorizadas.

---

## 23. Trazabilidad

Registrar auditoría de acciones importantes: usuario, acción, recurso,
fecha/hora, IP (si corresponde), información relevante.

Acciones a registrar: crear carpeta, eliminar carpeta, crear tarea, completar
tarea, subir fotografía, eliminar fotografía, crear álbum, compartir, cambiar
permiso, revocar acceso, crear usuario, aceptar invitación, importar Excel.

Esto es importante porque HVC necesita saber quién realizó cada acción.

---

## 24. Seguridad

No confiar en el frontend para permisos. Toda operación debe validarse en
backend. Un usuario no autorizado no debe poder acceder a un recurso simplemente
modificando un ID en la URL (ej. `/fotos/proyecto/123` si no le pertenece, el
backend debe rechazar el acceso).

Aplicar autorización en: obtener carpeta, obtener hijos, obtener fotografías,
subir, crear, editar, eliminar, compartir, descargar. Las consultas deben
filtrar según permisos — no traer todo al frontend para luego ocultarlo.

---

## 25. Modelo conceptual de permisos

Implementar algo equivalente a:

**Usuario → acceso al módulo Fotos → nivel global:**
- `NONE`
- `GLOBAL_READ`
- `GLOBAL_EDITOR`
- `GLOBAL_ADMIN`

**Y permisos específicos — `FolderPermission`:**
- `userId`
- `folderId`
- `permission`
- `grantedBy`
- `createdAt`
- `updatedAt`

**`Permission`:**
- `READ`
- `EDIT`
- `FULL`

El sistema debe resolver el permiso efectivo teniendo en cuenta, en este orden:

1. Administrador Global.
2. Permiso global.
3. Propietario.
4. Permiso específico.
5. Herencia de carpeta.
6. Restricciones explícitas.

Diseñar esta lógica de manera **centralizada**, no repetirla manualmente en cada
endpoint.

---

## 26. Reglas importantes (resumen)

1. El Administrador Global siempre puede ver todo.
2. Un usuario con Lectura Global puede visualizar todo, pero no modificar.
3. Un Editor Global puede trabajar sobre todo el módulo.
4. El acceso al módulo no implica automáticamente acceso al contenido para
   usuarios normales.
5. El cliente solo puede ver recursos compartidos con él.
6. Los permisos de una carpeta se heredan a sus hijos por defecto.
7. El acceso total sobre una carpeta no equivale a Administrador Global.
8. Un usuario no puede otorgar permisos superiores a los que tiene.
9. Las contraseñas nunca se crean ni comparten manualmente por el Supervisor.
10. Los clientes deben entrar mediante invitación.
11. El enlace de invitación debe ser seguro y tener expiración.
12. El backend debe validar todos los permisos.
13. Las fotografías deben poder cargarse masivamente.
14. Debe existir una forma rápida de trabajar desde celular.
15. Excel debe permitir crear estructuras masivamente.
16. Las plantillas deben permitir reutilizar estructuras de trabajo.
17. Las carpetas no deben tener una profundidad artificialmente limitada.
18. Debe existir trazabilidad de acciones importantes.

---

## 27. Ejemplo de flujo completo (caso de prueba de referencia)

1. Administrador crea usuario "Supervisor Juan".
2. Le habilita Fotos.
3. Juan entra a Fotos.
4. Juan crea: Proyecto A.
5. Dentro crea: Frente 1.
6. Dentro crea: Equipo ABC.
7. Dentro de Equipo ABC crea: "Revisar estructura", "Revisar pernos", "Revisar
   soldadura".
8. Juan completa una tarea.
9. Agrega comentario.
10. Sube 5 fotografías.
11. Crea un álbum "Estado inicial".
12. Sube 20 fotografías al álbum.
13. Juan comparte Proyecto A con `cliente@empresa.com`.
14. Selecciona: Lectura.
15. El sistema genera invitación.
16. El cliente recibe el enlace.
17. El cliente crea su contraseña.
18. Acepta la invitación.
19. El cliente entra.
20. El cliente solamente ve Proyecto A.
21. Puede navegar por Frente 1 → Equipo ABC.
22. Puede ver tareas, comentarios, álbumes y fotografías.
23. No puede ver Proyecto B.
24. No puede ver carpetas de otros clientes.
25. El Administrador Global de Fotos sigue viendo absolutamente todo.
26. Un usuario de oficina con Lectura Global también puede ver Proyecto A sin que
    Juan tenga que compartirle nada.

---

## 28. Prioridades — no sobrecomplicar

1. Facilidad para Supervisor.
2. Seguridad.
3. Permisos claros.
4. Facilidad para Cliente.
5. Organización de fotografías.
6. Carga masiva.
7. Trazabilidad.

No agregar funciones innecesarias si complican el flujo principal. El objetivo es
que el Supervisor pueda estar en campo, trabajar rápidamente desde su celular,
registrar tareas, comentarios y fotografías, y que posteriormente el Cliente
pueda entrar y consultar de forma ordenada el trabajo realizado.

---

## 29. Resultado esperado — alcance de la implementación

Implementación completa y funcional, no solamente componentes visuales. Incluye:

Base de datos · entidades/modelos · relaciones · migraciones · backend ·
APIs/endpoints · autenticación · autorización · sistema de roles · sistema de
permisos · carpetas · subcarpetas · equipos · tareas · comentarios · álbumes ·
fotografías · carga múltiple · invitaciones · creación de cuenta mediante
invitación · compartición · herencia de permisos · importación Excel ·
plantillas · auditoría · interfaz de escritorio · interfaz responsive/móvil ·
validaciones · manejo de errores · estados de carga · confirmaciones ·
protección de rutas · protección de endpoints · documentación de la
arquitectura.

**Antes de implementar:** analizar el proyecto existente y respetar la
arquitectura, tecnologías, convenciones, autenticación, base de datos,
almacenamiento y componentes que ya existan. No reemplazar tecnologías
existentes sin una razón técnica clara. Si ya existen módulos de usuarios,
autenticación, almacenamiento o permisos, reutilizarlos y extenderlos en lugar
de duplicarlos.

La implementación debe quedar preparada para crecer posteriormente sin tener que
rehacer la arquitectura de permisos.

---

## 30. Reglas de este proyecto en particular (no negociables)

> Estas reglas no vienen del documento original — son del contexto de HVC Costos
> que ya se construyó y deben respetarse igual aquí.

- El módulo **Costos** (`backend/src/costos/`, `frontend/src/modules/costos/`) es
  **intocable**. No se modifica, no se refactoriza "de paso", bajo ningún motivo.
- Todo lo transversal que ya existe en `common/` (ExportacionService,
  CorreoService, LineasService, NumeracionService), el patrón de auditoría, el
  patrón de sub-rol por módulo (`PermisoModulo`), y el almacenamiento en
  Cloudflare R2 ya configurado, se **reutiliza o se replica con el mismo patrón**
  — no se inventa una versión paralela.
- El proyecto ya tiene un módulo **"Gestión de Equipos"** con su propio modelo de
  equipo (NodoEstructura autoreferenciado, EAV, fotos en R2). Este documento
  también habla de "Equipos" — **es un conflicto bloqueante que debe resolverse
  antes de tocar el schema**, no asumirse.
- Todo lo que exista hoy en el módulo Fotos actual y no corresponda a esta
  especificación se **elimina directo** (no "se deja en espera") — es una demo,
  no hay datos reales que proteger.