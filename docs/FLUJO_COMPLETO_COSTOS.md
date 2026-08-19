# Módulo Costos — recorrido completo, paso a paso

Este documento recorre el módulo **de principio a fin**, tal como lo
vive una persona de HVC. No es un resumen técnico: es el camino que
sigue un requerimiento desde que alguien lo pide hasta que queda
registrado cuánto costó, contando en cada paso **quién actúa, qué
pantalla abre, qué ve, qué escribe y qué pasa después**.

Todo lo que aparece aquí se ejecutó de verdad contra el sistema el
**15 de agosto de 2026**. Los números, los estados y los textos son los
que devolvió la aplicación, no ejemplos inventados. El requerimiento del
recorrido fue el **001-000009**.

---

## Los cuatro papeles

El módulo reparte el trabajo entre cuatro personas. Cada una entra con
su cuenta y **solo ve lo suyo** en la barra lateral izquierda:

| Rol | Qué ve en el menú |
|---|---|
| **Solicitante** | Emitir requerimiento · Mis requerimientos · Base de costos |
| **Gestor de cotizaciones** | Bandeja de cotizaciones · Base de costos |
| **Aprobador** | Aprobaciones · Base de costos |
| **SuperAdmin** | Las siete: las tres bandejas anteriores, Base de costos, Administración de Costos y Auditoría de Costos |

Esto no es cosmético. Si el Aprobador escribe a mano la dirección de la
pantalla de administración, el sistema le responde:

> **Sección restringida**
> Solo el SuperAdmin puede gestionar cuentas y permisos.

Y el backend rechaza la petición aunque alguien se salte la pantalla.

Un detalle importante para entender los permisos: **una persona tiene un
solo rol dentro de Costos**. No se puede ser Solicitante y Gestor a la
vez. La única cuenta que ve las tres bandejas es el SuperAdmin, porque
pasa por encima de los roles.

Las cuentas usadas en este recorrido:

| Persona | Rol |
|---|---|
| Lucía Ramos | Solicitante |
| Rodolfo Díaz | Gestor de cotizaciones |
| Marta Quispe | Aprobadora |

---

## Paso 1 — El SuperAdmin prepara el terreno

**Pantalla:** `Administración de Costos` → `/costos/admin`

La pantalla tiene cinco pestañas arriba: **Catálogos · Proveedores ·
Clientes · Supervisores · Correo**.

### 1.1 Catálogos

En **Catálogos** hay tres sub-pestañas. Cada una es una lista con
columnas *Orden · Valor · Estado · Acciones*, y un botón **«+ Nuevo
valor»** arriba a la derecha.

Esto es lo que había cargado:

| Catálogo | Valores |
|---|---|
| Tipos de mantenimiento | Preventivo, Correctivo, Predictivo, Instalación |
| Tipos de requerimiento | Emergencia, Programado, Stock, Proyecto |
| Unidades de medida | UND, MT, M2, KG, GLN, LT, JGO, CJA, ROLLO, PZA |

Cada fila tiene cuatro botones: ver su historial, activar/desactivar,
editar y eliminar.

**Qué pasa si intenta borrar algo que ya se usó.** Al pulsar la papelera
sobre «Preventivo», sale un cuadro de confirmación y, al aceptar, el
sistema lo rechaza con este aviso:

> No se puede eliminar "Preventivo": lo usan 6 requerimiento(s).
> Desactívalo si ya no debe ofrecerse: lo registrado se conserva.

Es deliberado: **retirar un valor del catálogo no puede reescribir lo
que ya se registró con él**. Para eso está desactivar, que lo quita de
los formularios y deja intacto el pasado.

### 1.2 Cliente

Pestaña **Clientes** → botón **«Nuevo»**. El formulario pide: *Nombre\*,
RUC, Persona de contacto, Correo, Teléfono, Dirección* (el asterisco es
lo obligatorio).

Se dio de alta:

```
Nombre:     Clínica San Gabriel S.A.C.
RUC:        20601234567
Contacto:   Ing. Patricia Vera
Correo:     mantenimiento@sangabriel.com.pe
Teléfono:   01 442 7788
Dirección:  Av. Javier Prado 2150, San Isidro
```

**Resultado:** aparece en la tabla con la etiqueta verde **Activo**.

### 1.3 Supervisor

Pestaña **Supervisores** → **«Nuevo»**. Pide *Nombre\*, Documento, Cargo,
Correo, Teléfono*.

```
Nombre:     Carlos Mendoza
Documento:  41235678
Cargo:      Supervisor de obra
Correo:     cmendoza@hvc.com.pe
Teléfono:   987 654 321
```

### 1.4 Los dos proveedores

Pestaña **Proveedores** → **«Nuevo»**. Pide *Razón social\*, RUC, Nombre
comercial, Correo, Teléfono, Dirección*.

El campo Correo lleva la nota **«Sin esto no se le puede pedir
cotización»**, y no es un adorno: más adelante el sistema impide
seleccionar a un proveedor sin correo.

```
1) Razón social:      Refrigeración Andina S.A.C.
   Nombre comercial:  RefriAndina
   RUC:               20551234567
   Correo:            ventas@refriandina.com.pe

2) Razón social:      Clima Total E.I.R.L.
   Nombre comercial:  ClimaTotal
   RUC:               20559876543
   Correo:            cotizaciones@climatotal.com.pe
```

A diferencia de las otras pestañas, aquí **también se ven los
desactivados** (en gris): es la pantalla donde se administran, y los
desactivados son justo los que a veces hay que volver a activar.

---

## Paso 2 — Lucía (Solicitante) emite el requerimiento

**Pantalla:** `Emitir requerimiento` → `/costos/emitir`

Arriba hay un indicador de tres pasos: **1 Datos generales › 2 Ítems ›
3 Vista previa**.

### 2.1 Paso 1 de 3 — Datos generales

El formulario tiene seis campos, todos con desplegables ya cargados:

| Campo | Opciones que ofrece |
|---|---|
| Cliente \* | Cliente de prueba S.A.C., **Clínica San Gabriel S.A.C.** |
| Supervisor \* | **Carlos Mendoza**, Supervisor de prueba |
| Tipo de mantenimiento \* | Preventivo, **Correctivo**, Predictivo, Instalación |
| Tipo de requerimiento \* | **Emergencia**, Programado, Stock, Proyecto |
| Lugar de entrega \* | (texto libre) |
| Fecha de entrega \* | (calendario) |

Lucía llena:

```
Cliente:                Clínica San Gabriel S.A.C.
Supervisor:             Carlos Mendoza
Tipo de mantenimiento:  Correctivo
Tipo de requerimiento:  Emergencia
Lugar de entrega:       Clínica San Gabriel — Sótano 2, cuarto de máquinas
Fecha de entrega:       25/08/2026
```

Abajo hay dos botones: **Cancelar** y **Continuar**. «Continuar» está
apagado hasta que los seis campos estén llenos.

**Resultado al pulsar Continuar:** pasa al paso 2 y el sistema guarda un
**borrador**. En el encabezado, donde va el número de pedido, aparece en
cursiva *«se asignará al emitir»* — porque todavía no tiene número. Es
a propósito: **un borrador abandonado no consume un correlativo**.

### 2.2 Paso 2 de 3 — Los ítems

Ahora ve la cabecera del documento con los datos que acaba de escribir, y
debajo una tabla vacía con un botón **«+ Añadir»**. La tabla tiene las
columnas *# · Descripción · Unidad · Cantidad · Detalle de observación ·
Referencias*.

Al pulsar «+ Añadir» se abre una ventana con esos cinco campos. No se
escribe directamente sobre la tabla: el ítem entra completo de una vez.

Lucía añade tres:

```
1) Descripción: Compresor scroll 5 TR R-410A
   Unidad: UND      Cantidad: 2
   Detalle: Para chiller Carrier 30RB del sótano 2
   Referencias: Copeland ZP61K5E-PFV o equivalente

2) Descripción: Refrigerante R-410A
   Unidad: KG       Cantidad: 25
   Detalle: Cilindro precintado

3) Descripción: Filtro secador biflujo 3/8"
   Unidad: UND      Cantidad: 4
   Referencias: Danfoss DMB 053
```

Cada uno aparece en la tabla al guardarlo, con un aviso verde *«Ítem
agregado»*. Mientras no haya al menos uno, debajo se lee: *«Agrega al
menos un ítem para poder continuar»*.

**Ojo con «Cancelar» en este paso:** descarta el borrador entero y no
queda registro. El cuadro de confirmación lo dice: *«Se descartará todo
lo que llevas escrito… todavía no se ha emitido ni tiene número»*.

### 2.3 Paso 3 de 3 — Vista previa

Es **la misma plantilla, sin poder tocar nada**: lo que se revisa es
exactamente lo que se va a emitir. Los botones son **«Volver a editar»**
y **«Emitir»**.

**Resultado al pulsar Emitir:**

- El requerimiento recibe su número: **001-000009**
- El estado pasa a **En revisión**
- Sale el aviso *«Requerimiento 001-000009 emitido»*
- La pantalla salta al detalle del requerimiento

### 2.4 «Mis requerimientos»

**Pantalla:** `/costos/mis-requerimientos`

Dos pestañas: **Pendientes** y **Finalizados**. La tabla muestra
*N.º · Cliente · Emisión · Entrega · Ítems · Estado*.

Ahí está su requerimiento:

```
001-000009 | Clínica San Gabriel S.A.C. | 15/08/2026 | 25/08/2026 | 3 | En revisión
```

Las filas en las que **le toca a ella** salen resaltadas con un borde
ámbar. Ésta no lo está: ahora la pelota es del Gestor.

---

## Paso 3 — Rodolfo (Gestor) pide cotizaciones

**Pantalla:** `Bandeja de cotizaciones` → `/costos/bandeja`

Tres pestañas con contador: **Por atender · En curso · Finalizados**.

El requerimiento aparece en **Por atender**, con borde ámbar y una línea
debajo del estado que dice qué se espera de él:

```
001-000009 | Clínica San Gabriel S.A.C. | Lucía Ramos | 25/08/2026 | 3 ítems | — cotiz.
En revisión — Revísalo: dale paso a proveedores u obsérvalo.
```

Al abrirlo (`/costos/gestion/26`) ve el expediente completo: la cabecera,
los tres ítems **en solo lectura** (corregir un ítem es del Solicitante;
lo que el Gestor tiene cuando algo está mal es **observar**), y arriba
una franja ámbar con sus dos opciones:

- **Observar** — devuelve el req  uerimiento a Lucía pidiéndole que
  corrija algo
- **Dar paso a proveedores**

En este recorrido el requerimiento estaba bien, así que pulsa **«Dar
paso a proveedores»**.

### 3.1 El selector de proveedores

Se abre la ventana **«Pedir cotización»**, con un buscador arriba:
*«Buscar por nombre, RUC o correo…»*.

Rodolfo escribe `refri` y la lista se reduce a:

```
☐ Refrigeración Andina S.A.C. (RefriAndina)
  RUC 20551234567 · ventas@refriandina.com.pe
```

Borra la búsqueda, marca las casillas de los **dos** proveedores y pulsa
**«Pedir cotización»**.

> **Sobre el envío del correo.** Aquí el sistema **sí** tiene la opción
> de enviar, el botón funciona y genera el registro correspondiente,
> pero el correo **no llega a la bandeja real del proveedor** porque
> falta configurar la clave de Resend en producción. El contenido del
> mensaje se imprime en la consola del backend para poder revisarlo.
>
> El sistema no lo disimula. La respuesta que da es explícita, y el
> aviso en pantalla dice: *«El correo está en modo desarrollo: no salió
> ningún mensaje. El contenido se imprimió en la consola del backend»*.

**Resultado:** el estado pasa a **Esperando cotizaciones**, y en el panel
«Solicitudes a proveedores» quedan las dos, con todo lo que pasó:

```
Clima Total E.I.R.L.            [Falló]  [sin respuesta]   15/08/2026
  A cotizaciones@climatotal.com.pe · lo mandó Rodolfo Díaz
  El correo no salió: MODO DESARROLLO: el correo se imprimió en la consola.

Refrigeración Andina S.A.C.     [Falló]  [sin respuesta]   15/08/2026
  A ventas@refriandina.com.pe · lo mandó Rodolfo Díaz
  El correo no salió: MODO DESARROLLO: el correo se imprimió en la consola.
```

Que diga **«Falló»** en vez de «Enviado» es correcto y deliberado: decir
que se envió sin haberlo enviado dejaría a alguien esperando una
respuesta que no puede llegar. Cuando se configure Resend, esa misma
columna dirá **Enviado** — y si el correo rebota, dirá por qué.

Cada solicitud guarda además **con qué versión de la plantilla salió**,
para poder reconstruir años después qué texto exacto recibió el
proveedor.

---

## Paso 4 — Rodolfo registra lo que respondieron

Los proveedores contestan por su cuenta (correo, WhatsApp, un PDF). El
Gestor **teclea** lo que hace falta para comparar: el sistema no
interpreta documentos, y eso es una decisión, no una carencia.

En el panel **«Cotizaciones recibidas»** pulsa **«Registrar
cotización»**. La ventana trae:

- **Proveedor** — con buscador y desplegable; los que ya recibieron la
  solicitud salen marcados *«— ya se le pidió»*
- **Fecha de la cotización** (la del documento del proveedor, no la de
  hoy), **Válida hasta**, **Plazo de entrega**, **Garantía**,
  **Condiciones de pago**, **Observaciones**
- Una tabla **ya rellenada con los tres ítems pedidos** —descripción,
  unidad y cantidad copiadas— y la columna de precio en blanco

Esto último es la clave: cada precio queda atado a su ítem, y por eso
después se puede comparar línea a línea. Lo que el proveedor añada por
su cuenta se agrega con **«+ Línea»**.

### Cotización 1 — Refrigeración Andina

```
Fecha: 15/08/2026    Válida hasta: 30/08/2026
Plazo: 5 días hábiles        Garantía: 18 meses
Pago:  50 % adelanto, 50 % contra entrega
Observaciones: Compresores con certificado de origen.

Compresor scroll 5 TR R-410A   2 UND × 3.850,00 = 7.700,00
Refrigerante R-410A           25 KG  ×    62,00 = 1.550,00
Filtro secador biflujo 3/8"    4 UND ×    48,00 =   192,00
Flete e instalación en sitio   1 UND ×   350,00 =   350,00   ← línea extra
                                              TOTAL 9.792,00
```

### Cotización 2 — Clima Total

```
Fecha: 15/08/2026    Válida hasta: 30/08/2026
Plazo: 20 días calendario    Garantía: 6 meses
Pago:  Contado contra entrega

Compresor scroll 5 TR R-410A   2 UND × 3.600,00 = 7.200,00
Refrigerante R-410A           25 KG  ×    58,00 = 1.450,00
Filtro secador biflujo 3/8"    4 UND ×    55,00 =   220,00
                                              TOTAL 8.870,00
```

El total **no se teclea**: se calcula solo y se ve cambiar mientras se
escriben los precios. Al guardar, sale *«Cotización de … registrada»* y
el estado pasa a **Cotizaciones recibidas**.

Cada cotización queda como una tarjeta con su total, plazo, garantía y
condiciones, y dos botones: **Corregir** y **Descartar**. Descartar la
saca de la comparación pero **no la borra** —el Aprobador tiene derecho
a ver que ese proveedor respondió— y exige escribir un motivo.

---

## Paso 5 — Rodolfo compara y recomienda

Pulsa **«Empezar a evaluar»** (el estado pasa a *En evaluación*) y
aparece el bloque **Comparación**, con dos vistas:

### Por proveedor

| Proveedor | Total S/ | Cubre | Plazo | Garantía |
|---|---|---|---|---|
| Refrigeración Andina S.A.C. | 9.792,00 | 3/3 | 5 días hábiles | 18 meses |
| **Clima Total E.I.R.L.** 🏆 | **8.870,00** | 3/3 | 20 días calendario | 6 meses |

El trofeo **«Más bajo»** y el fondo verde marcan a Clima Total. «Cubre
3/3» significa que ambos cotizaron los tres ítems: cotizar 3 de 8 no es
competir.

### Por ítem

Desplegando cada ítem se ve quién ganó **en esa línea**, que no siempre
es el mismo que gana en total:

| Ítem | Desde | Refrigeración Andina | Clima Total |
|---|---|---|---|
| Compresor scroll 5 TR R-410A | 3.600,00 /UND | 3.850,00 | **3.600,00** |
| Refrigerante R-410A | 58,00 /KG | 62,00 | **58,00** |
| Filtro secador biflujo 3/8" | 48,00 /UND | **48,00** | 55,00 |

Y abajo, **«Líneas añadidas por los proveedores»**:

```
Flete e instalación en sitio — Refrigeración Andina S.A.C.   1 × 350,00 = 350,00
```

No responden a ningún ítem pedido, pero cuentan en el total de quien las
puso, así que tienen que verse o las cuentas no cuadran.

### La recomendación

Pulsa **«Recomendar una cotización»**. La ventana muestra las
candidatas con su total, y un campo **«Por qué ésa»** obligatorio. El
botón está bloqueado hasta escribir al menos 15 caracteres, con el aviso
*«Es lo único que el aprobador va a leer para decidir»*.

Rodolfo elige **Refrigeración Andina** —la más cara— y escribe:

> Se recomienda Refrigeración Andina pese a ser S/ 922 más cara en
> total: entrega en 5 días frente a 20, y la clínica está con el chiller
> parado. Además da 18 meses de garantía contra 6, y es la única que
> incluye instalación en sitio.

**Resultado:** aviso *«Recomendación enviada — El requerimiento pasa a la
mesa del aprobador»*. Estado: **Esperando aprobación**.

El botón dice «Recomendar», nunca «Aprobar»: **el Gestor elige, no
decide**.

---

## Paso 6 — Marta (Aprobadora) decide

**Pantalla:** `Aprobaciones` → `/costos/aprobaciones`

Tres pestañas: **Por decidir · En curso · Finalizados**. El 001-000009
aparece en «Por decidir» con borde ámbar y la línea *«Hay una
recomendación esperando tu decisión»*.

Al abrirlo (`/costos/decision/26`), **lo primero y más grande** es una
tarjeta verde con lo que le proponen:

```
🏆 COTIZACIÓN RECOMENDADA
Refrigeración Andina S.A.C.                          S/ 9.792,00
RUC 20551234567 · 4 líneas · entrega 5 días hábiles · garantía 18 meses
                                              ⚠ No es la más barata

POR QUÉ LA RECOMIENDA
Se recomienda Refrigeración Andina pese a ser S/ 922 más cara en total:
entrega en 5 días frente a 20, y la clínica está con el chiller parado.
Además da 18 meses de garantía contra 6, y es la única que incluye
instalación en sitio.
   Rodolfo Díaz · 15/08/2026 · la más barata está en S/ 8.870,00
```

Esa etiqueta ámbar **«No es la más barata»** y la coletilla final son
deliberadas: es exactamente la pregunta que un aprobador se hace, y el
sistema la pone delante en vez de esconderla.

Debajo tiene el requerimiento completo con sus tres ítems, y la tabla
**«Todas las cotizaciones»** — la misma comparación que vio el Gestor,
pero con una diferencia: **aquí el verde marca la recomendada**, no la
más barata. El trofeo sigue sobre Clima Total. Cuando las dos marcas
caen en filas distintas, se ve de un vistazo que hay algo que explicar.

Sus tres botones son:

- **Cerrar sin acuerdo** — cierra sin compra, motivo obligatorio
- **Rechazar** — devuelve al Gestor, motivo obligatorio
- **Aceptar** — comentario opcional

Marta pulsa **Aceptar** y escribe: *«Aprobado por urgencia: la clínica no
puede esperar 20 días.»*

**Resultado:**

- Aviso: *«Requerimiento aprobado — Pasa al solicitante para que registre
  el costo»*
- Estado: **Registra el costo**
- La cotización de Refrigeración Andina queda **APROBADA**; la de Clima
  Total sigue **REGISTRADA** — no se toca, sigue constando como
  alternativa

> **Si hubiera rechazado:** no sería un cierre. El requerimiento vuelve
> al Gestor, que puede recomendar otra cotización, y la pantalla del
> Aprobador mostraría entonces las dos vueltas —«Ronda 1: rechazada, con
> su motivo» y «Ronda 2: esperando tu decisión»— una debajo de la otra.

---

## Paso 7 — Lucía registra el costo final

Vuelve a `/costos/mis-requerimientos`. Su requerimiento está otra vez con
**borde ámbar**: le toca a ella.

Al abrirlo, arriba hay una franja ámbar:

> **Requerimiento aprobado — falta registrar el costo**
> Anota cuánto costó cada ítem para cerrar el proceso.
> [ Registrar costo ]

La ventana **ya viene rellenada** con los datos del proveedor aprobado y
los tres ítems:

```
Proveedor de la cotización aprobada
Refrigeración Andina S.A.C. · RUC 20551234567 · 01 330 4455

# Descripción                      Unidad Cant.  Costo S/ unitario   Total
1 Compresor scroll 5 TR R-410A     UND      2    [        ]          —
    Cotizó S/ 3.850,00
2 Refrigerante R-410A              KG      25    [        ]          —
    Cotizó S/ 62,00
3 Filtro secador biflujo 3/8"      UND      4    [        ]          —
    Cotizó S/ 48,00
```

Lo que cotizó el proveedor se muestra **como referencia pero no se
precarga**: si viniera puesto, registrar sería confirmar sin mirar.

Lucía escribe los tres costos reales (que coincidieron con lo cotizado) y
el total se calcula solo:

```
1  2 × 3.850,00 = 7.700,00
2 25 ×    62,00 = 1.550,00
3  4 ×    48,00 =   192,00
                  ─────────
           TOTAL   9.442,00
```

> El total del costo (**9.442,00**) es menor que el de la cotización
> (**9.792,00**) porque el flete de S/ 350 era una línea extra del
> proveedor, no un ítem pedido. El costo se registra **por ítem del
> requerimiento**.

**Resultado:** *«Costo registrado — El requerimiento quedó finalizado»*.
Estado: **Finalizado**. En «Mis requerimientos» ya no está en Pendientes;
pasa a la pestaña **Finalizados**.

---

## Paso 8 — El histórico queda disponible para todos

**Pantalla:** `Base de costos` → `/costos/base`

La ven **los tres roles**, porque «¿cuánto costó esto la última vez?» se
la pregunta cualquiera. Buscando `Compresor`:

| Descripción | Unidad | Cant. | Costo unit. | Total | Proveedor | Requerimiento | Cliente |
|---|---|---|---|---|---|---|---|
| Compresor scroll 5 TR R-410A | UND | 2 | 3.850,00 | 7.700,00 | Refrigeración Andina S.A.C. | 001-000009 | Clínica San Gabriel S.A.C. |

Cada ítem costeado alimenta esta tabla automáticamente. La próxima vez
que alguien pida un compresor, aquí está lo que se pagó, a quién y
cuándo.

---

## Paso 9 — El SuperAdmin audita y exporta

### 9.1 La bitácora completa

**Pantalla:** `Auditoría de Costos` → `/costos/auditoria`

Se elige **Buscar por: Requerimiento**, se escribe el ID interno (`26`,
que no es lo mismo que el número de pedido `001-000009`) y se pulsa
**Buscar**.

Salen los **18 movimientos**, del primero al último, porque es un relato
y se lee hacia adelante:

```
Creación · Requerimiento     · Lucía Ramos   · Se creó el borrador para Clínica San Gabriel S.A.C.
Creación · Ítem              · Lucía Ramos   · Se agregó "Compresor scroll 5 TR R-410A" (2 UND)
Creación · Ítem              · Lucía Ramos   · Se agregó "Refrigerante R-410A" (25 KG)
Creación · Ítem              · Lucía Ramos   · Se agregó "Filtro secador biflujo 3/8"" (4 UND)
Emisión  · Requerimiento     · Lucía Ramos   · Se emitió 001-000009 con 3 ítem(s)
                                               estado: BORRADOR → PENDIENTE_REVISION
Envío de correo · Solicitud  · Rodolfo Díaz  · Se pidió cotización a Refrigeración Andina S.A.C.
                                               Motivo: MODO DESARROLLO: el correo se imprimió en la consola.
Envío de correo · Solicitud  · Rodolfo Díaz  · Se pidió cotización a Clima Total E.I.R.L.
Cambio de estado · Requerim. · Rodolfo Díaz  · estado: PENDIENTE_REVISION → PENDIENTE_COTIZACION
Creación · Cotización        · Rodolfo Díaz  · Se registró la cotización de Refrigeración Andina (4 líneas)
Cambio de estado · Requerim. · Rodolfo Díaz  · estado: PENDIENTE_COTIZACION → COTIZACIONES_RECIBIDAS
Creación · Cotización        · Rodolfo Díaz  · Se registró la cotización de Clima Total (3 líneas)
Cambio de estado · Requerim. · Rodolfo Díaz  · estado: COTIZACIONES_RECIBIDAS → EN_EVALUACION
Recomendación · Evaluación   · Rodolfo Díaz  · Ronda 1: se recomendó la cotización de Refrigeración Andina
                                               Motivo: (la justificación completa)
Cambio de estado · Requerim. · Rodolfo Díaz  · estado: EN_EVALUACION → PENDIENTE_APROBACION
Decisión · Aprobación        · Marta Quispe  · Se aceptó la cotización de Refrigeración Andina (ronda 1)
                                               Motivo: Aprobado por urgencia…
Cambio de estado · Requerim. · Marta Quispe  · estado: PENDIENTE_APROBACION → PENDIENTE_REGISTRO_COSTO
Registro de costo · Costo    · Lucía Ramos   · Se registró el costo de 3 ítem(s) con Refrigeración Andina
Cambio de estado · Requerim. · Lucía Ramos   · estado: PENDIENTE_REGISTRO_COSTO → FINALIZADO
```

Cada línea dice **quién, qué, cuándo** y —cuando el proceso lo exige—
**por qué**. El nombre se guarda como texto además del enlace a la
cuenta: si mañana se borra el usuario, la auditoría sigue sabiendo quién
hizo qué.

También se puede buscar **por una fila concreta** (un proveedor, un
cliente, un valor de catálogo) para responder «¿quién desactivó esto?».

### 9.2 Las descargas

Hay botones **Excel** y **PDF** en tres sitios:

| Documento | Dónde está el botón | Archivo que baja |
|---|---|---|
| Requerimiento | Detalle del requerimiento y expediente del Gestor | `requerimiento-001-000009.xlsx` / `.pdf` |
| Comparativo | Bloque «Comparación» (Gestor) y «Todas las cotizaciones» (Aprobador) | `comparativo-001-000009.xlsx` / `.pdf` |
| Costo | Bloque «Costo registrado» | `costo-001-000009.xlsx` / `.pdf` |

Los seis se generaron y se abrieron para comprobar el contenido. El
comparativo en PDF sale así:

```
Comparativo de cotizaciones 001-000009
N.º de pedido: 001-000009
Estado: pendiente de aprobación
Cliente: Clínica San Gabriel S.A.C.
Ítems pedidos: 3     Cotizaciones: 2     Total más bajo: S/ 8870.00

Cotizaciones recibidas
Proveedor                      RUC          Estado       Cubre  Plazo              Garantía   Total S/
Refrigeración Andina S.A.C.    20551234567  Recomendada  3/3    5 días hábiles     18 meses   9,792.00
Clima Total E.I.R.L.           20559876543  Registrada   3/3    20 días calendario 6 meses    8,870.00

Detalle por ítem
# Ítem                              Cant.  Proveedor                     P. unit. S/  Subtotal S/
1 Compresor scroll 5 TR (UND)         2    Refrigeración Andina S.A.C.     3,850.00     7,700.00
1 Compresor scroll 5 TR (UND)         2    Clima Total E.I.R.L.            3,600.00     7,200.00
…
```

El archivo se genera **en el momento de pedirlo** y no queda copia
guardada: así nunca se desincroniza de los datos.

---

## Qué se puede corregir después, y hasta cuándo (§54)

Un requerimiento no queda en piedra al emitirse. Esto es lo que rige:

| Qué se toca | Hasta cuándo | Quién |
|---|---|---|
| **Lugar y fecha de entrega** | **Siempre**, incluso Finalizado o Cancelado | Solicitante (o SuperAdmin) |
| Cliente, supervisor, los dos tipos, fecha de emisión | Solo en **Borrador** y **Observado** | Solicitante |
| Añadir, editar o eliminar **ítems** | Mientras **no esté cerrado**, incluso después de pedir cotizaciones | Solicitante |

**La logística no se congela nunca**, y es a propósito: una dirección
mal escrita no deja de estar mal porque el requerimiento se haya
cerrado, y bloquearla obligaba a convivir con el error para siempre. Lo
que evita que sea una puerta trasera es que **todo cambio queda en la
bitácora** con quién, cuándo y el valor anterior y nuevo. Ejemplo real
de la prueba, sobre un requerimiento ya cancelado:

```
Edición · Requerimiento · SuperAdmin
   lugarEntrega: "Planta Lurín" → "Planta Lurín (corregido)"
   fechaEntrega: "2026-08-15" → "2026-12-24"
```

**La configuración sí se cierra en cuanto sale de casa.** Si se intenta
cambiar el cliente de algo ya emitido, el sistema responde:

> El requerimiento está finalizado: a estas alturas solo se pueden
> cambiar el lugar y la fecha de entrega. Quita clienteId de la petición.

Cambiar el cliente de un requerimiento que ya salió a proveedores no es
corregir un dato, es otro requerimiento.

**Los ítems se congelan al cerrarse**, porque en un finalizado sostienen
las líneas del costo:

> No se pueden cambiar los ítems: el requerimiento está finalizado.
> Un requerimiento cerrado ya es registro.

### El retroceso automático

Mientras el requerimiento está vivo, tocar un ítem que alguien ya cotizó
tiene consecuencias, y el sistema las aplica solo:

- Si un proveedor ya había puesto precio a ese ítem, **su cotización
  queda marcada «pendiente de revisar»**, sale de la comparación y no se
  puede recomendar hasta que el Gestor la actualice. El aviso dice a
  quién hay que volver a pedirle precio.
- Si el ítem sostenía la recomendación **ya aprobada**, el requerimiento
  **vuelve solo** a «Cotizaciones recibidas»: el turno cambió de dueño,
  ya no es del Solicitante sino del Gestor. La aprobación no se borra —
  sigue constando quién aprobó y cuándo—; lo que se rehace es el camino.
- Si se elimina un ítem que estaba cotizado, las líneas de esos
  proveedores se conservan en su cotización pero quedan sin ítem, y se
  avisa de quiénes eran.

---

## Resumen del camino

```
BORRADOR ──emitir──▶ EN REVISIÓN ──dar paso──▶ ESPERANDO COTIZACIONES
   (Lucía)              (Rodolfo)                    (los proveedores)
                            │
                            └──observar──▶ OBSERVADO ──corregir──▶ EN REVISIÓN
                                             (Lucía)

ESPERANDO COTIZACIONES ──registrar──▶ COTIZACIONES RECIBIDAS ──evaluar──▶ EN EVALUACIÓN
                                                                            (Rodolfo)
                                                                                │
EN EVALUACIÓN ──recomendar──▶ ESPERANDO APROBACIÓN ──aceptar──▶ REGISTRA EL COSTO
                                     (Marta)         │              (Lucía)
                                                     ├─rechazar──▶ RECHAZADO ──▶ vuelve al Gestor
                                                     └─cerrar────▶ SIN ACUERDO (fin)

REGISTRA EL COSTO ──registrar costo──▶ FINALIZADO ──▶ Base de costos
```

En cada punto, **el estado dice de quién es el turno**. Y lo que cada
persona puede hacer no lo decide la pantalla: lo calcula el servidor con
la misma tabla que después lo hace cumplir, así que nunca se ofrece un
botón que luego dé error.

---

## Pendiente de configuración

Lo siguiente **está construido y funciona en el código**, pero no se
puede verificar de punta a punta hoy porque falta un dato externo. No es
una falla del sistema.

### 1. Envío real de correo a proveedores (Resend)

**Qué falta:** la clave de una cuenta de Resend y un dominio verificado
con SPF/DKIM.

**Qué hay que poner en `backend/.env`:**

```
RESEND_API_KEY=re_xxxxxxxxxxxx
CORREO_REMITENTE=cotizaciones@tudominio.com     ← buzón del dominio verificado
CORREO_NOMBRE_REMITENTE=HVC Comercial S.A.C.    ← opcional
URL_APP=http://localhost:5173                   ← o la URL pública real
```

**Qué está comprobado sin la clave:** el botón funciona, la solicitud se
registra con destinatario, fecha, quién la mandó y con qué versión de la
plantilla; el texto del correo se arma y se imprime en la consola. Se
probó además con una clave inválida a propósito: el sistema llamó de
verdad a Resend, recibió *«API key is invalid»* y guardó ese texto en la
columna de error sin tumbar la operación.

**Qué NO está comprobado:** que un correo llegue a la bandeja de un
proveedor. Cuando pongas la clave, prueba primero con un correo tuyo.

### 2. Plantilla de correo definitiva

**Qué falta:** el texto oficial que HVC quiere mandar.

Ahora mismo hay dos versiones de prueba publicadas
(`Administración de Costos → Correo`). Cuando escribas la real,
**publícala encima** y pasará a ser la versión 3. Las versiones no se
editan ni se borran a propósito: cada solicitud enviada guarda con cuál
salió.

### 3. Protección de las unidades de medida al borrarlas

Está resuelto: una unidad usada por algún ítem ya no se puede eliminar.
Solo conviene que sepas la regla elegida: **no** se cuentan las líneas de
cotización ni los ítems de costo históricos, porque existen justamente
para sobrevivir a que el catálogo cambie. Si prefieres el criterio
amplio, es un cambio de una línea.

---

*Recorrido ejecutado y verificado el 15 de agosto de 2026 sobre el
requerimiento 001-000009. Los datos de prueba de este recorrido se
eliminaron al terminar.*
