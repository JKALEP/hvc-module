Módulo de Costos y Cotizaciones HVAC

Especificación funcional, arquitectura y alcance

Documento maestro de definición funcional

Este documento consolida el flujo de negocio, responsabilidades, páginas, campos, estados, permisos y criterios de arquitectura definidos hasta este momento.

Importante: todavía no es el prompt de implementación para Claude Code. Es la especificación funcional y técnica que deberá servir como fuente de verdad antes de elaborar el prompt definitivo.

1. Objetivo

El módulo de Costos y Cotizaciones debe representar el proceso empresarial completo:

Requerimiento → revisión → solicitud de cotizaciones → recepción → comparación → selección → aprobación → registro del costo → histórico.

La prioridad es:

respetar la arquitectura existente;

no romper funcionalidades actuales;

separar responsabilidades por rol;

mantener trazabilidad;

evitar duplicar módulos;

diseñar para crecimiento futuro;

almacenar datos estructurados;

permitir PDF/Excel/correo como salidas, no como fuente primaria.

2. REGLA PRINCIPAL: AUDITAR ANTES DE MODIFICAR

Actualmente el proyecto ya tiene un módulo de Costos funcional.

Por lo tanto, NO se debe reconstruir desde cero.

Antes de modificar código se debe inspeccionar:

arquitectura;

frontend;

backend;

base de datos;

entidades;

endpoints;

autenticación;

autorización;

navegación;

módulo Costos;

módulo Personal;

clientes;

catálogos;

correo;

exportaciones;

funcionalidades actuales.

Cada funcionalidad existente debe clasificarse como:

CONSERVAR: funciona y pertenece al nuevo flujo.

ADAPTAR: es útil pero requiere cambios.

REUBICAR: pertenece a otro rol/submódulo.

DEPRECAR: ya no corresponde.

ELIMINAR: solo después de verificar dependencias y uso.

REVISAR: no existe suficiente información para decidir.

No eliminar funcionalidades simplemente porque no aparecen en esta especificación.

3. ARQUITECTURA Y ESCALABILIDAD

Este es uno de los requisitos más importantes.

El módulo debe integrarse en la arquitectura actual, no crear una aplicación paralela.

No duplicar innecesariamente:

usuarios;

autenticación;

clientes;

personal;

permisos;

conexión a BD;

servicios;

componentes;

layouts;

manejo de errores;

validaciones.

Si existe una solución correcta, reutilizarla.

Si existe pero no soporta el nuevo flujo, extenderla de forma compatible.

La solución debe poder evolucionar posteriormente hacia:

Costos
├── Requerimientos
├── Cotizaciones
├── Proveedores
├── Aprobaciones
├── Costos históricos
├── Catálogos
├── Plantillas
├── Reportes
└── Configuración

4. PROVEEDORES Y PERSONAL

Actualmente puede no existir una BDD madura de proveedores.

Eso no significa que todos los proveedores deban almacenarse como simples textos.

Debe existir una estructura propia y desacoplada para proveedores, preparada para una futura integración con un módulo corporativo.

Conceptualmente:

Proveedor
- id
- ruc
- razon_social
- nombre_comercial
- correo
- telefono
- direccion
- estado

Los campos definitivos deben revisarse contra el negocio y la arquitectura existente.

Lo mismo aplica a supervisores/personal.

Actualmente el módulo no debe quedar bloqueado porque todavía no exista una integración completa con Personal.

Posteriormente puede utilizarse una referencia a la entidad central de Personal.

5. IA: FUERA DEL ALCANCE ACTUAL

NO implementar actualmente:

IA;

OCR;

LLM;

extracción automática;

lectura automática de PDF;

interpretación automática de Excel;

clasificación automática de cotizaciones.

Los proveedores pueden enviar formatos completamente diferentes.

Flujo actual:

Proveedor
↓
Envía cotización
↓
Rodolfo recibe/revisa
↓
Rodolfo registra manualmente
↓
Sistema almacena datos estructurados

La arquitectura puede quedar preparada para una futura capa:

Cotización
↓
Servicio de extracción futuro
↓
Datos extraídos
↓
Revisión humana
↓
Confirmación

Pero esa capa no debe implementarse ahora.

6. EXCEL, PDF Y XML

El Excel existente es una referencia de formato, no la base de datos.

No guardar el requerimiento como:

Excel;

PDF;

XML.

La información principal debe estar estructurada en BD.

Posteriormente:

Datos estructurados
├── Vista web
├── PDF
├── Excel
└── Correo

Las exportaciones son representaciones de los datos, no su fuente.

7. JSON / JSONB

JSON/JSONB puede utilizarse para:

configuración de plantillas;

metadatos;

campos dinámicos;

configuración adicional;

futuras extensiones.

No almacenar todo el módulo como un JSON gigante.

Deben existir relaciones estructuradas para:

requerimientos;

ítems;

proveedores;

cotizaciones;

detalles de cotización;

evaluaciones;

aprobaciones;

costos;

detalles de costo;

historial.

8. ROLES

Los nombres Luis, Rodolfo y Jefe son personas, no roles técnicos.

Los roles deben representar responsabilidades.

8.1 Solicitante de Requerimientos

Ejemplo actual: Luis.

Puede:

crear requerimientos;

completar información;

agregar ítems;

revisar sus requerimientos;

responder observaciones;

consultar estados;

registrar el costo aprobado.

No puede aprobar su propia cotización.

8.2 Gestor de Cotizaciones

Ejemplo actual: Rodolfo.

Puede:

revisar requerimientos;

realizar observaciones;

compartir con proveedores;

seleccionar proveedores;

enviar solicitudes;

registrar cotizaciones;

comparar cotizaciones;

seleccionar/recomendar una;

justificar la selección.

No puede aprobar definitivamente su propia recomendación.

8.3 Aprobador de Cotizaciones

Ejemplo actual: Jefe/Supervisor.

Puede:

revisar requerimientos;

consultar todas las cotizaciones;

consultar la recomendación;

aceptar;

rechazar;

cerrar por falta de acuerdo;

registrar comentarios.

8.4 Administrador del módulo

Debe evaluarse contra la arquitectura existente.

Si ya existe un administrador general que puede gestionar catálogos, permisos y configuración, reutilizarlo.

Si no existe, puede existir un rol de administrador para:

proveedores;

catálogos;

tipos de mantenimiento;

tipos de requerimiento;

unidades;

plantillas;

correos;

configuración;

auditoría.

9. ACCESO POR USUARIO Y ROL

La asignación debe ser:

Usuario
↓
Módulo: Costos
↓
Rol dentro del módulo

Ejemplo:

Luis → Costos → Solicitante de Requerimientos
Rodolfo → Costos → Gestor de Cotizaciones
Jefe → Costos → Aprobador de Cotizaciones

Nunca codificar nombres de personas dentro del código.

La navegación debe depender de permisos.

10. FLUJO GENERAL

SOLICITANTE
    ↓
Emitir requerimiento
    ↓
Datos iniciales
    ↓
Plantilla editable
    ↓
Agregar ítems
    ↓
Vista previa
    ↓
Emitir
    ↓
GESTOR DE COTIZACIONES
    ↓
Revisión
    ↓
Observaciones si corresponde
    ↓
Compartir con proveedores
    ↓
Proveedores responden externamente
    ↓
Registrar cotizaciones
    ↓
Comparar
    ↓
Seleccionar/recomendar
    ↓
APROBADOR
    ↓
Aceptar / Rechazar / Sin acuerdo
    ↓
 ┌───────────────┬─────────────────┐
 │               │                 │
Aceptar        Rechazar        Sin acuerdo
 │               │                 │
 ↓               ↓                 ↓
Luis           Rodolfo          Finalizado
 │               │
 ↓               │
Registrar costo  └── Nuevo ciclo
 │
 ↓
Base de Costos

11. ESTADOS

Internamente no utilizar solamente “Pendiente” y “Finalizado”.

Se necesita suficiente detalle para conocer exactamente dónde se encuentra el proceso.

Estados conceptuales:

BORRADOR
PENDIENTE_REVISION
PENDIENTE_COTIZACION
COTIZACIONES_RECIBIDAS
EN_EVALUACION
PENDIENTE_APROBACION
APROBADO
RECHAZADO
SIN_ACUERDO
PENDIENTE_REGISTRO_COSTO
FINALIZADO
CANCELADO

Los nombres finales deben adaptarse al sistema existente.

La interfaz puede agrupar:

Requerimientos
├── Pendientes
└── Finalizados

Pero internamente debe existir el estado específico.

12. PÁGINA: EMITIR REQUERIMIENTO

En el sidebar:

Costos
└── Emitir requerimiento

Debe abrir una página completa, no una mini ventana.

13. FORMULARIO INICIAL

Campos definidos:

Tipo de mantenimiento

seleccionable;

configurable;

catálogo;

ejemplo: Preventivo.

No debe estar rígidamente quemado en frontend.

Tipo de requerimiento

seleccionable;

configurable;

ejemplo: Emergencia.

Supervisor

Seleccionable.

Debe quedar preparado para futura integración con Personal.

Cliente

Seleccionable.

Si ya existe catálogo de clientes, reutilizarlo.

Lugar de entrega

Dato correspondiente al requerimiento.

Fecha de entrega

Fecha requerida.

14. VALIDACIONES

Debe existir validación tanto en frontend como en backend.

Validar:

campos obligatorios;

tipos;

formatos;

fechas;

relaciones;

existencia de catálogos;

permisos;

coherencia del contenido.

No confiar únicamente en frontend.

No utilizar asteriscos de forma inconsistente para indicar obligatoriedad.

15. BOTONES INICIALES

Cancelar

Debe:

cancelar la creación;

limpiar/restablecer;

no guardar el requerimiento.

Continuar

Debe:

validar;

mostrar errores;

impedir avance si existen errores;

conservar temporalmente la información;

mostrar la plantilla.

16. PLANTILLA DEL REQUERIMIENTO

Al continuar aparece una plantilla web editable.

No es un Excel guardado.

Es una representación estructurada del requerimiento.

17. NÚMERO DE PEDIDO

Campo automático.

Formato:

001-000106

Debe:

generarse en backend/BD;

ser único;

ser seguro ante concurrencia;

no depender de frontend;

conservarse históricamente.

18. FECHA DE EMISIÓN

Se carga automáticamente con la fecha de creación.

Sin embargo, el usuario autorizado puede modificarla.

Debe diferenciarse:

fecha_emision

de:

created_at

La fecha real de creación debe mantenerse para auditoría.

19. TABLA DE ÍTEMS

Columnas:

DESCRIPCIÓN

UNIDAD

CANTIDAD

DETALLE DE OBSERVACIÓN

REFERENCIAS

20. AGREGAR ÍTEM

No se debe escribir directamente sobre una fila vacía.

Debe existir:

+ Añadir

Al hacer clic se abre un modal.

El fondo queda visualmente bloqueado.

21. MODAL DE ÍTEM

Campos:

Descripción — texto libre.

Unidad — unidad de medida.

Cantidad — número entero.

Detalle de observación — texto libre.

Referencias — texto libre.

Botones:

Cancelar
Aceptar

Cancelar no agrega nada.

Aceptar valida y agrega una fila.

22. FILAS DE ÍTEMS

Cada aceptación genera una nueva fila.

Ejemplo:

1 | Cinta aluminio | UND | 1 | ... | ...
2 | Adaptador      | UND | 2 | ... | ...

El usuario puede agregar sucesivamente.

23. ACCIONES DESPUÉS DE LOS ÍTEMS

Debe aparecer:

Cancelar
Continuar

Cancelar:

abandona la creación;

reinicia el proceso según la regla definida;

no emite.

Continuar:

pasa a vista previa.

24. VISTA PREVIA

Debe mostrar la misma plantilla pero:

NO editable.

El usuario revisa el documento completo.

Botones:

Cancelar
Emitir

25. EMITIR

Al emitir:

validar nuevamente en backend;

guardar requerimiento;

guardar ítems;

generar identificadores;

registrar usuario;

registrar fechas;

asignar estado;

registrar auditoría.

El requerimiento queda disponible para el Gestor de Cotizaciones.

26. PANEL DEL SOLICITANTE

Debe existir una sección para consultar sus requerimientos.

Conceptualmente:

Requerimientos
├── Pendientes
└── Finalizados

Debe mostrar:

número de requerimiento;

fecha de emisión;

estado;

información principal;

observaciones cuando existan.

27. OBSERVACIONES

Rodolfo puede enviar una observación.

Ejemplo:

Falta especificar la cantidad del ítem 3.

La observación debe quedar asociada al requerimiento.

Luis debe visualizar una alerta/indicador.

28. CORRECCIÓN

Luis puede corregir cuando el estado lo permita.

Rodolfo también puede corregir si tiene permiso.

Las modificaciones relevantes deben quedar auditadas.

No sobrescribir silenciosamente información histórica.

29. CONFIRMACIÓN DE OBSERVACIÓN

Debe existir una acción para que Luis deje constancia de que revisó/entendió la observación.

El nombre definitivo del botón se decidirá en diseño.

Registrar:

usuario;

fecha;

hora;

observación;

acción.

30. COMPARTIR CON PROVEEDORES

Rodolfo puede seleccionar uno o varios proveedores.

Debe poder:

buscar;

seleccionar;

agregar proveedor;

buscar por nombre;

buscar por RUC;

buscar por correo.

El objetivo es evitar escribir los correos repetidamente.

31. PROVEEDORES

Debe existir una entidad estructurada de proveedores.

Campos iniciales:

ID;

RUC;

razón social;

nombre comercial;

correo;

teléfono;

dirección;

estado.

Los campos obligatorios se definirán conforme a las reglas reales del negocio.

32. PLANTILLA DE CORREO

Debe existir una plantilla configurable para solicitar cotización.

Puede utilizar variables:

{{numero_requerimiento}}
{{cliente}}
{{lugar_entrega}}
{{fecha_entrega}}
{{proveedor}}
{{usuario}}

Debe poder evolucionar sin modificar el flujo principal.

Las versiones de plantillas usadas históricamente no deben cambiar retroactivamente.

33. ENVÍO

Al compartir:

enviar correo;

registrar proveedor;

registrar destinatario;

registrar fecha/hora;

registrar usuario;

registrar estado del envío.

No asumir que todos responderán.

34. RECEPCIÓN DE COTIZACIONES

Actualmente Rodolfo:

recibe correo;

revisa;

descarga la cotización;

vuelve al sistema;

registra la información.

La cotización debe estar asociada a:

Requerimiento + Proveedor

35. COTIZACIONES

Un requerimiento puede tener múltiples cotizaciones.

Ejemplo:

Requerimiento 001-000106

Cotización A → Proveedor A
Cotización B → Proveedor B
Cotización C → Proveedor C

36. FORMATOS DIFERENTES

Los proveedores no están obligados a utilizar el mismo formato.

El sistema no debe intentar imponerles una estructura externa.

Actualmente no interpretar automáticamente los documentos.

Rodolfo registra manualmente la información necesaria para comparación.

37. COMPARACIÓN

Rodolfo debe poder visualizar como mínimo:

proveedor;

RUC;

total;

garantía;

plazo;

condiciones;

observaciones;

información relevante.

Debe poder comparar varias cotizaciones del mismo requerimiento.

38. SELECCIÓN

Rodolfo selecciona una cotización.

Esta cotización queda:

RECOMENDADA

No:

APROBADA

La aprobación pertenece exclusivamente al Aprobador.

39. JUSTIFICACIÓN

Rodolfo debe escribir un texto indicando por qué seleccionó la cotización.

Debe poder explicar:

ventajas;

comparación;

condiciones;

motivo de elección.

La justificación queda almacenada.

40. PANEL DEL APROBADOR

El jefe/supervisor debe ver:

requerimiento;

ítems;

todas las cotizaciones;

cotización recomendada;

proveedor;

información económica;

garantía;

plazo;

justificación de Rodolfo.

La recomendada debe visualizarse claramente, por ejemplo en verde.

41. APROBACIÓN

Mientras el jefe no decida:

PENDIENTE_APROBACION

La recomendación de Rodolfo no equivale a aprobación.

42. ACEPTAR

Al aceptar:

registrar usuario;

registrar fecha/hora;

registrar decisión;

registrar comentario si corresponde;

marcar cotización como aprobada;

actualizar estado.

43. RECHAZAR

Al rechazar:

registrar motivo;

registrar usuario;

registrar fecha;

registrar estado;

enviar el flujo nuevamente a Rodolfo.

El rechazo no significa necesariamente cierre definitivo.

44. NUEVO CICLO

Ejemplo:

Jefe rechaza
↓
Motivo
↓
Rodolfo revisa
↓
Nueva cotización / nueva evaluación
↓
Nueva recomendación
↓
Jefe

El sistema debe permitir el ciclo sin destruir la información anterior.

45. CIERRE SIN ACUERDO

Debe existir una opción para finalizar el requerimiento cuando ya no continuará.

Ejemplo:

No se llegó a un acuerdo con los proveedores.

Entonces:

FINALIZADO
Motivo: SIN_ACUERDO

Esto evita que Luis quede esperando indefinidamente.

46. LUIS DESPUÉS DE LA APROBACIÓN

Luis ve:

Requerimiento aprobado

y una tarea:

Pendiente: registrar costo

47. REGISTRAR COSTO

Acción:

Registrar costo

Debe abrir una ventana superpuesta.

48. DATOS DEL PROVEEDOR

Debe mostrar/autocompletar:

Proveedor;

RUC;

Teléfono.

Estos datos deben provenir de la entidad del proveedor cuando exista.

49. PLANTILLA DE COSTOS

Después de confirmar los datos iniciales, se muestran los ítems del requerimiento.

Columnas:

Descripción

Unidad

Cantidad

Detalle de observación

Referencias

Costo en soles

Los primeros cinco datos se cargan automáticamente.

50. COSTO POR ÍTEM

Luis registra:

Costo S/

por cada ítem.

Debe ser:

numérico;

no negativo;

monetario;

validado;

almacenado con precisión apropiada.

51. CONFIRMACIÓN

Al confirmar:

crear/actualizar costo;

relacionar con requerimiento;

relacionar con proveedor;

relacionar con cotización aprobada;

registrar usuario;

registrar fecha;

actualizar estado.

52. BASE DE COSTOS

Debe permitir visualizar:

Descripción;

Unidad;

Cantidad;

Detalle de observación;

Referencias;

Costo.

Y conservar relaciones con:

requerimiento;

proveedor;

cotización;

usuario;

fecha.

53. HISTORIAL

Los cambios relevantes deben quedar auditados.

Registrar:

usuario;

fecha/hora;

acción;

valor anterior;

valor nuevo;

motivo si corresponde.

Nunca perder silenciosamente un valor histórico.

54. EDICIÓN DESPUÉS DEL ENVÍO

Debe definirse cuidadosamente qué campos pueden modificarse después de que un requerimiento ya fue enviado a proveedores.

Ejemplo crítico:

Cantidad: 10 → 100

Si ya existen cotizaciones, este cambio puede invalidar la comparación.

Por ello, antes de implementación definitiva se deben establecer reglas para:

edición;

versionado;

cambios críticos;

invalidación de cotizaciones;

reinicio del flujo.

No permitir una edición global sin considerar este problema.

55. MODELO DE DATOS CONCEPTUAL

Evaluar, contra las entidades existentes:

Requerimiento
RequerimientoItem

Proveedor

SolicitudCotizacion
Cotizacion
CotizacionItem

EvaluacionCotizacion

Aprobacion

Costo
CostoItem

Historial/Auditoria

No crear estas entidades a ciegas.

Primero revisar si ya existen equivalentes.

56. INTEGRIDAD DE DATOS

Relación conceptual:

Requerimiento
 ├── Items
 ├── Solicitudes a proveedores
 ├── Cotizaciones
 │     └── Items
 ├── Evaluaciones
 ├── Aprobaciones
 └── Costos
       └── Items

Estas relaciones no deben representarse únicamente mediante un JSON.

57. SEGURIDAD

La autorización debe existir en backend.

Ocultar botones en frontend NO es suficiente.

Ejemplo:

Luis no debe poder llamar directamente a un endpoint de aprobación.

El backend debe impedirlo.

58. CATÁLOGOS CONFIGURABLES

Como mínimo evaluar:

tipos de mantenimiento;

tipos de requerimiento;

unidades de medida;

proveedores;

supervisores/responsables;

plantillas de correo.

No utilizar enums rígidos para valores que el negocio necesita modificar.

59. NAVEGACIÓN POR ROL

Solicitante

Costos
├── Emitir requerimiento
├── Mis requerimientos
└── Costos pendientes

Gestor

Costos
├── Requerimientos
├── Cotizaciones
└── Proveedores

Aprobador

Costos
├── Pendientes de aprobación
└── Historial

Administrador

Costos
├── Configuración
├── Proveedores
├── Catálogos
├── Plantillas
└── Auditoría

Los nombres definitivos pueden cambiar durante diseño.

60. FUNCIONALIDADES ACTUALES DEL MÓDULO

El módulo existente puede contener funcionalidades adicionales.

No asumir automáticamente que todas deben permanecer.

Cada una debe revisarse:

Conservar

Si corresponde al nuevo proceso.

Adaptar

Si es útil pero está incompleta.

Reubicar

Si pertenece a otro rol o submódulo.

Deprecar

Si ya no corresponde.

Eliminar

Solo después de comprobar dependencias y uso.

Revisar

Si no se conoce todavía su finalidad.

Antes de eliminar:

revisar rutas;

endpoints;

BD;

migraciones;

dependencias;

usuarios;

reportes;

componentes.

61. NO DUPLICAR MÓDULOS

Si ya existe:

Clientes;

Personal;

Usuarios;

autenticación;

correo;

PDF;

Excel;

debe evaluarse primero reutilizarlo.

No crear versiones paralelas específicas de Costos sin una razón arquitectónica clara.

62. AUDITORÍA ANTES DE DESARROLLO

El análisis previo debe producir una matriz:

Funcionalidad actual

Estado

Acción

X

Funciona

Conservar

Y

Parcial

Adaptar

Z

No corresponde

Deprecar

A

Duplicada

Reubicar

B

Falta

Crear

Esto es obligatorio antes de realizar cambios grandes.

63. NO REGRESIÓN

No romper:

módulos existentes;

autenticación;

usuarios;

datos;

endpoints;

reportes;

integraciones.

Toda modificación debe considerar compatibilidad.

64. TRAZABILIDAD

El sistema debe poder reconstruir:

Luis creó
↓
Rodolfo revisó
↓
Rodolfo observó
↓
Luis corrigió
↓
Rodolfo compartió
↓
Proveedores recibieron
↓
Cotizaciones registradas
↓
Rodolfo recomendó
↓
Jefe aprobó/rechazó
↓
Luis registró costo

65. FECHAS

Distinguir:

fecha de emisión;

fecha de creación;

fecha de actualización;

fecha de envío;

fecha de cotización;

fecha de aprobación;

fecha de registro de costo.

No mezclar estos conceptos.

66. NUMERACIÓN

El formato:

001-000106

debe generarse de forma segura.

Debe evitar:

duplicados;

concurrencia;

números repetidos;

generación únicamente en frontend.

67. CORREO

El envío debe estar desacoplado del proceso principal cuando sea técnicamente posible.

Registrar:

destinatario;

fecha;

usuario;

estado;

error de envío si ocurre.

68. VERSIONADO DE PLANTILLAS

Las plantillas deben poder tener versión.

Ejemplo:

Plantilla Requerimiento HVAC
v1
v2
v3

Un requerimiento histórico debe conservar la versión utilizada.

69. EXPORTACIONES

PDF y Excel se generan desde los datos estructurados.

Nunca usar el PDF/Excel como fuente de información.

70. DOCUMENTOS DE PROVEEDORES

Si posteriormente se decide almacenar el documento recibido, debe tratarse como:

Documento / evidencia

relacionado con:

Cotización

No sustituye los datos estructurados.

71. FUTURAS INTEGRACIONES

La arquitectura debe permitir posteriormente:

módulo corporativo de Proveedores;

módulo Personal;

portal de proveedores;

IA/OCR;

ERP;

SUNAT;

dashboards;

notificaciones;

análisis de costos.

Estas funcionalidades no deben implementarse ahora salvo que ya existan y sean necesarias.

72. REPORTES FUTUROS

La estructura debe permitir posteriormente:

costo promedio;

costo por proveedor;

costo por material;

evolución de costos;

cantidad de cotizaciones;

tasa de aprobación;

tiempo de cotización;

tiempo de aprobación;

requerimientos sin acuerdo.

No es necesario construir todos estos reportes ahora.

73. ALCANCE ACTUAL

El núcleo del módulo es:

REQUERIMIENTO
+
COTIZACIÓN
+
APROBACIÓN
+
COSTO

No agregar complejidad por el simple hecho de que sea técnicamente posible.

74. CRITERIO PARA NUEVAS FUNCIONALIDADES

Antes de agregar una funcionalidad:

¿Pertenece al proceso real?

¿Qué rol la utiliza?

¿Qué problema resuelve?

¿Es necesaria ahora?

¿Ya existe en otro módulo?

¿Genera duplicación?

¿Afecta arquitectura?

¿Puede integrarse posteriormente?

¿Afecta estados?

¿Afecta auditoría?

¿Afecta datos históricos?

75. CRITERIO PARA ELIMINAR FUNCIONALIDADES

No eliminar por intuición.

Primero:

identificar;

documentar;

revisar dependencias;

verificar uso;

comprobar pertenencia al módulo;

determinar si debe reubicarse;

confirmar impacto en datos;

recién entonces decidir.

76. PRINCIPIO DE DISEÑO

No se busca tener muchas pantallas.

Se busca representar correctamente el negocio.

Prioridad:

claridad del proceso → separación de responsabilidades → integridad de datos → trazabilidad → escalabilidad → mantenibilidad.

77. RESULTADO ESPERADO

El módulo terminado debe permitir:

crear requerimiento;

seleccionar condiciones;

agregar ítems;

emitir;

revisar;

observar;

corregir;

compartir con proveedores;

recibir cotizaciones externamente;

registrar cotizaciones;

compararlas;

recomendar una;

justificar;

aprobar;

rechazar;

volver a evaluar;

cerrar sin acuerdo;

registrar costo;

conservar histórico;

auditar el proceso.

78. ESTADO DEL DOCUMENTO

Esta especificación corresponde a lo definido hasta este momento.

Todavía puede ampliarse con:

campos adicionales;

páginas;

reglas;

validaciones;

permisos;

estados;

catálogos;

diseño;

integraciones.

Cuando se termine de definir todo el módulo, este documento será la fuente de verdad para elaborar el prompt final de implementación para Claude Code.

El prompt final deberá ordenar a Claude:

inspeccionar el proyecto;

comparar el estado actual con esta especificación;

identificar funcionalidades existentes;

conservar lo correcto;

adaptar lo necesario;

eliminar solo lo justificado;

implementar lo faltante;

respetar la arquitectura;

evitar duplicaciones;

mantener escalabilidad y compatibilidad.