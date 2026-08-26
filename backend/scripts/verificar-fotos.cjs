/**
 * Verificación del módulo Fotos contra la API y la BD REALES.
 *
 * No comprueba que compile —para eso están `tsc` y el lint—: comprueba que
 * el modelo y los permisos se comporten. Por eso habla por HTTP y por SQL,
 * y no importa nada de `src/`: si el service miente, el test que lo importa
 * miente con él.
 *
 * Necesita el backend levantado (`npm run start:dev`).
 *
 *   node scripts/verificar-fotos.cjs             # todas las fases hechas
 *   node scripts/verificar-fotos.cjs --fase 2    # solo una
 *   node scripts/verificar-fotos.cjs --fase 11   # ciclos (rediseno, fase 1)
 *   node scripts/verificar-fotos.cjs --fase 12   # catalogo (rediseno, fase 2)
 *   node scripts/verificar-fotos.cjs --fase 13   # evidencia (rediseno, fase 3)
 */
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

const API = `http://localhost:${process.env.PORT ?? 3000}`;

let ok = 0;
let fallos = 0;
const pendientesDeLimpiar = [];

function check(nombre, condicion, detalle = '') {
  const sufijo = detalle ? ` — ${detalle}` : '';
  if (condicion) {
    ok++;
    console.log(`  ok    ${nombre}${sufijo}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre}${sufijo}`);
  }
}

function titulo(t) {
  console.log(`\n${t}`);
}

async function api(metodo, ruta, token, cuerpo) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  let datos = null;
  try {
    datos = await r.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  return { estado: r.status, datos };
}

/**
 * Espera que una sentencia falle y devuelve su mensaje.
 *
 * Cada llamada va en su propia transacción con ROLLBACK: un error deja la
 * transacción abortada en Postgres, así que sin aislarla la siguiente
 * comprobación fallaría por arrastre y no por lo que mide.
 */
async function debeFallar(db, sql) {
  await db.query('BEGIN');
  try {
    await db.query(sql);
    await db.query('ROLLBACK');
    return null;
  } catch (e) {
    await db.query('ROLLBACK');
    return e.message;
  }
}

/**
 * Entra y devuelve el token.
 *
 * El 429 se corta en seco en vez de devolver null: `/auth/login` está
 * limitado a 10/min y una corrida gasta media docena, así que dos seguidas
 * lo agotan. Sin este corte, el límite se manifestaba como veintitantos
 * fallos con 401 —uno por cada comprobación que usaba la cuenta— y parecía
 * que se había roto la autorización.
 */
/**
 * Entra, ESPERANDO al throttler en vez de rendirse.
 *
 * `/auth/login` admite 10/min y una corrida completa gasta bastantes más
 * —cada fase crea sus cuentas de prueba y entra con cada una—. El límite es
 * una protección real contra fuerza bruta (§ throttler) y **no se toca para
 * que pasen las pruebas**: es el script el que tiene que convivir con él.
 *
 * Por eso espera y reintenta en vez de abortar. Antes cortaba con un
 * mensaje pidiendo esperar un minuto a mano, y eso volvió la corrida
 * completa imposible en cuanto la Fase 5 añadió tres cuentas más.
 *
 * El 429 no trae `Retry-After`, así que se espera la ventana entera: son
 * 60 s como mucho, una vez, y solo si de verdad se agotó.
 */
async function entrar(email, password) {
  for (let intento = 0; intento < 3; intento++) {
    const r = await api('POST', '/auth/login', null, { email, password });

    if (r.estado === 429) {
      const espera = 61_000;
      console.log(
        `  … límite de /auth/login agotado; esperando ${espera / 1000} s a que se reabra la ventana`,
      );
      await new Promise((resolver) => setTimeout(resolver, espera));
      continue;
    }

    if (r.estado !== 200 && r.estado !== 201) return null;
    return r.datos?.token ?? null;
  }

  console.error(
    '\nEl límite de /auth/login siguió agotado tras dos esperas. ¿Hay otra corrida en marcha?',
  );
  process.exit(1);
}

// ═════════════════════════════════════════════════════════════
// FASE 1 — modelo de datos
// ═════════════════════════════════════════════════════════════
/**
 * El ciclo ABIERTO de un equipo, que es donde se trabaja.
 *
 * Desde la Fase 1 las actividades cuelgan de un CICLO y no de la carpeta: al
 * crear un equipo nace su Ciclo 1. Todas las llamadas de actividades del
 * script pasan por aquí en vez de repetir la consulta.
 */
async function cicloAbiertoDe(carpetaId, token) {
  const r = await api('GET', `/fotos/carpeta/${carpetaId}/ciclo`, token);
  const abierto = (r.datos ?? []).find((c) => c.cerradoEn === null);
  return abierto?.id ?? null;
}

async function fase1(db, token) {
  titulo('FASE 1 · estructura en la base');

  const tablasEsperadas = [
    'carpetas_fotos',
    'albumes_fotos',
    'actividades_fotos',
    'comentarios_fotos',
    'eventos_fotos',
    'plantillas_estructura_fotos',
    'plantillas_estructura_nodos_fotos',
  ];
  const tablas = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name = ANY($1)`,
    [tablasEsperadas],
  );
  check(
    'existen las tablas del módulo',
    tablas.rowCount === tablasEsperadas.length,
    `${tablas.rowCount}/${tablasEsperadas.length}`,
  );

  const viejas = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name IN ('sedes','lotes_fotos')`,
  );
  check('sedes y lotes_fotos ya no existen', viejas.rowCount === 0);

  const niveles = (
    await db.query(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
       WHERE t.typname='NivelFotos' ORDER BY e.enumsortorder`,
    )
  ).rows.map((r) => r.enumlabel);
  check(
    'NivelFotos son los tres niveles globales de §3',
    JSON.stringify(niveles) ===
      JSON.stringify(['LECTURA_GLOBAL', 'EDITOR_GLOBAL', 'ADMIN_GLOBAL']),
    niveles.join(','),
  );

  const permisos = (
    await db.query(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
       WHERE t.typname='PermisoCarpeta' ORDER BY e.enumsortorder`,
    )
  ).rows.map((r) => r.enumlabel);
  check(
    'PermisoCarpeta incluye SIN_ACCESO, la negación explícita de §7',
    permisos.includes('SIN_ACCESO'),
    permisos.join(','),
  );

  const estadoSede = await db.query(
    `SELECT 1 FROM pg_type WHERE typname='EstadoSede'`,
  );
  check('el enum EstadoSede se retiró', estadoSede.rowCount === 0);

  titulo('FASE 1 · los CHECK que Prisma no declara');

  // ⚠️ El módulo pasó de TRES CHECK a DOS en la Fase 1a de «Gestión de
  // contenido». Aquí había tres comprobaciones más sobre
  // `carpetas_fotos_equipo_segun_tipo_chk` —EQUIPO sin equipo, CARPETA con
  // equipo, y la FK contra un equipo inexistente—, y se fueron con él al
  // deshacerse el enlace con Gestión de Equipos.
  //
  // En su lugar se comprueba lo contrario, que es lo que ahora hay que
  // sostener: que el CHECK YA NO ESTÁ y que una carpeta de tipo EQUIPO se
  // inserta sin necesitar ninguna otra columna. Sin esto, una migración que
  // lo devolviera por descuido pasaría inadvertida.
  const checkRetirado = await db.query(
    `SELECT 1 FROM pg_constraint WHERE conname='carpetas_fotos_equipo_segun_tipo_chk'`,
  );
  check(
    'el CHECK carpetas_fotos_equipo_segun_tipo_chk se retiró',
    checkRetirado.rowCount === 0,
  );

  const columnaRetirada = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name='carpetas_fotos' AND column_name='equipoId'`,
  );
  check(
    'la columna carpetas_fotos.equipoId se retiró',
    columnaRetirada.rowCount === 0,
  );

  const comentarioHuerfano = await debeFallar(
    db,
    `INSERT INTO comentarios_fotos (texto,"autorNombre") VALUES ('__test__','X')`,
  );
  check(
    'comentario sin dueño se rechaza (§14)',
    comentarioHuerfano !== null && /un_solo_dueno/.test(comentarioHuerfano),
  );

  const fotoDosDuenos = await debeFallar(
    db,
    `INSERT INTO fotos ("cicloId","actividadId","subidaPorId","claveImagen","claveMiniatura",
                        "anchoPx","altoPx",bytes,"bytesOriginal",formato)
     VALUES (1,1,1,'a','b',1,1,1,1,'webp')`,
  );
  check(
    'foto colgando de ciclo Y actividad a la vez se rechaza',
    fotoDosDuenos !== null &&
      (/un_solo_dueno/.test(fotoDosDuenos) || /fkey/.test(fotoDosDuenos)),
    /fkey/.test(fotoDosDuenos ?? '')
      ? 'cortó antes la FK; el CHECK se prueba aparte'
      : '',
  );

  titulo('FASE 1 · la API responde con el modelo nuevo');

  const creada = await api('POST', '/fotos/carpeta', token, {
    nombre: `__verif__ ${Date.now()}`,
  });
  check('POST crea una carpeta', creada.estado === 201, `HTTP ${creada.estado}`);
  const carpetaId = creada.datos?.id;
  if (!carpetaId) return;
  pendientesDeLimpiar.push(carpetaId);

  const fila = (
    await db.query('SELECT * FROM carpetas_fotos WHERE id=$1', [carpetaId])
  ).rows[0];
  check(
    'propietarioId se fija al crear (§6)',
    fila.propietarioId != null,
    `propietarioId=${fila.propietarioId}`,
  );
  check(
    'ruta materializada correcta',
    fila.ruta === String(carpetaId),
    `ruta=${fila.ruta}`,
  );
  check('tipo por defecto CARPETA', fila.tipo === 'CARPETA');

  const hija = await api('POST', '/fotos/carpeta', token, {
    nombre: 'Frente 1',
    parentId: carpetaId,
  });
  check('crea subcarpeta', hija.estado === 201, `HTTP ${hija.estado}`);
  if (hija.datos?.id) {
    pendientesDeLimpiar.unshift(hija.datos.id);
    check(
      'la ruta de la hija es padre/hija',
      hija.datos.ruta === `${carpetaId}/${hija.datos.id}`,
      hija.datos.ruta,
    );
  }

  const dentro = await api('GET', `/fotos/carpeta/${carpetaId}`, token);
  check('GET de una carpeta responde', dentro.estado === 200);
  const tarjeta = (dentro.datos?.secciones ?? []).flatMap(
    (s) => s.carpetas,
  )[0];
  // ⚠️ La tarjeta contaba `albumes` además de `fotos`. Con los álbumes
  // retirados (Fase 4) el otro agrupador sería «visitas», que es un dato del
  // equipo y no del subárbol, así que se quedó solo el contador de fotos.
  check(
    'la tarjeta cuenta `fotos`, y ya no `albumes` ni `lotes`',
    Boolean(tarjeta) &&
      'fotos' in tarjeta &&
      !('albumes' in tarjeta) &&
      !('lotes' in tarjeta),
    tarjeta ? Object.keys(tarjeta).join(',') : 'sin tarjeta',
  );
  // ⚠️ Sigue sin traer `estado` —el `EstadoSede` ACTIVA/INACTIVA que se
  // retiró—, y desde la Fase 1 del rediseño trae `estadoEquipo`, que es otra
  // cosa: el estado del equipo en su ciclo más reciente. El nombre es
  // distinto justamente para que esta comprobación siga significando lo que
  // significaba.
  check(
    'la tarjeta ya no trae `estado` (el `EstadoSede` retirado)',
    Boolean(tarjeta) && !('estado' in tarjeta),
    tarjeta ? Object.keys(tarjeta).join(',') : 'sin tarjeta',
  );
}

// ═════════════════════════════════════════════════════════════
// FASE 2 — núcleo de autorización
//
// Siembra una cuenta por nivel global (§3) y un árbol con una rama
// restringida, y comprueba la cascada de §25 endpoint por endpoint. No
// mira `permisoSobre` por dentro: pide por HTTP y observa qué contesta,
// que es lo único que un atacante puede hacer.
// ═════════════════════════════════════════════════════════════

const CLAVE_PRUEBA = 'Verificar-Fase2!';

// ⚠️ Aquí vivía `sembrarEquipoDePrueba`, con sus dos constantes
// (`__VERIF-CHILLER`, `__VerifCarrier`).
//
// Creaba un equipo REAL en el catálogo de Gestión de Equipos —por la ruta
// `@SoloSuperAdmin` de ese módulo— para que la Fase 4 probara el enlace de
// §12, y las fases 5, 6 y 8 lo reutilizaban para poder tener una carpeta de
// tipo EQUIPO. No se borraba al terminar: la carpeta enlazada lo bloqueaba
// por el `Restrict`, que era justo una de las cosas que se comprobaban.
//
// Se retiró en la **Fase 1a de «Gestión de contenido»** junto con el enlace.
// Y la corrida sale ganando por partida doble: ya no queda una fila
// permanente en el catálogo de otro módulo entre corrida y corrida, y las
// fases que necesitan una carpeta de equipo dejan de depender de que ese
// catálogo tenga una organización con ubicaciones y campos configurados
// —una precondición externa que, si no se cumplía, hacía que la Fase 5 se
// OMITIERA en silencio y §13 se quedara sin probar—.

/** Crea (o reutiliza) una cuenta de prueba y devuelve su token e id. */
async function cuentaDePrueba(tokenAdmin, sufijo, permisos) {
  const email = `__verif_${sufijo}@prueba.local`;

  // Si quedó de una corrida anterior, se borra: los permisos se reemplazan
  // enteros y arrastrar los de antes falsearía la matriz.
  const existentes = await api('GET', '/usuario', tokenAdmin);
  const previa = (existentes.datos ?? []).find((u) => u.email === email);
  if (previa) {
    const borrada = await api('DELETE', `/usuario/${previa.id}`, tokenAdmin);
    // ⚠️ Puede FALLAR, y hay que decirlo aquí: si esa cuenta quedó siendo
    // propietaria de alguna carpeta —lo que pasa cuando una corrida se
    // interrumpe antes de `limpiar()`—, `propietarioId` es Restrict y el
    // borrado no procede. Sin este aviso, el síntoma era un 409 «ya existe
    // una cuenta con ese correo» tres líneas más abajo, que señala al sitio
    // equivocado. Se limpia con:
    //   DELETE de sus carpetas (de más profunda a menos) y luego la cuenta.
    if (borrada.estado !== 200 && borrada.estado !== 204) {
      console.log(
        `  FALLA no se pudo retirar la cuenta previa ${sufijo} — HTTP ${borrada.estado} ` +
          `${String(borrada.datos?.message ?? '')}\n` +
          `        (suele ser que quedó como propietaria de carpetas de una corrida interrumpida)`,
      );
      fallos++;
      return null;
    }
  }

  const creada = await api('POST', '/usuario', tokenAdmin, {
    email,
    nombre: `Verif ${sufijo}`,
    password: CLAVE_PRUEBA,
    permisos,
  });
  if (creada.estado !== 201) {
    console.log(
      `  FALLA no se pudo crear la cuenta ${sufijo} — HTTP ${creada.estado} ${JSON.stringify(creada.datos)}`,
    );
    fallos++;
    return null;
  }

  const token = await entrar(email, CLAVE_PRUEBA);
  return { id: creada.datos.id, email, token };
}

async function fase2(db, tokenAdmin) {
  titulo('FASE 2 · siembra');

  const modFotos = (nivel) => [
    nivel ? { modulo: 'FOTOS', nivelFotos: nivel } : { modulo: 'FOTOS' },
  ];

  const [adminG, editorG, lectorG, supervisor] = await Promise.all([
    cuentaDePrueba(tokenAdmin, 'adming', modFotos('ADMIN_GLOBAL')),
    cuentaDePrueba(tokenAdmin, 'editorg', modFotos('EDITOR_GLOBAL')),
    cuentaDePrueba(tokenAdmin, 'lectorg', modFotos('LECTURA_GLOBAL')),
    cuentaDePrueba(tokenAdmin, 'super', modFotos(null)),
  ]);
  if (!adminG || !editorG || !lectorG || !supervisor) return;
  check('las 4 cuentas de prueba entran', true, 'admin/editor/lector/supervisor');

  // Árbol: Proyecto (del SuperAdmin) → Enero, Inspecciones.
  const proyecto = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `__verif_proyecto ${Date.now()}`,
  });
  const enero = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Enero',
    parentId: proyecto.datos.id,
  });
  const inspecciones = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Inspecciones',
    parentId: proyecto.datos.id,
  });
  pendientesDeLimpiar.unshift(
    enero.datos.id,
    inspecciones.datos.id,
    proyecto.datos.id,
  );
  check(
    'árbol de prueba creado',
    proyecto.estado === 201 && enero.estado === 201 && inspecciones.estado === 201,
  );

  titulo('FASE 2 · niveles globales (§3) sobre una carpeta que nadie compartió');

  // §27.26: el usuario de oficina con Lectura Global ve Proyecto A sin que
  // nadie se lo comparta. Es la prueba de que el nivel es un SUELO.
  const verProyecto = async (token) =>
    (await api('GET', `/fotos/carpeta/${proyecto.datos.id}`, token)).estado;

  check('ADMIN_GLOBAL ve la carpeta', (await verProyecto(adminG.token)) === 200);
  check('EDITOR_GLOBAL ve la carpeta', (await verProyecto(editorG.token)) === 200);
  check(
    'LECTURA_GLOBAL ve la carpeta sin que nadie la comparta (§3.2, §27.26)',
    (await verProyecto(lectorG.token)) === 200,
  );
  // 404 y no 403 desde la Fase 3: a quien no llega a una carpeta no se le
  // confirma que exista. La cobertura de eso está en la Fase 3.
  check(
    'el supervisor SIN nivel NO la ve (§4) — ruta de ataque de §24',
    (await verProyecto(supervisor.token)) === 404,
    `HTTP ${await verProyecto(supervisor.token)}`,
  );

  titulo('FASE 2 · qué puede HACER cada nivel');

  const crearDentro = async (token, padreId, nombre) =>
    (
      await api('POST', '/fotos/carpeta', token, {
        nombre: `${nombre} ${Date.now()}`,
        parentId: padreId,
      })
    ).estado;

  const subLector = await crearDentro(
    lectorG.token,
    proyecto.datos.id,
    '__no_deberia',
  );
  check(
    'LECTURA_GLOBAL no puede crear subcarpetas (§3.2)',
    subLector === 403,
    `HTTP ${subLector}`,
  );

  // §5: compartir es de Acceso Total, y un EDITOR_GLOBAL tiene EDICION en
  // todo el árbol, no TOTAL. Se mide ANTES de que cree nada: en cuanto crea
  // una carpeta es su propietario y §6 le da TOTAL sobre ella —lo que se
  // comprueba justo debajo—.
  const antesDeCrear = await api(
    'GET',
    '/fotos/compartir/carpetas',
    editorG.token,
  );
  check(
    'EDITOR_GLOBAL no puede ofrecer carpetas ajenas para compartir (§5)',
    antesDeCrear.estado === 200 && antesDeCrear.datos.length === 0,
    `${antesDeCrear.datos?.length ?? '?'} carpetas`,
  );

  const creadaEditor = await api('POST', '/fotos/carpeta', editorG.token, {
    nombre: `__verif_editor ${Date.now()}`,
    parentId: proyecto.datos.id,
  });
  check(
    'EDITOR_GLOBAL sí puede crear subcarpetas (§3.3)',
    creadaEditor.estado === 201,
    `HTTP ${creadaEditor.estado}`,
  );
  if (creadaEditor.datos?.id) pendientesDeLimpiar.unshift(creadaEditor.datos.id);

  const despuesDeCrear = await api(
    'GET',
    '/fotos/compartir/carpetas',
    editorG.token,
  );
  check(
    'y entonces puede ofrecer SOLO la que creó, por propietario (§6)',
    despuesDeCrear.estado === 200 &&
      despuesDeCrear.datos.length === 1 &&
      despuesDeCrear.datos[0].id === creadaEditor.datos?.id,
    `${despuesDeCrear.datos?.length ?? '?'} carpetas`,
  );

  const compartiblesAdmin = await api(
    'GET',
    '/fotos/compartir/carpetas',
    adminG.token,
  );
  check(
    'ADMIN_GLOBAL las ofrece todas',
    compartiblesAdmin.estado === 200 && compartiblesAdmin.datos.length > 0,
    `${compartiblesAdmin.datos?.length ?? '?'} carpetas`,
  );

  titulo('FASE 2 · compartir con grado, y el techo de §26.8');

  const compartirCon = async (token, email, ids, permiso) =>
    api('POST', '/fotos/compartir', token, {
      email,
      carpetaIds: ids,
      permiso,
    });

  // El contrato que la Fase 1 rompió sin que nadie lo notara: el body va
  // con `carpetaIds`, no `sedeIds`.
  const conClaveVieja = await api('POST', '/fotos/compartir', tokenAdmin, {
    email: supervisor.email,
    sedeIds: [proyecto.datos.id],
    permiso: 'LECTURA',
  });
  check(
    'el body exige `carpetaIds` (regresión del renombrado)',
    conClaveVieja.estado === 400,
    `HTTP ${conClaveVieja.estado}`,
  );

  const sinPermiso = await api('POST', '/fotos/compartir', tokenAdmin, {
    email: supervisor.email,
    carpetaIds: [proyecto.datos.id],
  });
  check(
    'compartir sin grado se rechaza',
    sinPermiso.estado === 400,
    `HTTP ${sinPermiso.estado}`,
  );

  const gradoInventado = await compartirCon(
    tokenAdmin,
    supervisor.email,
    [proyecto.datos.id],
    'MANDAMAS',
  );
  check(
    'un grado inventado se rechaza',
    gradoInventado.estado === 400,
    `HTTP ${gradoInventado.estado}`,
  );

  const sinAccesoPorLaPuerta = await compartirCon(
    tokenAdmin,
    supervisor.email,
    [proyecto.datos.id],
    'SIN_ACCESO',
  );
  check(
    'SIN_ACCESO no se puede otorgar compartiendo (§7 es otra puerta)',
    sinAccesoPorLaPuerta.estado === 400,
    `HTTP ${sinAccesoPorLaPuerta.estado}`,
  );

  const compartido = await compartirCon(
    tokenAdmin,
    supervisor.email,
    [proyecto.datos.id],
    'LECTURA',
  );
  check(
    'el SuperAdmin comparte el proyecto con LECTURA',
    compartido.estado === 201,
    `HTTP ${compartido.estado}`,
  );

  titulo('FASE 2 · herencia (§7) y el grado que se concedió');

  const puedeVer = async (token, id) =>
    (await api('GET', `/fotos/carpeta/${id}`, token)).estado === 200;

  check(
    'con LECTURA en el proyecto, el supervisor ya lo ve',
    await puedeVer(supervisor.token, proyecto.datos.id),
  );
  check(
    'y HEREDA la lectura de Enero sin compartirla aparte (§7)',
    await puedeVer(supervisor.token, enero.datos.id),
  );

  const subSupervisor = await crearDentro(
    supervisor.token,
    enero.datos.id,
    '__no_deberia',
  );
  check(
    'pero con LECTURA no crea nada dentro (§5)',
    subSupervisor === 403,
    `HTTP ${subSupervisor}`,
  );

  const compartirDesdeLectura = await compartirCon(
    supervisor.token,
    'tercero@prueba.local',
    [enero.datos.id],
    'LECTURA',
  );
  check(
    'ni comparte lo que le compartieron a él (§5: hace falta TOTAL)',
    compartirDesdeLectura.estado === 403,
    `HTTP ${compartirDesdeLectura.estado}`,
  );

  titulo('FASE 2 · restricción explícita de §7');

  // «Proyecto A → Lectura, pero Inspecciones → Sin acceso». Se pone en la
  // tabla porque compartir no admite SIN_ACCESO: es una restricción, no una
  // concesión, y su endpoint es de una fase posterior.
  await db.query(
    `INSERT INTO accesos_compartidos ("usuarioId","carpetaId",permiso,"otorgadoPorId","actualizadoEn")
     VALUES ($1,$2,'SIN_ACCESO',$3,NOW())`,
    [supervisor.id, inspecciones.datos.id, 1],
  );

  check(
    'la subcarpeta restringida deja de verse, aunque la madre siga en LECTURA',
    !(await puedeVer(supervisor.token, inspecciones.datos.id)),
  );
  check(
    'y la madre se sigue viendo',
    await puedeVer(supervisor.token, proyecto.datos.id),
  );
  check(
    'y la hermana no restringida también',
    await puedeVer(supervisor.token, enero.datos.id),
  );

  // §8: ni siquiera como elemento bloqueado.
  const dentro = await api(
    'GET',
    `/fotos/carpeta/${proyecto.datos.id}`,
    supervisor.token,
  );
  const nombresVisibles = (dentro.datos?.carpetas ?? []).map((c) => c.nombre);
  check(
    'la carpeta restringida NO aparece en el listado de su madre (§8)',
    !nombresVisibles.includes('Inspecciones'),
    `ve: ${nombresVisibles.join(', ') || '(nada)'}`,
  );

  check(
    'una restricción NO afecta a quien tiene nivel global (§3.2)',
    await puedeVer(lectorG.token, inspecciones.datos.id),
  );

  titulo('FASE 2 · propietario (§6) y el techo de §26.8');

  // El supervisor sube a EDICION en Enero para poder crear algo suyo.
  await compartirCon(
    tokenAdmin,
    supervisor.email,
    [enero.datos.id],
    'EDICION',
  );
  const suya = await api('POST', '/fotos/carpeta', supervisor.token, {
    nombre: `__verif_suya ${Date.now()}`,
    parentId: enero.datos.id,
  });
  check(
    'con EDICION en Enero ya crea dentro',
    suya.estado === 201,
    `HTTP ${suya.estado}`,
  );

  if (suya.datos?.id) {
    pendientesDeLimpiar.unshift(suya.datos.id);

    const permisoEnLaSuya = (
      await api('GET', `/fotos/carpeta/${suya.datos.id}`, supervisor.token)
    ).datos?.permiso;
    check(
      'sobre la carpeta que creó tiene TOTAL por ser propietario (§6, §25.3)',
      permisoEnLaSuya === 'TOTAL',
      `permiso=${permisoEnLaSuya}`,
    );

    const compartirLaSuya = await compartirCon(
      supervisor.token,
      lectorG.email,
      [suya.datos.id],
      'LECTURA',
    );
    check(
      'y por eso SÍ puede compartirla (§5 + §6)',
      compartirLaSuya.estado === 201 || compartirLaSuya.estado === 400,
      `HTTP ${compartirLaSuya.estado}`,
    );

    // §26.8: su permiso EN ENERO es EDICION, así que no puede dar TOTAL ahí.
    const techo = await compartirCon(
      supervisor.token,
      'otro@prueba.local',
      [enero.datos.id],
      'TOTAL',
    );
    check(
      'no otorga TOTAL donde él solo tiene EDICION (§26.8)',
      techo.estado === 403,
      `HTTP ${techo.estado}`,
    );
  }

  titulo('FASE 2 · listar colaboradores exige TOTAL (§10)');

  const listarConLectura = await api(
    'GET',
    `/fotos/compartir/carpeta/${inspecciones.datos.id}`,
    lectorG.token,
  );
  check(
    'LECTURA_GLOBAL no ve la lista de colaboradores',
    listarConLectura.estado === 403,
    `HTTP ${listarConLectura.estado}`,
  );

  const listarConAdmin = await api(
    'GET',
    `/fotos/compartir/carpeta/${proyecto.datos.id}`,
    adminG.token,
  );
  check(
    'ADMIN_GLOBAL sí, y trae el grado de cada acceso',
    listarConAdmin.estado === 200 &&
      (listarConAdmin.datos?.accesos ?? []).every((a) => 'permiso' in a),
    `HTTP ${listarConAdmin.estado}`,
  );

  // Limpieza de las cuentas: van al final, cuando ya no se usan sus tokens.
  for (const c of [adminG, editorG, lectorG, supervisor])
    await api('DELETE', `/usuario/${c.id}`, tokenAdmin);
}

// ═════════════════════════════════════════════════════════════
// FASE 3 — carpetas y navegación
// ═════════════════════════════════════════════════════════════
async function fase3(db, tokenAdmin) {
  titulo('FASE 3 · no se confirma la existencia de lo ajeno (§24)');

  const supervisor = await cuentaDePrueba(tokenAdmin, 'f3super', [
    { modulo: 'FOTOS' },
  ]);
  if (!supervisor) return;

  const ajena = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `__verif_ajena ${Date.now()}`,
  });
  pendientesDeLimpiar.unshift(ajena.datos.id);

  const inexistente = await api('GET', '/fotos/carpeta/99999999', supervisor.token);
  const noCompartida = await api(
    'GET',
    `/fotos/carpeta/${ajena.datos.id}`,
    supervisor.token,
  );

  check(
    'una carpeta inexistente responde 404',
    inexistente.estado === 404,
    `HTTP ${inexistente.estado}`,
  );
  check(
    'una carpeta ajena responde EL MISMO 404, no 403',
    noCompartida.estado === 404,
    `HTTP ${noCompartida.estado}`,
  );
  check(
    'y con el MISMO mensaje: el estado tampoco delata la existencia',
    inexistente.datos?.message === noCompartida.datos?.message,
    JSON.stringify(noCompartida.datos?.message),
  );

  // A quien SÍ la ve pero le falta grado se le sigue explicando qué falta.
  await api('POST', '/fotos/compartir', tokenAdmin, {
    email: supervisor.email,
    carpetaIds: [ajena.datos.id],
    permiso: 'LECTURA',
  });
  const sinGrado = await api(
    'DELETE',
    `/fotos/carpeta/${ajena.datos.id}`,
    supervisor.token,
  );
  check(
    'con LECTURA, eliminar da 403 y dice qué grado falta (no un 404 opaco)',
    sinGrado.estado === 403 && /no alcanza para/.test(sinGrado.datos?.message ?? ''),
    `HTTP ${sinGrado.estado} · ${sinGrado.datos?.message ?? ''}`,
  );

  titulo('FASE 3 · contadores exactos POR USUARIO');

  // Árbol: Obra → Visible (1 álbum, 2 fotos) y Oculta (1 álbum, 3 fotos).
  const obra = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `__verif_obra ${Date.now()}`,
  });
  // ⚠️ De tipo EQUIPO desde la Fase 4: las fotos cuelgan de un CICLO, y solo
  // un equipo tiene ciclos. Una carpeta corriente ya no puede tener fotos.
  const visible = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Visible',
    parentId: obra.datos.id,
    tipo: 'EQUIPO',
  });
  const oculta = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Oculta',
    parentId: obra.datos.id,
    tipo: 'EQUIPO',
  });
  pendientesDeLimpiar.unshift(visible.datos.id, oculta.datos.id, obra.datos.id);

  // Fotos por SQL: contar no necesita subir nada a R2. Cuelgan del ciclo que
  // el equipo trae de fábrica, que es donde vive ahora una foto suelta.
  const sembrarFotos = async (carpetaId, cuantas) => {
    const ciclo = await db.query(
      'SELECT id FROM ciclos_fotos WHERE "carpetaId" = $1 LIMIT 1',
      [carpetaId],
    );
    const cicloId = ciclo.rows[0].id;
    for (let i = 0; i < cuantas; i++)
      await db.query(
        `INSERT INTO fotos ("cicloId","subidaPorId","claveImagen","claveMiniatura",
                            "anchoPx","altoPx",bytes,"bytesOriginal",formato)
         VALUES ($1,$2,$3,$4,10,10,10,10,'webp')`,
        [cicloId, 1, `__v/${carpetaId}/${i}`, `__v/${carpetaId}/t${i}`],
      );
    return cicloId;
  };
  const cicloVisible = await sembrarFotos(visible.datos.id, 2);
  const cicloOculta = await sembrarFotos(oculta.datos.id, 3);

  await api('POST', '/fotos/compartir', tokenAdmin, {
    email: supervisor.email,
    carpetaIds: [obra.datos.id],
    permiso: 'LECTURA',
  });
  await db.query(
    `INSERT INTO accesos_compartidos ("usuarioId","carpetaId",permiso,"otorgadoPorId","actualizadoEn")
     VALUES ($1,$2,'SIN_ACCESO',$3,NOW())`,
    [supervisor.id, oculta.datos.id, 1],
  );

  const tarjetaDeObra = async (token) => {
    const r = await api('GET', '/fotos/carpeta', token);
    return (r.datos?.secciones ?? [])
      .flatMap((s) => s.carpetas)
      .find((c) => c.id === obra.datos.id);
  };

  const paraAdmin = await tarjetaDeObra(tokenAdmin);
  check(
    'el SuperAdmin ve las 5 fotos del subárbol',
    paraAdmin?.fotos === 5,
    `fotos=${paraAdmin?.fotos} subcarpetas=${paraAdmin?.subcarpetas}`,
  );

  // El supervisor llega a Obra por lo compartido, así que la tarjeta le sale
  // en su raíz de «Compartido conmigo».
  const paraSupervisor = await tarjetaDeObra(supervisor.token);
  check(
    'el supervisor solo cuenta las 2 de la rama que ve, no las 5',
    paraSupervisor?.fotos === 2,
    `fotos=${paraSupervisor?.fotos}`,
  );
  check(
    'y solo 1 subcarpeta, no 2',
    paraSupervisor?.subcarpetas === 1,
    `subcarpetas=${paraSupervisor?.subcarpetas}`,
  );

  titulo('FASE 3 · secciones de la raíz (§8, §21)');

  const raizSupervisor = await api('GET', '/fotos/carpeta', supervisor.token);
  const claves = (raizSupervisor.datos?.secciones ?? []).map((s) => s.clave);
  check(
    'sin nivel global, la raíz llega en secciones y no como lista plana',
    Array.isArray(raizSupervisor.datos?.secciones) &&
      !('carpetas' in (raizSupervisor.datos ?? {})),
    `claves: ${claves.join(', ') || '(ninguna)'}`,
  );
  check(
    'lo que le compartieron cae en «compartidas», no en «propias»',
    claves.includes('compartidas') && !claves.includes('propias'),
    claves.join(', '),
  );

  const raizAdmin = await api('GET', '/fotos/carpeta', tokenAdmin);
  const clavesAdmin = (raizAdmin.datos?.secciones ?? []).map((s) => s.clave);
  check(
    'con nivel global, UNA sección con el árbol entero',
    clavesAdmin.length === 1 && clavesAdmin[0] === 'todas',
    clavesAdmin.join(', '),
  );

  // Una carpeta creada por el supervisor tiene que salirle en «Mis carpetas».
  await api('POST', '/fotos/compartir', tokenAdmin, {
    email: supervisor.email,
    carpetaIds: [visible.datos.id],
    permiso: 'EDICION',
  });
  const suya = await api('POST', '/fotos/carpeta', supervisor.token, {
    nombre: `__verif_suya3 ${Date.now()}`,
    parentId: visible.datos.id,
  });
  check(
    'POST /fotos/carpeta crea (la ruta nueva, sin /fotos/sede)',
    suya.estado === 201,
    `HTTP ${suya.estado}`,
  );
  if (suya.datos?.id) pendientesDeLimpiar.unshift(suya.datos.id);

  // A propósito con la ruta VIEJA: esta comprobación existe para confirmar
  // que murió, así que es la única del archivo que no debe migrarse.
  const vieja = await api('POST', '/fotos/sede', tokenAdmin, {
    nombre: '__no_deberia',
  });
  check(
    '/fotos/sede ya no existe',
    vieja.estado === 404,
    `HTTP ${vieja.estado}`,
  );

  titulo('FASE 3 · buscar y ordenar (§11)');

  const busqueda = await api(
    'GET',
    `/fotos/carpeta?q=${encodeURIComponent('Visible')}`,
    supervisor.token,
  );
  check(
    'buscar devuelve una sección de resultados',
    busqueda.datos?.secciones?.[0]?.clave === 'busqueda',
    `clave: ${busqueda.datos?.secciones?.[0]?.clave}`,
  );
  check(
    'y encuentra la carpeta por nombre estando en la raíz',
    (busqueda.datos?.secciones?.[0]?.carpetas ?? []).some(
      (c) => c.id === visible.datos.id,
    ),
  );

  const buscaOculta = await api(
    'GET',
    `/fotos/carpeta?q=${encodeURIComponent('Oculta')}`,
    supervisor.token,
  );
  check(
    'la búsqueda NO devuelve lo que tiene restringido (§7 + §24)',
    (buscaOculta.datos?.secciones ?? []).length === 0,
    `${(buscaOculta.datos?.secciones?.[0]?.carpetas ?? []).length} resultados`,
  );

  const porNombre = await api(
    'GET',
    `/fotos/carpeta/${obra.datos.id}?orden=nombre`,
    tokenAdmin,
  );
  const porNombreDesc = await api(
    'GET',
    `/fotos/carpeta/${obra.datos.id}?orden=nombre-desc`,
    tokenAdmin,
  );
  const nombresAsc = (porNombre.datos?.secciones?.[0]?.carpetas ?? []).map(
    (c) => c.nombre,
  );
  const nombresDesc = (porNombreDesc.datos?.secciones?.[0]?.carpetas ?? []).map(
    (c) => c.nombre,
  );
  check(
    'el orden invierte el listado',
    nombresAsc.length >= 2 &&
      JSON.stringify(nombresAsc) === JSON.stringify([...nombresDesc].reverse()),
    `${nombresAsc.join(',')} vs ${nombresDesc.join(',')}`,
  );

  const ordenBasura = await api(
    'GET',
    `/fotos/carpeta/${obra.datos.id}?orden=$(rm)`,
    tokenAdmin,
  );
  check(
    'un orden inventado no rompe: cae al de por defecto',
    ordenBasura.estado === 200,
    `HTTP ${ordenBasura.estado}`,
  );

  titulo('FASE 3 · recientes (§21)');

  const recientes = await api('GET', '/fotos/recientes', supervisor.token);
  const idsRecientes = (recientes.datos?.carpetas ?? []).map((c) => c.id);
  check(
    'GET /fotos/recientes responde',
    recientes.estado === 200,
    `HTTP ${recientes.estado}`,
  );
  check(
    'y respeta la restricción: no incluye la carpeta negada',
    !idsRecientes.includes(oculta.datos.id),
    `${idsRecientes.length} carpetas`,
  );

  titulo('FASE 3 · mover');

  const aRaiz = await api(
    'PATCH',
    `/fotos/carpeta/${suya.datos.id}`,
    supervisor.token,
    { parentId: null },
  );
  check(
    'sin nivel global no se puede mover al primer nivel',
    aRaiz.estado === 403,
    `HTTP ${aRaiz.estado}`,
  );

  const dentroDeSi = await api(
    'PATCH',
    `/fotos/carpeta/${obra.datos.id}`,
    tokenAdmin,
    { parentId: visible.datos.id },
  );
  check(
    'no se puede mover una carpeta dentro de su propia descendencia',
    dentroDeSi.estado === 400,
    `HTTP ${dentroDeSi.estado}`,
  );

  // Colisión de nombre en el destino: antes reventaba con un P2002 en crudo.
  const gemela = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Visible',
    parentId: oculta.datos.id,
  });
  const choque = await api(
    'PATCH',
    `/fotos/carpeta/${gemela.datos.id}`,
    tokenAdmin,
    { parentId: obra.datos.id },
  );
  check(
    'mover a un destino que ya tiene ese nombre da 409, no un 500 de Prisma',
    choque.estado === 409,
    `HTTP ${choque.estado} · ${choque.datos?.message ?? ''}`,
  );

  // Fuera la gemela antes de mover de verdad: si se queda, «Visible» ya no
  // cabe dentro de «Oculta» y el choque de nombres taparía lo que viene.
  await api('DELETE', `/fotos/carpeta/${gemela.datos.id}`, tokenAdmin);

  // Mover de verdad, y comprobar que la descendencia se reprefija.
  const movida = await api(
    'PATCH',
    `/fotos/carpeta/${visible.datos.id}`,
    tokenAdmin,
    { parentId: oculta.datos.id },
  );
  check('mover responde', movida.estado === 200, `HTTP ${movida.estado}`);
  if (movida.estado === 200) {
    const filas = await db.query(
      'SELECT id, ruta FROM carpetas_fotos WHERE id = ANY($1)',
      [[visible.datos.id, suya.datos.id]],
    );
    const rutaMovida = filas.rows.find((f) => f.id === visible.datos.id)?.ruta;
    const rutaHija = filas.rows.find((f) => f.id === suya.datos.id)?.ruta;
    check(
      'la carpeta movida cuelga del nuevo padre',
      rutaMovida === `${obra.datos.ruta}/${oculta.datos.id}/${visible.datos.id}`,
      `ruta=${rutaMovida}`,
    );
    check(
      'y su descendencia se reprefijó con ella',
      typeof rutaHija === 'string' && rutaHija.startsWith(`${rutaMovida}/`),
      `ruta hija=${rutaHija}`,
    );
    // Devolverla a su sitio para que la limpieza por FK no se atasque.
    await api('PATCH', `/fotos/carpeta/${visible.datos.id}`, tokenAdmin, {
      parentId: obra.datos.id,
    });
  }

  titulo('FASE 3 · archivar tiene su propia ruta');

  const archivadoPorSupervisor = await api(
    'POST',
    `/fotos/carpeta/${visible.datos.id}/archivar`,
    supervisor.token,
  );
  check(
    'archivar sigue siendo del ADMIN_GLOBAL',
    archivadoPorSupervisor.estado === 403,
    `HTTP ${archivadoPorSupervisor.estado}`,
  );

  const archivado = await api(
    'POST',
    `/fotos/carpeta/${visible.datos.id}/archivar`,
    tokenAdmin,
  );
  check(
    'el admin archiva',
    archivado.estado === 201 && archivado.datos?.cerrada === true,
    `HTTP ${archivado.estado} cerrada=${archivado.datos?.cerrada}`,
  );

  const enArchivada = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: '__no_deberia',
    parentId: visible.datos.id,
  });
  check(
    'en una rama archivada no se crea nada, ni siendo admin',
    enArchivada.estado === 403,
    `HTTP ${enArchivada.estado}`,
  );

  const reabierto = await api(
    'POST',
    `/fotos/carpeta/${visible.datos.id}/reabrir`,
    tokenAdmin,
  );
  check(
    'y se reabre',
    reabierto.estado === 201 && reabierto.datos?.cerrada === false,
    `HTTP ${reabierto.estado} cerrada=${reabierto.datos?.cerrada}`,
  );

  // Limpieza de lo sembrado por SQL (las FK son Restrict hacia carpetas).
  await db.query('DELETE FROM fotos WHERE "cicloId" = ANY($1)', [
    [cicloVisible, cicloOculta],
  ]);
  await api('DELETE', `/usuario/${supervisor.id}`, tokenAdmin);
}

// ═════════════════════════════════════════════════════════════
// FASE 4 — enlace de solo lectura con el catálogo de Equipos (§12)
// ═════════════════════════════════════════════════════════════
/** Sube UN archivo al campo `foto` (la subida de un campo de tipo FOTO). */
async function subirUnaImagen(ruta, token, buffer) {
  const form = new FormData();
  form.append('foto', new Blob([buffer], { type: 'image/jpeg' }), 'campo.jpg');
  const r = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  let datos = null;
  try {
    datos = await r.json();
  } catch {
    /* sin cuerpo */
  }
  return { estado: r.status, datos };
}

/**
 * FASE 4 · los campos configurables del EQUIPO (Fase 1b).
 *
 * ⚠️ Este hueco lo ocupaban 18 comprobaciones sobre `/fotos/catalogo-equipos`,
 * la puerta de Fotos al catálogo de Gestión de Equipos (§12). Se retiraron
 * con el enlace en la Fase 1a y el número de fase se dejó libre a propósito
 * para lo que ahora ocupa su sitio: la información del equipo, que pasó a
 * ser PROPIA de Fotos y configurable sin tocar código.
 *
 * Las definiciones son GLOBALES al módulo —no cuelgan de ninguna carpeta—,
 * así que esta fase limpia las suyas al terminar o quedarían en la
 * configuración real. Y se limpian DESPUÉS de las carpetas: un campo con
 * valores no se puede borrar, que es justo una de las reglas que se prueba.
 */
async function fase4(db, tokenAdmin) {
  titulo('FASE 4 · campos configurables del equipo — definiciones');

  const admin = await cuentaDePrueba(tokenAdmin, 'f4admin', [
    { modulo: 'FOTOS', nivelFotos: 'ADMIN_GLOBAL' },
  ]);
  const editorG = await cuentaDePrueba(tokenAdmin, 'f4editor', [
    { modulo: 'FOTOS', nivelFotos: 'EDITOR_GLOBAL' },
  ]);
  const supervisor = await cuentaDePrueba(tokenAdmin, 'f4super', [
    { modulo: 'FOTOS' },
  ]);
  if (!admin || !editorG || !supervisor) return;

  const camposCreados = [];
  const marca = Date.now();

  // Configurar los campos es de ADMIN_GLOBAL; usarlos, no.
  const porEditor = await api('POST', '/fotos/campo', editorG.token, {
    nombre: `NoDebe ${marca}`,
    tipo: 'TEXTO',
  });
  check(
    'un EDITOR_GLOBAL no configura campos: es administrar el módulo',
    porEditor.estado === 403,
    `HTTP ${porEditor.estado}`,
  );
  const porSupervisor = await api('POST', '/fotos/campo', supervisor.token, {
    nombre: `NoDebe2 ${marca}`,
    tipo: 'TEXTO',
  });
  check(
    'un supervisor tampoco',
    porSupervisor.estado === 403,
    `HTTP ${porSupervisor.estado}`,
  );

  // Pero LEER la lista sí: hace falta para pintar el formulario.
  const leeSupervisor = await api('GET', '/fotos/campo', supervisor.token);
  check(
    'un supervisor SÍ lista los campos: los necesita para el formulario',
    leeSupervisor.estado === 200 && Array.isArray(leeSupervisor.datos),
    `HTTP ${leeSupervisor.estado}`,
  );

  const tipoMalo = await api('POST', '/fotos/campo', admin.token, {
    nombre: `Malo ${marca}`,
    tipo: 'COLOR',
  });
  check(
    'un tipo inventado se rechaza nombrando los válidos',
    tipoMalo.estado === 400 && /TEXTO/.test(tipoMalo.datos?.message ?? ''),
    `HTTP ${tipoMalo.estado}`,
  );

  const listaSinOpciones = await api('POST', '/fotos/campo', admin.token, {
    nombre: `Lista vacia ${marca}`,
    tipo: 'LISTA',
  });
  check(
    'una LISTA sin opciones se rechaza: no habría nada que elegir',
    listaSinOpciones.estado === 400,
    `HTTP ${listaSinOpciones.estado}`,
  );

  const textoConOpciones = await api('POST', '/fotos/campo', admin.token, {
    nombre: `Texto raro ${marca}`,
    tipo: 'TEXTO',
    opciones: ['a', 'b'],
  });
  check(
    'un TEXTO con opciones se rechaza: no lleva',
    textoConOpciones.estado === 400,
    `HTTP ${textoConOpciones.estado}`,
  );

  // Los siete tipos, uno por uno.
  const definiciones = {};
  for (const [tipo, nombre] of [
    ['TEXTO', `Marca ${marca}`],
    ['TEXTO_LARGO', `Observaciones ${marca}`],
    ['NUMERO', `Potencia ${marca}`],
    ['FECHA', `Instalado ${marca}`],
    ['BOOLEANO', `Operativo ${marca}`],
    ['FOTO', `Placa ${marca}`],
  ]) {
    const r = await api('POST', '/fotos/campo', admin.token, { nombre, tipo });
    if (r.estado === 201) {
      definiciones[tipo] = r.datos;
      camposCreados.push(r.datos.id);
    }
    check(
      `se crea un campo de tipo ${tipo}`,
      r.estado === 201,
      `HTTP ${r.estado}`,
    );
  }

  const lista = await api('POST', '/fotos/campo', admin.token, {
    nombre: `Refrigerante ${marca}`,
    tipo: 'LISTA',
    opciones: ['R-410A', 'R-32', 'R-22'],
  });
  if (lista.estado === 201) {
    definiciones.LISTA = lista.datos;
    camposCreados.push(lista.datos.id);
  }
  check(
    'se crea una LISTA con sus tres opciones',
    lista.estado === 201 && lista.datos?.opciones?.length === 3,
    `HTTP ${lista.estado} · ${lista.datos?.opciones?.length} opcion(es)`,
  );

  check(
    'la clave se deriva del nombre, sin tildes ni espacios',
    /^[a-z0-9_]+$/.test(definiciones.TEXTO?.clave ?? ''),
    definiciones.TEXTO?.clave,
  );

  const repetido = await api('POST', '/fotos/campo', admin.token, {
    nombre: `Marca ${marca}`,
    tipo: 'TEXTO',
  });
  check(
    'dos campos con la misma clave se rechazan con 409',
    repetido.estado === 409,
    `HTTP ${repetido.estado}`,
  );

  titulo('FASE 4 · rellenarlos es OTRO permiso, y solo en un EQUIPO');

  const raiz = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `__verif_f4 ${marca}`,
  });
  pendientesDeLimpiar.unshift(raiz.datos.id);

  const corriente = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Carpeta corriente',
    parentId: raiz.datos.id,
  });
  pendientesDeLimpiar.unshift(corriente.datos.id);

  const equipo = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Chiller 01',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
  });
  pendientesDeLimpiar.unshift(equipo.datos.id);
  const equipoId = equipo.datos.id;

  const cTexto = definiciones.TEXTO?.clave;
  const cNumero = definiciones.NUMERO?.clave;
  const cFecha = definiciones.FECHA?.clave;
  const cBool = definiciones.BOOLEANO?.clave;
  const cLista = definiciones.LISTA?.clave;
  const cLargo = definiciones.TEXTO_LARGO?.clave;
  const cFoto = definiciones.FOTO?.clave;

  const enCorriente = await api(
    'PUT',
    `/fotos/carpeta/${corriente.datos.id}/campo`,
    tokenAdmin,
    { valores: { [cTexto]: 'Carrier' } },
  );
  check(
    'una carpeta CORRIENTE no lleva campos de equipo',
    enCorriente.estado === 400,
    `HTTP ${enCorriente.estado}`,
  );

  const guardado = await api(
    'PUT',
    `/fotos/carpeta/${equipoId}/campo`,
    tokenAdmin,
    {
      valores: {
        [cTexto]: 'Carrier',
        [cLargo]: 'Ruido anormal en el compresor',
        [cNumero]: '12.5',
        [cFecha]: '2026-03-15',
        [cBool]: true,
        [cLista]: definiciones.LISTA?.opciones?.[0]?.id,
      },
    },
  );
  check(
    'se guardan los seis campos de una vez',
    guardado.estado === 200,
    `HTTP ${guardado.estado}`,
  );

  const porClave = (ficha, clave) =>
    (ficha ?? []).find((c) => c.clave === clave);

  const ficha = await api(
    'GET',
    `/fotos/carpeta/${equipoId}/campo`,
    tokenAdmin,
  );
  check(
    'y se leen de vuelta con el tipo que les toca',
    porClave(ficha.datos, cTexto)?.valor === 'Carrier' &&
      porClave(ficha.datos, cNumero)?.valor === 12.5 &&
      porClave(ficha.datos, cBool)?.valor === true,
    JSON.stringify([
      porClave(ficha.datos, cTexto)?.valor,
      porClave(ficha.datos, cNumero)?.valor,
      porClave(ficha.datos, cBool)?.valor,
    ]),
  );

  // ⚠️ La fecha es `@db.Date` y se lee en UTC: si se serializara como
  // instante saldría el día anterior a partir de cierta hora en Lima.
  check(
    'una FECHA vuelve como AAAA-MM-DD, sin correrse de día',
    porClave(ficha.datos, cFecha)?.valor === '2026-03-15',
    String(porClave(ficha.datos, cFecha)?.valor),
  );

  check(
    'una LISTA guarda la opción elegida, no su texto',
    porClave(ficha.datos, cLista)?.valor ===
      definiciones.LISTA?.opciones?.[0]?.id,
    String(porClave(ficha.datos, cLista)?.valor),
  );

  titulo('FASE 4 · cada tipo valida lo suyo');

  for (const [clave, valor, queEs] of [
    [cNumero, 'mucha', 'un NUMERO con texto'],
    [cFecha, '15/03/2026', 'una FECHA en otro formato'],
    [cBool, 'quiza', 'un BOOLEANO que no es sí ni no'],
    [cLista, 999999, 'una opción que no es de esa lista'],
  ]) {
    const r = await api('PUT', `/fotos/carpeta/${equipoId}/campo`, tokenAdmin, {
      valores: { [clave]: valor },
    });
    check(`${queEs} se rechaza`, r.estado === 400, `HTTP ${r.estado}`);
  }

  const claveInventada = await api(
    'PUT',
    `/fotos/carpeta/${equipoId}/campo`,
    tokenAdmin,
    { valores: { no_existe_este_campo: 'x' } },
  );
  check(
    'una clave que no es de ningún campo se rechaza',
    claveInventada.estado === 400,
    `HTTP ${claveInventada.estado}`,
  );

  // ⚠️ Una imagen no cabe en un JSON. Se RECHAZA en vez de ignorarla: que
  // un valor mandado no se guarde sin decir nada es peor que un 400.
  const fotoEnJson = await api(
    'PUT',
    `/fotos/carpeta/${equipoId}/campo`,
    tokenAdmin,
    { valores: { [cFoto]: 'https://algo.jpg' } },
  );
  check(
    'un campo FOTO no se manda en el JSON, y el error dice por dónde va',
    fotoEnJson.estado === 400 && /imagen/i.test(fotoEnJson.datos?.message ?? ''),
    fotoEnJson.datos?.message,
  );

  titulo('FASE 4 · guardar es PARCIAL, no reemplaza en bloque');

  const soloUno = await api(
    'PUT',
    `/fotos/carpeta/${equipoId}/campo`,
    tokenAdmin,
    { valores: { [cTexto]: 'Trane' } },
  );
  const tras = await api('GET', `/fotos/carpeta/${equipoId}/campo`, tokenAdmin);
  check(
    'mandar un campo NO borra los demás',
    soloUno.estado === 200 &&
      porClave(tras.datos, cTexto)?.valor === 'Trane' &&
      porClave(tras.datos, cNumero)?.valor === 12.5,
    `texto=${porClave(tras.datos, cTexto)?.valor} numero=${porClave(tras.datos, cNumero)?.valor}`,
  );

  await api('PUT', `/fotos/carpeta/${equipoId}/campo`, tokenAdmin, {
    valores: { [cNumero]: null },
  });
  const trasVaciar = await api(
    'GET',
    `/fotos/carpeta/${equipoId}/campo`,
    tokenAdmin,
  );
  check(
    'mandar null vacía ESE campo y deja el resto',
    porClave(trasVaciar.datos, cNumero)?.valor === null &&
      porClave(trasVaciar.datos, cTexto)?.valor === 'Trane',
    `numero=${porClave(trasVaciar.datos, cNumero)?.valor}`,
  );

  titulo('FASE 4 · el permiso es el de la carpeta');

  const sinAcceso = await api(
    'GET',
    `/fotos/carpeta/${equipoId}/campo`,
    supervisor.token,
  );
  check(
    'quien no ve la carpeta no ve sus campos — el 404 uniforme',
    sinAcceso.estado === 404,
    `HTTP ${sinAcceso.estado}`,
  );

  await api('POST', '/fotos/compartir', tokenAdmin, {
    email: supervisor.email,
    carpetaIds: [equipoId],
    permiso: 'LECTURA',
  });
  const leeConLectura = await api(
    'GET',
    `/fotos/carpeta/${equipoId}/campo`,
    supervisor.token,
  );
  check(
    'con LECTURA ve la ficha del equipo',
    leeConLectura.estado === 200,
    `HTTP ${leeConLectura.estado}`,
  );
  const escribeConLectura = await api(
    'PUT',
    `/fotos/carpeta/${equipoId}/campo`,
    supervisor.token,
    { valores: { [cTexto]: 'No debería' } },
  );
  check(
    'pero con LECTURA no los cambia: escribir es EDICION',
    escribeConLectura.estado === 403,
    `HTTP ${escribeConLectura.estado}`,
  );

  // Una rama archivada queda de solo lectura también aquí, y sin ninguna
  // regla nueva: escribir pasa por `exigirPermiso`.
  await api('POST', `/fotos/carpeta/${raiz.datos.id}/archivar`, tokenAdmin);
  const enArchivada = await api(
    'PUT',
    `/fotos/carpeta/${equipoId}/campo`,
    tokenAdmin,
    { valores: { [cTexto]: 'En archivada' } },
  );
  check(
    'en una rama archivada no se escriben campos, ni el administrador',
    enArchivada.estado === 403,
    `HTTP ${enArchivada.estado}`,
  );
  await api('POST', `/fotos/carpeta/${raiz.datos.id}/reabrir`, tokenAdmin);

  titulo('FASE 4 · crear el equipo con sus datos, en una sola llamada');

  const conValores = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Chiller 02',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
    valores: { [cTexto]: 'York', [cNumero]: '8' },
  });
  if (conValores.estado === 201)
    pendientesDeLimpiar.unshift(conValores.datos.id);
  const fichaNueva =
    conValores.estado === 201
      ? await api(
          'GET',
          `/fotos/carpeta/${conValores.datos.id}/campo`,
          tokenAdmin,
        )
      : { datos: [] };
  check(
    'se crea con los campos ya rellenados',
    conValores.estado === 201 &&
      porClave(fichaNueva.datos, cTexto)?.valor === 'York',
    `HTTP ${conValores.estado} · ${porClave(fichaNueva.datos, cTexto)?.valor}`,
  );

  const corrienteConValores = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'No debería tener campos',
    parentId: raiz.datos.id,
    valores: { [cTexto]: 'X' },
  });
  check(
    'una carpeta corriente con valores se rechaza',
    corrienteConValores.estado === 400,
    `HTTP ${corrienteConValores.estado}`,
  );

  // ⚠️ Si el valor no vale, la carpeta NO se crea a medias: van en la misma
  // transacción.
  const cuentaHijas = async () => {
    const r = await api('GET', `/fotos/carpeta/${raiz.datos.id}`, tokenAdmin);
    return (r.datos?.secciones ?? []).reduce(
      (t, s) => t + s.carpetas.length,
      0,
    );
  };
  const antesDeFallar = await cuentaHijas();
  const valorMalo = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Chiller roto',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
    valores: { [cNumero]: 'no es número' },
  });
  const despuesDeFallar = await cuentaHijas();
  check(
    'un valor inválido deshace la carpeta entera: no queda a medias',
    valorMalo.estado === 400 && antesDeFallar === despuesDeFallar,
    `HTTP ${valorMalo.estado} · ${antesDeFallar} → ${despuesDeFallar}`,
  );

  titulo('FASE 4 · desactivar en vez de borrar');

  const conValor = await api(
    'DELETE',
    `/fotos/campo/${definiciones.TEXTO.id}`,
    admin.token,
  );
  check(
    'un campo con valores no se borra, y el error ofrece desactivarlo',
    conValor.estado === 400 && /esact[ií]v/.test(conValor.datos?.message ?? ''),
    conValor.datos?.message,
  );

  const desactivado = await api(
    'PATCH',
    `/fotos/campo/${definiciones.TEXTO.id}`,
    admin.token,
    { activo: false },
  );
  check(
    'desactivarlo sí se puede',
    desactivado.estado === 200 && desactivado.datos?.activo === false,
    `HTTP ${desactivado.estado}`,
  );

  const fichaTrasDesactivar = await api(
    'GET',
    `/fotos/carpeta/${equipoId}/campo`,
    tokenAdmin,
  );
  check(
    'y lo ya capturado se sigue viendo: `activo` retira del formulario, no borra',
    porClave(fichaTrasDesactivar.datos, cTexto)?.valor === 'Trane',
    String(porClave(fichaTrasDesactivar.datos, cTexto)?.valor),
  );

  const escribirDesactivado = await api(
    'PUT',
    `/fotos/carpeta/${equipoId}/campo`,
    tokenAdmin,
    { valores: { [cTexto]: 'Otro' } },
  );
  check(
    'pero ya no se puede rellenar: no está entre los activos',
    escribirDesactivado.estado === 400,
    `HTTP ${escribirDesactivado.estado}`,
  );

  await api('PATCH', `/fotos/campo/${definiciones.TEXTO.id}`, admin.token, {
    activo: true,
  });

  // Una opción elegida por alguien se desactiva en vez de borrarse.
  const opcionElegida = definiciones.LISTA?.opciones?.[0];
  const trasBorrarOpcion = await api(
    'DELETE',
    `/fotos/campo/opcion/${opcionElegida.id}`,
    admin.token,
  );
  const opcionAhora = (trasBorrarOpcion.datos?.opciones ?? []).find(
    (o) => o.id === opcionElegida.id,
  );
  check(
    'una opción ya elegida se DESACTIVA en vez de borrarse',
    trasBorrarOpcion.estado === 200 &&
      !!opcionAhora &&
      opcionAhora.activo === false,
    `existe=${!!opcionAhora} activo=${opcionAhora?.activo}`,
  );

  const eligeDesactivada = await api(
    'PUT',
    `/fotos/carpeta/${conValores.datos?.id ?? equipoId}/campo`,
    tokenAdmin,
    { valores: { [cLista]: opcionElegida.id } },
  );
  check(
    'y ya no se puede elegir de nuevo',
    eligeDesactivada.estado === 400,
    `HTTP ${eligeDesactivada.estado}`,
  );

  const opcionLibre = definiciones.LISTA?.opciones?.[2];
  const borraLibre = await api(
    'DELETE',
    `/fotos/campo/opcion/${opcionLibre.id}`,
    admin.token,
  );
  check(
    'una opción que nadie eligió sí se borra de verdad',
    borraLibre.estado === 200 &&
      !(borraLibre.datos?.opciones ?? []).some((o) => o.id === opcionLibre.id),
    `HTTP ${borraLibre.estado}`,
  );

  titulo('FASE 4 · el color por tipo de carpeta (Fase 1c)');

  const colores = await api('GET', '/fotos/configuracion/color', supervisor.token);
  check(
    'cualquiera con el módulo lee los colores: los necesita para el explorador',
    colores.estado === 200 &&
      colores.datos?.CARPETA === 'AMARILLO' &&
      colores.datos?.EQUIPO === 'CELESTE',
    JSON.stringify(colores.datos),
  );

  const cambioSupervisor = await api(
    'PATCH',
    '/fotos/configuracion/color',
    supervisor.token,
    { tipo: 'EQUIPO', color: 'AMARILLO' },
  );
  check(
    'pero cambiarlos es de ADMIN_GLOBAL: es configuración del módulo',
    cambioSupervisor.estado === 403,
    `HTTP ${cambioSupervisor.estado}`,
  );

  const colorInventado = await api(
    'PATCH',
    '/fotos/configuracion/color',
    admin.token,
    { tipo: 'EQUIPO', color: 'FUCSIA' },
  );
  check(
    'un color fuera de la paleta se rechaza nombrando los válidos',
    colorInventado.estado === 400 &&
      /AMARILLO/.test(colorInventado.datos?.message ?? ''),
    `HTTP ${colorInventado.estado}`,
  );

  const cambio = await api('PATCH', '/fotos/configuracion/color', admin.token, {
    tipo: 'EQUIPO',
    color: 'AMARILLO',
  });
  check(
    'el administrador sí lo cambia, y vuelve el mapa completo',
    cambio.estado === 200 &&
      cambio.datos?.EQUIPO === 'AMARILLO' &&
      cambio.datos?.CARPETA === 'AMARILLO',
    JSON.stringify(cambio.datos),
  );

  const persistido = await db.query(
    `SELECT color FROM configuracion_color_carpeta WHERE tipo = 'EQUIPO'`,
  );
  check(
    'y queda guardado en la base: es un dato, no una constante del código',
    persistido.rows[0]?.color === 'AMARILLO',
    persistido.rows[0]?.color,
  );

  // Se devuelve a como estaba: esta tabla es configuración REAL del
  // módulo, no datos de prueba que se puedan dejar cambiados.
  await api('PATCH', '/fotos/configuracion/color', admin.token, {
    tipo: 'EQUIPO',
    color: 'CELESTE',
  });
  const restaurado = await api('GET', '/fotos/configuracion/color', admin.token);
  check(
    'la fase deja el color como estaba',
    restaurado.datos?.EQUIPO === 'CELESTE',
    JSON.stringify(restaurado.datos),
  );

  titulo('FASE 4 · el campo de tipo FOTO');

  const r2Configurado = !!process.env.R2_ACCESS_KEY_ID;
  if (!r2Configurado) {
    console.log('  (R2 no está configurado: se omiten las que suben bytes)');
  } else {
    const img = await imagenDePrueba(60, 40);
    const noEsFoto = await subirUnaImagen(
      `/fotos/carpeta/${equipoId}/campo/${definiciones.NUMERO.id}/imagen`,
      tokenAdmin,
      img,
    );
    check(
      'subir una imagen a un campo que no es FOTO se rechaza',
      noEsFoto.estado === 400,
      `HTTP ${noEsFoto.estado}`,
    );

    const subida = await subirUnaImagen(
      `/fotos/carpeta/${equipoId}/campo/${definiciones.FOTO.id}/imagen`,
      tokenAdmin,
      img,
    );
    check(
      'se sube la imagen del campo y vuelve firmada',
      subida.estado === 201 && /^https?:\/\//.test(subida.datos?.url ?? ''),
      `HTTP ${subida.estado}`,
    );

    const conFoto = await api(
      'GET',
      `/fotos/carpeta/${equipoId}/campo`,
      tokenAdmin,
    );
    const campoFoto = porClave(conFoto.datos, cFoto);
    check(
      'la ficha la devuelve con URL firmada y miniatura',
      campoFoto?.valor === true &&
        !!campoFoto?.imagen?.url &&
        !!campoFoto?.imagen?.urlMiniatura,
      `valor=${campoFoto?.valor}`,
    );

    // ⚠️ NO es una fila de `Foto`: no entra en la galería ni en los
    // contadores de la carpeta. Es la decisión del modelo.
    const cicloEq = await cicloAbiertoDe(equipoId, tokenAdmin);
    const galeria = await api('GET', `/fotos/ciclo/${cicloEq}/foto`, tokenAdmin);
    check(
      'la imagen de un campo NO aparece en la galería: no es evidencia',
      galeria.estado === 200 && (galeria.datos?.fotos ?? []).length === 0,
      `${(galeria.datos?.fotos ?? []).length} foto(s)`,
    );

    const sinPermiso = await subirUnaImagen(
      `/fotos/carpeta/${equipoId}/campo/${definiciones.FOTO.id}/imagen`,
      supervisor.token,
      img,
    );
    check(
      'con LECTURA no se sube la imagen del campo',
      sinPermiso.estado === 403,
      `HTTP ${sinPermiso.estado}`,
    );

    const quitada = await api(
      'DELETE',
      `/fotos/carpeta/${equipoId}/campo/${definiciones.FOTO.id}/imagen`,
      tokenAdmin,
    );
    check(
      'se quita la imagen del campo',
      quitada.estado === 200,
      `HTTP ${quitada.estado}`,
    );

    const otraVez = await api(
      'DELETE',
      `/fotos/carpeta/${equipoId}/campo/${definiciones.FOTO.id}/imagen`,
      tokenAdmin,
    );
    check(
      'quitarla dos veces contesta 404, no un 500',
      otraVez.estado === 404,
      `HTTP ${otraVez.estado}`,
    );
  }

  titulo('FASE 4 · borrar el equipo se lleva sus valores');

  const aBorrar = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Chiller desechable',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
    valores: { [cLargo]: 'se va a borrar' },
  });
  const filasAntes = await db.query(
    'SELECT count(*)::int AS n FROM valores_campo_fotos WHERE "carpetaId" = $1',
    [aBorrar.datos.id],
  );
  const borrada = await api(
    'DELETE',
    `/fotos/carpeta/${aBorrar.datos.id}`,
    tokenAdmin,
  );
  const filasDespues = await db.query(
    'SELECT count(*)::int AS n FROM valores_campo_fotos WHERE "carpetaId" = $1',
    [aBorrar.datos.id],
  );
  check(
    'los valores se van con la carpeta (Cascade), sin bloquear el borrado',
    borrada.estado === 200 &&
      filasAntes.rows[0].n === 1 &&
      filasDespues.rows[0].n === 0,
    `HTTP ${borrada.estado} · ${filasAntes.rows[0].n} → ${filasDespues.rows[0].n}`,
  );

  // ── Limpieza ──
  // Las carpetas las borra `limpiar()` al final; las definiciones son
  // GLOBALES y no cuelgan de ninguna, así que hay que retirarlas aquí o
  // quedarían en la configuración real del módulo. Van DESPUÉS de sus
  // carpetas: un campo con valores no se deja borrar, que es la regla que
  // se acaba de comprobar.
  for (const id of [equipoId, conValores.datos?.id])
    if (id) await api('DELETE', `/fotos/carpeta/${id}`, tokenAdmin);

  let sobran = 0;
  for (const id of camposCreados) {
    const r = await api('DELETE', `/fotos/campo/${id}`, admin.token);
    if (r.estado !== 200) sobran += 1;
  }
  check(
    'la fase limpia sus definiciones: no deja campos en la configuración real',
    sobran === 0,
    `${sobran} sin borrar de ${camposCreados.length}`,
  );

  for (const c of [admin, editorG, supervisor])
    await api('DELETE', `/usuario/${c.id}`, tokenAdmin);
}

async function fase5(db, tokenAdmin) {
  titulo('FASE 5 · siembra: un equipo con su carpeta');

  const editorG = await cuentaDePrueba(tokenAdmin, 'f5editor', [
    { modulo: 'FOTOS', nivelFotos: 'EDITOR_GLOBAL' },
  ]);
  const lectorG = await cuentaDePrueba(tokenAdmin, 'f5lector', [
    { modulo: 'FOTOS', nivelFotos: 'LECTURA_GLOBAL' },
  ]);
  const ajeno = await cuentaDePrueba(tokenAdmin, 'f5ajeno', [
    { modulo: 'FOTOS' },
  ]);
  if (!editorG || !lectorG || !ajeno) return;

  // ⚠️ Desde la Fase 1a de «Gestión de contenido» esto NO necesita el
  // catálogo de Gestión de Equipos. Antes había que buscar una
  // organización, sembrar un equipo y enlazarlo, y si el catálogo estaba
  // vacío la fase entera se OMITÍA en silencio —una precondición externa
  // que podía dejar sin probar §13 sin que nadie lo notara—. Ahora una
  // carpeta de equipo es una carpeta con `tipo: 'EQUIPO'` y ya está.
  const raiz = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `__verif_f5 ${Date.now()}`,
  });
  pendientesDeLimpiar.unshift(raiz.datos.id);

  // Una carpeta CORRIENTE y una de EQUIPO: §13 solo admite actividades en la
  // segunda, y sin las dos no se puede comprobar que la distingue.
  const corriente = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Carpeta corriente',
    parentId: raiz.datos.id,
  });
  pendientesDeLimpiar.unshift(corriente.datos.id);

  const equipo = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Equipo de prueba',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
  });
  if (equipo.estado !== 201) {
    console.log(`  (no se pudo crear la carpeta de equipo: HTTP ${equipo.estado})`);
    for (const c of [editorG, lectorG, ajeno])
      await api('DELETE', `/usuario/${c.id}`, tokenAdmin);
    return;
  }
  pendientesDeLimpiar.unshift(equipo.datos.id);
  const equipoId = equipo.datos.id;

  titulo('FASE 5 · las actividades viven dentro de un EQUIPO (§13)');

  // Desde la Fase 1 §13 se hace cumplir un escalón más arriba: los CICLOS son
  // de un equipo, y las actividades cuelgan de un ciclo. Una carpeta corriente
  // no tiene dónde ponerlas porque no tiene ciclos.
  const cicloCorriente = await api(
    'GET',
    `/fotos/carpeta/${corriente.datos.id}/ciclo`,
    tokenAdmin,
  );
  check(
    'una carpeta corriente NO tiene ciclos — es la lectura estricta de §13',
    cicloCorriente.estado === 400 &&
      /no lo es/.test(cicloCorriente.datos?.message ?? ''),
    `HTTP ${cicloCorriente.estado} · ${cicloCorriente.datos?.message ?? ''}`,
  );

  const cicloEquipo = await cicloAbiertoDe(equipoId, tokenAdmin);
  check(
    'un equipo recién creado nace con su Ciclo 1 abierto (§4.2)',
    cicloEquipo !== null,
    `cicloId=${cicloEquipo}`,
  );
  if (!cicloEquipo) return;

  const sinTitulo = await api('POST', `/fotos/ciclo/${cicloEquipo}/actividad`, tokenAdmin, {
    descripcion: 'sin título',
  });
  check(
    'una actividad sin título se rechaza',
    sinTitulo.estado === 400,
    `HTTP ${sinTitulo.estado}`,
  );

  const estadoRaro = await api('POST', `/fotos/ciclo/${cicloEquipo}/actividad`, tokenAdmin, {
    titulo: 'X',
    estado: 'CASI',
  });
  check(
    'un estado inventado se rechaza con los valores permitidos',
    estadoRaro.estado === 400 && /PENDIENTE/.test(estadoRaro.datos?.message ?? ''),
    `HTTP ${estadoRaro.estado}`,
  );

  const actividad = await api('POST', `/fotos/ciclo/${cicloEquipo}/actividad`, tokenAdmin, {
    titulo: 'Revisar estado estructural',
    descripcion: 'Chasis y anclajes',
    prioridad: 'ALTA',
    fecha: '2026-08-18',
    responsableId: editorG.id,
  });
  check(
    'se crea una actividad con responsable, prioridad y fecha',
    actividad.estado === 201 &&
      actividad.datos?.estado === 'PENDIENTE' &&
      actividad.datos?.responsable?.id === editorG.id,
    `HTTP ${actividad.estado} · estado=${actividad.datos?.estado} prioridad=${actividad.datos?.prioridad}`,
  );
  const actividadId = actividad.datos?.id;
  if (!actividadId) return;

  check(
    'nace sin marca de completada',
    actividad.datos.completadaEn === null && actividad.datos.completadaPor === null,
    `completadaEn=${actividad.datos.completadaEn}`,
  );

  titulo('FASE 5 · el check rápido de §13');

  const completada = await api('POST', `/fotos/actividad/${actividadId}/completar`, tokenAdmin);
  check(
    'completar registra fecha/hora Y quién la completó (§13)',
    completada.estado === 201 &&
      completada.datos?.estado === 'COMPLETADA' &&
      !!completada.datos?.completadaEn &&
      !!completada.datos?.completadaPor?.id,
    `estado=${completada.datos?.estado} por=${completada.datos?.completadaPor?.nombre}`,
  );

  const reabierta = await api('POST', `/fotos/actividad/${actividadId}/reabrir`, tokenAdmin);
  check(
    'reabrir vuelve a PENDIENTE y BORRA la marca — no deja un dato que ya no es cierto',
    reabierta.datos?.estado === 'PENDIENTE' &&
      reabierta.datos?.completadaEn === null &&
      reabierta.datos?.completadaPor === null,
    `estado=${reabierta.datos?.estado} completadaEn=${reabierta.datos?.completadaEn}`,
  );

  // La misma marca por el camino del PATCH: si sólo la escribiera la ruta
  // del check, editar el estado a mano dejaría una completada sin firma.
  const porPatch = await api('PATCH', `/fotos/actividad/${actividadId}`, tokenAdmin, {
    estado: 'COMPLETADA',
  });
  check(
    'y el PATCH de estado escribe la misma marca, no solo la ruta del check',
    porPatch.datos?.completadaEn && porPatch.datos?.completadaPor?.id,
    `completadaPor=${porPatch.datos?.completadaPor?.nombre ?? '(nadie)'}`,
  );
  await api('POST', `/fotos/actividad/${actividadId}/reabrir`, tokenAdmin);

  titulo('FASE 5 · editar una actividad no pisa lo que no llega');

  await api('PATCH', `/fotos/actividad/${actividadId}`, tokenAdmin, {
    estado: 'EN_PROCESO',
  });
  const tras = await api('GET', `/fotos/actividad/${actividadId}`, tokenAdmin);
  check(
    'mandar solo {estado} conserva descripción, prioridad y responsable',
    tras.datos?.descripcion === 'Chasis y anclajes' &&
      tras.datos?.prioridad === 'ALTA' &&
      tras.datos?.responsable?.id === editorG.id,
    `descripcion=${tras.datos?.descripcion} prioridad=${tras.datos?.prioridad}`,
  );

  titulo('FASE 5 · permisos de actividades (§5, todo por AccesoService)');

  const verLector = await api('GET', `/fotos/ciclo/${cicloEquipo}/actividad`, lectorG.token);
  check(
    'LECTURA_GLOBAL ve las actividades',
    verLector.estado === 200 && (verLector.datos ?? []).length > 0,
    `HTTP ${verLector.estado} · ${verLector.datos?.length ?? '?'} actividades`,
  );

  const crearLector = await api('POST', `/fotos/ciclo/${cicloEquipo}/actividad`, lectorG.token, {
    titulo: 'No debería',
  });
  check(
    'pero NO crea: escribir es EDICION',
    crearLector.estado === 403,
    `HTTP ${crearLector.estado}`,
  );

  const completarLector = await api(
    'POST',
    `/fotos/actividad/${actividadId}/completar`,
    lectorG.token,
  );
  check(
    'ni completa — el check rápido también es escritura',
    completarLector.estado === 403,
    `HTTP ${completarLector.estado}`,
  );

  const verAjeno = await api('GET', `/fotos/ciclo/${cicloEquipo}/actividad`, ajeno.token);
  check(
    'quien no ve la carpeta recibe 404, no 403: no se le confirma que exista',
    verAjeno.estado === 404,
    `HTTP ${verAjeno.estado}`,
  );

  const actividadAjena = await api('GET', `/fotos/actividad/${actividadId}`, ajeno.token);
  check(
    'y tampoco por el id de la actividad',
    actividadAjena.estado === 404,
    `HTTP ${actividadAjena.estado}`,
  );

  titulo('FASE 5 · comentarios en las cuatro entidades (§14)');

  // ⚠️ El álbum se siembra por SQL porque desde la Fase 4 del rediseño **no
  // hay forma de crear uno**: se retiraron. La fila sobrevive como historia
  // de solo lectura, y lo que se comprueba aquí es que un comentario sobre un
  // álbum ANTIGUO se sigue pudiendo leer y escribir — que es la razón por la
  // que la tabla no se borró.
  const albumSembrado = await db.query(
    `INSERT INTO albumes_fotos ("carpetaId", nombre, "creadoPorId", "creadoEn", "actualizadoEn")
     VALUES ($1, '__verif álbum', (SELECT id FROM usuarios WHERE rol = 'SUPERADMIN' LIMIT 1), now(), now())
     RETURNING id`,
    [equipoId],
  );
  const albumId = albumSembrado.rows[0].id;

  // §14 nombra CUATRO entidades; aquí hay tres FK porque un EQUIPO **es** una
  // carpeta de tipo EQUIPO (§12), no una entidad aparte.
  const objetivos = [
    ['carpeta', corriente.datos.id, 'una carpeta corriente'],
    ['carpeta', equipoId, 'un equipo (que es una carpeta de tipo EQUIPO)'],
    ['actividad', actividadId, 'una actividad'],
    ['album', albumId, 'un álbum'],
  ];

  const creados = [];
  for (const [entidad, id, nombre] of objetivos) {
    const c = await api('POST', `/fotos/comentario/${entidad}/${id}`, tokenAdmin, {
      texto: `Comentario sobre ${nombre}`,
    });
    check(
      `se comenta ${nombre}`,
      c.estado === 201 && c.datos?.autorNombre,
      `HTTP ${c.estado} · autor=${c.datos?.autorNombre ?? '?'}`,
    );
    if (c.datos?.id) creados.push({ id: c.datos.id, entidad, entidadId: id });
  }

  check(
    'las CUATRO entidades de §14 quedan cubiertas, con tres columnas',
    creados.length === 4,
    `${creados.length}/4 comentarios creados`,
  );

  const entidadRara = await api('POST', '/fotos/comentario/proyecto/1', tokenAdmin, {
    texto: 'x',
  });
  check(
    'una entidad no comentable se rechaza con los valores permitidos',
    entidadRara.estado === 400 && /carpeta/.test(entidadRara.datos?.message ?? ''),
    `HTTP ${entidadRara.estado}`,
  );

  const vacio = await api('POST', `/fotos/comentario/actividad/${actividadId}`, tokenAdmin, {
    texto: '   ',
  });
  check(
    'un comentario vacío se rechaza',
    vacio.estado === 400,
    `HTTP ${vacio.estado}`,
  );

  // El CHECK de la BD sigue en pie por debajo del service.
  const dueños = await db.query(
    `SELECT ("carpetaId" IS NOT NULL)::int + ("actividadId" IS NOT NULL)::int
          + ("albumId" IS NOT NULL)::int + ("fotoId" IS NOT NULL)::int AS n
       FROM comentarios_fotos`,
  );
  check(
    'todo comentario guardado tiene EXACTAMENTE un dueño',
    dueños.rows.every((r) => r.n === 1),
    `${dueños.rows.length} filas revisadas`,
  );

  titulo('FASE 5 · leer, editar y borrar comentarios');

  const lista = await api('GET', `/fotos/comentario/actividad/${actividadId}`, tokenAdmin);
  check(
    'los comentarios de una actividad se listan en orden de conversación',
    lista.estado === 200 && (lista.datos ?? []).length > 0,
    `HTTP ${lista.estado} · ${lista.datos?.length ?? '?'} comentarios`,
  );
  check(
    'y llegan sin editar: `editadoEn` en null distingue «nunca tocado» (§14)',
    (lista.datos ?? []).every((c) => c.editadoEn === null),
    `editadoEn=${lista.datos?.[0]?.editadoEn}`,
  );

  const mio = creados.find((c) => c.entidad === 'actividad');
  const editado = await api('PATCH', `/fotos/comentario/${mio.id}`, tokenAdmin, {
    texto: 'Corregido',
  });
  check(
    'editar el propio sella `editadoEn`',
    editado.estado === 200 && editado.datos?.texto === 'Corregido' && !!editado.datos?.editadoEn,
    `editadoEn=${editado.datos?.editadoEn ?? 'null'}`,
  );

  // El del SuperAdmin, editado por otro: ni un ADMIN_GLOBAL reescribe lo
  // ajeno. Se le da EDICION al editor global por su nivel, así que el 403
  // que salga es por AUTORÍA, no por grado.
  const ajenoEdita = await api('PATCH', `/fotos/comentario/${mio.id}`, editorG.token, {
    texto: 'Reescrito por otro',
  });
  check(
    'NADIE edita el comentario de otro, por mucho grado que tenga',
    ajenoEdita.estado === 403 && /tus propios comentarios/.test(ajenoEdita.datos?.message ?? ''),
    `HTTP ${ajenoEdita.estado}`,
  );

  const lectorComenta = await api(
    'POST',
    `/fotos/comentario/actividad/${actividadId}`,
    lectorG.token,
    { texto: 'Desde lectura' },
  );
  check(
    'LECTURA_GLOBAL ve los comentarios pero no escribe: §14 le concede visualizar',
    lectorComenta.estado === 403,
    `HTTP ${lectorComenta.estado}`,
  );

  const lectorLee = await api('GET', `/fotos/comentario/actividad/${actividadId}`, lectorG.token);
  check(
    'y leerlos sí puede',
    lectorLee.estado === 200,
    `HTTP ${lectorLee.estado} · ${lectorLee.datos?.length ?? '?'} comentarios`,
  );

  const propioDelEditor = await api(
    'POST',
    `/fotos/comentario/actividad/${actividadId}`,
    editorG.token,
    { texto: 'Del editor' },
  );
  const borraPropio = await api(
    'DELETE',
    `/fotos/comentario/${propioDelEditor.datos?.id}`,
    editorG.token,
  );
  check(
    'borrar el PROPIO basta con EDICION',
    borraPropio.estado === 200,
    `HTTP ${borraPropio.estado}`,
  );

  const borraAjeno = await api('DELETE', `/fotos/comentario/${mio.id}`, editorG.token);
  check(
    'borrar el AJENO exige TOTAL — un EDITOR_GLOBAL no modera',
    borraAjeno.estado === 403,
    `HTTP ${borraAjeno.estado}`,
  );

  titulo('FASE 5 · una rama archivada es de solo lectura, también aquí');

  await api('POST', `/fotos/carpeta/${raiz.datos.id}/archivar`, tokenAdmin);

  const enArchivada = await api('POST', `/fotos/ciclo/${cicloEquipo}/actividad`, tokenAdmin, {
    titulo: 'En rama cerrada',
  });
  check(
    'no se crean actividades en una rama archivada, ni siendo SuperAdmin',
    enArchivada.estado === 403 && /archivada/.test(enArchivada.datos?.message ?? ''),
    `HTTP ${enArchivada.estado}`,
  );

  const comentaArchivada = await api(
    'POST',
    `/fotos/comentario/actividad/${actividadId}`,
    tokenAdmin,
    { texto: 'En rama cerrada' },
  );
  check(
    'ni se comenta',
    comentaArchivada.estado === 403,
    `HTTP ${comentaArchivada.estado}`,
  );

  const leeArchivada = await api('GET', `/fotos/ciclo/${cicloEquipo}/actividad`, tokenAdmin);
  check(
    'pero leer sigue funcionando: archivada es de SOLO LECTURA, no invisible',
    leeArchivada.estado === 200,
    `HTTP ${leeArchivada.estado}`,
  );

  await api('POST', `/fotos/carpeta/${raiz.datos.id}/reabrir`, tokenAdmin);

  titulo('FASE 5 · borrar una actividad');

  const conComentarios = await api('DELETE', `/fotos/actividad/${actividadId}`, tokenAdmin);
  check(
    'borrar una actividad se lleva sus comentarios (Cascade), no falla por ellos',
    conComentarios.estado === 200,
    `HTTP ${conComentarios.estado}`,
  );

  const huerfanos = await db.query(
    'SELECT count(*)::int n FROM comentarios_fotos WHERE "actividadId" = $1',
    [actividadId],
  );
  check(
    'y no deja comentarios huérfanos',
    huerfanos.rows[0].n === 0,
    `${huerfanos.rows[0].n} comentarios`,
  );

  // El álbum sembrado se va con sus comentarios (Cascade); la carpeta que lo
  // contiene es Restrict y no se borraría con él dentro.
  await db.query('DELETE FROM albumes_fotos WHERE id = $1', [albumId]);

  for (const c of [editorG, lectorG, ajeno])
    await api('DELETE', `/usuario/${c.id}`, tokenAdmin);
}

// ═════════════════════════════════════════════════════════════
// FASE 6 — álbumes, fotos, captura rápida y bandeja (§15-§18)
// ═════════════════════════════════════════════════════════════

/**
 * Un JPEG mínimo de verdad, generado con sharp.
 *
 * Hace falta una imagen REAL: `ImagenService` la procesa con sharp y unos
 * bytes inventados fallarían por el motivo equivocado, dando un verde falso
 * en «la subida se rechaza». Se genera en memoria, no se lee de disco.
 */
async function imagenDePrueba(ancho = 40, alto = 30) {
  const sharp = require('sharp');
  return sharp({
    create: {
      width: ancho,
      height: alto,
      channels: 3,
      background: { r: 20, g: 120, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();
}

/** Sube archivos por multipart, que es como llegan de verdad. */
async function subirFotos(ruta, token, buffers, extra = {}) {
  const form = new FormData();
  buffers.forEach((b, i) =>
    form.append('fotos', new Blob([b], { type: 'image/jpeg' }), `f${i}.jpg`),
  );
  for (const [k, v] of Object.entries(extra)) form.append(k, String(v));

  const r = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  let datos = null;
  try {
    datos = await r.json();
  } catch {
    /* sin cuerpo */
  }
  return { estado: r.status, datos };
}

async function fase6(db, tokenAdmin) {
  titulo('FASE 6 · siembra');

  const otro = await cuentaDePrueba(tokenAdmin, 'f6otro', [
    { modulo: 'FOTOS', nivelFotos: 'ADMIN_GLOBAL' },
  ]);
  if (!otro) return;

  const r2Configurado = !!process.env.R2_ACCESS_KEY_ID;
  if (!r2Configurado) {
    console.log(
      '  (R2 no está configurado: se omiten las pruebas que suben bytes)',
    );
  }

  const raiz = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `__verif_f6 ${Date.now()}`,
  });
  pendientesDeLimpiar.unshift(raiz.datos.id);
  const carpetaId = raiz.datos.id;

  titulo('FASE 6 · las fotos sueltas de una visita (§15, Fase 4)');

  // ⚠️ Este bloque probaba el ÁLBUM CON NOMBRE de §16: crearlo vacío,
  // renombrarlo, subirle fotos y borrarlo. Los álbumes se retiraron en la
  // Fase 4 del rediseño, y su papel —agrupar lo que se documenta de una
  // visita— lo hace el CICLO, que ya existe y no hay que crear.
  //
  // Lo que se comprueba ahora es lo que sustituye a aquello: que una foto
  // suelta entra en el ciclo, que la galería la devuelve, y que las rutas de
  // álbum ya no existen.
  const equipoF6 = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Equipo con fotos sueltas',
    parentId: carpetaId,
    tipo: 'EQUIPO',
  });
  pendientesDeLimpiar.unshift(equipoF6.datos?.id);
  const cicloF6 = await cicloAbiertoDe(equipoF6.datos?.id, tokenAdmin);
  const img = await imagenDePrueba();

  const sueltas = await subirFotos(`/fotos/ciclo/${cicloF6}/foto`, tokenAdmin, [
    img,
    img,
  ]);
  check(
    'se suben fotos sueltas a la visita',
    sueltas.estado === 201 && sueltas.datos?.subidas === 2,
    `HTTP ${sueltas.estado} · ${sueltas.datos?.subidas ?? '?'} subidas`,
  );
  check(
    'y cuelgan del CICLO, no de ningún álbum',
    sueltas.datos?.cicloId === cicloF6,
    `cicloId=${sueltas.datos?.cicloId} (esperado ${cicloF6})`,
  );

  const galeriaF6 = await api('GET', `/fotos/ciclo/${cicloF6}/foto`, tokenAdmin);
  check(
    'la galería de la visita es una lista PLANA de fotos, sin nivel de álbum',
    galeriaF6.estado === 200 &&
      Array.isArray(galeriaF6.datos?.fotos) &&
      galeriaF6.datos.fotos.length === 2 &&
      !('albumes' in (galeriaF6.datos ?? {})),
    `${galeriaF6.datos?.fotos?.length} foto(s) · claves=${Object.keys(galeriaF6.datos ?? {}).join(',')}`,
  );
  check(
    'cada foto trae su URL firmada y su miniatura',
    (galeriaF6.datos?.fotos ?? []).every((f) => f.url && f.urlMiniatura),
  );

  const autoresF6 = await api(
    'GET',
    `/fotos/ciclo/${cicloF6}/autores`,
    tokenAdmin,
  );
  check(
    'el filtro por autor se pide por CICLO y cuenta fotos, no álbumes',
    autoresF6.estado === 200 &&
      (autoresF6.datos ?? []).length === 1 &&
      autoresF6.datos[0].fotos === 2,
    JSON.stringify(autoresF6.datos ?? []),
  );

  // Las puertas que se cerraron. Se comprueban una a una porque un endpoint
  // retirado que sigue respondiendo es exactamente el fallo que este script
  // existe para cazar.
  for (const [metodo, ruta, etiqueta] of [
    ['POST', `/fotos/album/carpeta/${carpetaId}`, 'crear un álbum'],
    ['PATCH', '/fotos/album/1', 'editar un álbum'],
    ['DELETE', '/fotos/album/1', 'eliminar un álbum'],
    ['POST', '/fotos/album/1/foto', 'subir a un álbum'],
    ['GET', `/fotos/carpeta/${carpetaId}/album`, 'la galería por carpeta'],
    ['GET', `/fotos/carpeta/${carpetaId}/autores`, 'los autores por carpeta'],
  ]) {
    const r = await api(metodo, ruta, tokenAdmin, metodo === 'GET' ? undefined : {});
    check(
      `${etiqueta} ya NO existe`,
      r.estado === 404,
      `HTTP ${r.estado} · ${metodo} ${ruta}`,
    );
  }

  // Y una carpeta corriente ya no admite fotos por ninguna vía: no tiene
  // ciclos donde ponerlas. Es la consecuencia que decidió HVC al retirar los
  // álbumes, y conviene que quede escrita.
  const cicloDeCorriente = await api(
    'GET',
    `/fotos/carpeta/${carpetaId}/ciclo`,
    tokenAdmin,
  );
  check(
    'una carpeta corriente no tiene dónde poner fotos',
    cicloDeCorriente.estado === 400,
    `HTTP ${cicloDeCorriente.estado}`,
  );

  // Una carpeta de tipo EQUIPO para poder tener actividad. Desde la Fase 1a no
  // hace falta ningún equipo del catálogo: basta el `tipo`.
  let actividadId = null;
  const carpetaEquipo = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Equipo para fotos de actividad',
    parentId: carpetaId,
    tipo: 'EQUIPO',
  });
  if (carpetaEquipo.datos?.id) {
    pendientesDeLimpiar.unshift(carpetaEquipo.datos.id);
    const ciclo6 = await cicloAbiertoDe(carpetaEquipo.datos.id, tokenAdmin);
    const actividad = await api(
      'POST',
      `/fotos/ciclo/${ciclo6}/actividad`,
      tokenAdmin,
      { titulo: 'Inspección' },
    );
    actividadId = actividad.datos?.id ?? null;
  }

  if (actividadId) {
    const aActividad = await subirFotos(`/fotos/actividad/${actividadId}/foto`, tokenAdmin, [
      img,
    ]);
    check(
      'se suben fotos a una ACTIVIDAD (§15: «actividad relacionada»)',
      aActividad.estado === 201 && aActividad.datos?.actividadId === actividadId,
      `HTTP ${aActividad.estado} · actividadId=${aActividad.datos?.actividadId}`,
    );
    check(
      'y esas cuelgan de la ACTIVIDAD, no sueltas del ciclo',
      aActividad.datos?.cicloId === null,
      `cicloId=${aActividad.datos?.cicloId}`,
    );

    // ── Borrar UNA foto de la actividad (puerta abierta en la Fase 2a) ──
    //
    // El endpoint es el mismo `DELETE /fotos/foto/:id` de siempre —
    // `exigirSobreFoto` resuelve los tres casos y el de actividad es uno—, pero
    // hasta la Fase 2a ninguna pantalla lo llamaba para éstas: la única
    // salida era borrar la actividad entera, que además el backend rechaza si
    // tiene fotos. Se comprueba aquí que la puerta lleva a alguna parte.
    const antesDeBorrar = await api('GET', `/fotos/actividad/${actividadId}/foto`, tokenAdmin);
    const fotoDeActividad = (antesDeBorrar.datos ?? [])[0];

    const conFotos = await api('DELETE', `/fotos/actividad/${actividadId}`, tokenAdmin);
    check(
      'una actividad CON fotos no se borra: la evidencia no se va por delante',
      conFotos.estado === 400,
      `HTTP ${conFotos.estado}`,
    );

    // La subió el SuperAdmin, así que para `otro` —un ADMIN_GLOBAL— es
    // AJENA, y §5 pide TOTAL para ésas. Su nivel se lo da sobre todo el
    // árbol, así que debe poder: es la mitad de la regla que el botón de
    // la rejilla hace cumplir en la pantalla.
    const borradaDeActividad = await api(
      'DELETE',
      `/fotos/foto/${fotoDeActividad?.id}`,
      otro.token,
    );
    const despues = await api('GET', `/fotos/actividad/${actividadId}/foto`, tokenAdmin);
    check(
      'se borra UNA foto de la actividad sin tocar la actividad (ajena, con TOTAL)',
      borradaDeActividad.estado === 200 && (despues.datos ?? []).length === 0,
      `HTTP ${borradaDeActividad.estado} · quedan ${(despues.datos ?? []).length}`,
    );

    // ⚠️ Y la actividad NO desaparece al quedarse sin fotos: al revés que un
    // álbum, que hoy sí se retira solo (eso lo cambia la Fase 2b).
    const sigueViva = await api('GET', `/fotos/actividad/${actividadId}`, tokenAdmin);
    check(
      'la actividad sigue existiendo aunque se quede sin fotos',
      sigueViva.estado === 200,
      `HTTP ${sigueViva.estado}`,
    );

    const yaVacia = await api('DELETE', `/fotos/actividad/${actividadId}`, tokenAdmin);
    check(
      'y ya vacía sí se puede borrar',
      yaVacia.estado === 200,
      `HTTP ${yaVacia.estado}`,
    );
    actividadId = null;
  }

  titulo('FASE 6 · bandeja: subir sin asignar (§17)');

  const sinAsignar = await subirFotos('/fotos/bandeja', tokenAdmin, [
    img,
    img,
    img,
  ]);
  check(
    '«Subir fotos sin asignar» responde y no inventa destino',
    sinAsignar.estado === 201 &&
      sinAsignar.datos?.enBandeja === true &&
      sinAsignar.datos?.cicloId === null &&
      sinAsignar.datos?.actividadId === null,
    `HTTP ${sinAsignar.estado} · subidas=${sinAsignar.datos?.subidas} ciclo=${sinAsignar.datos?.cicloId} actividad=${sinAsignar.datos?.actividadId}`,
  );

  const bandeja = await api('GET', '/fotos/bandeja', tokenAdmin);
  check(
    'la bandeja de §18 las devuelve, con miniatura firmada',
    bandeja.estado === 200 &&
      bandeja.datos?.total >= 3 &&
      (bandeja.datos?.fotos ?? []).every((f) => f.urlMiniatura),
    `HTTP ${bandeja.estado} · ${bandeja.datos?.total ?? '?'} pendientes`,
  );

  // LA pregunta que la Fase 5 dejó abierta.
  const bandejaAjena = await api('GET', '/fotos/bandeja', otro.token);
  check(
    'la bandeja es POR USUARIO: un ADMIN_GLOBAL no ve la ajena (§18)',
    bandejaAjena.estado === 200 && bandejaAjena.datos?.total === 0,
    `HTTP ${bandejaAjena.estado} · ve ${bandejaAjena.datos?.total ?? '?'} fotos ajenas`,
  );

  const idsBandeja = (bandeja.datos?.fotos ?? []).map((f) => f.id);

  const fotoAjena = await api(
    'GET',
    `/fotos/foto/${idsBandeja[0]}/descarga`,
    otro.token,
  );
  check(
    'y una foto sin clasificar contesta 404 al ajeno, no 403 — no se le confirma que exista',
    fotoAjena.estado === 404,
    `HTTP ${fotoAjena.estado}`,
  );

  titulo('FASE 6 · comentar una foto (§14 opcional, resuelto aquí)');

  const comentarioBandeja = await api(
    'POST',
    `/fotos/comentario/foto/${idsBandeja[0]}`,
    tokenAdmin,
    { texto: 'Se ve la fuga en la esquina' },
  );
  check(
    'el DUEÑO comenta su foto de la bandeja, aunque no cuelgue de ninguna carpeta',
    comentarioBandeja.estado === 201,
    `HTTP ${comentarioBandeja.estado} · ${comentarioBandeja.datos?.message ?? ''}`,
  );

  const comentarioAjeno = await api(
    'POST',
    `/fotos/comentario/foto/${idsBandeja[0]}`,
    otro.token,
    { texto: 'No debería' },
  );
  check(
    'un ADMIN_GLOBAL NO comenta una foto de la bandeja ajena',
    comentarioAjeno.estado === 404,
    `HTTP ${comentarioAjeno.estado}`,
  );

  const fotoClasificada = (
    await api('GET', `/fotos/ciclo/${cicloF6}/foto`, tokenAdmin)
  ).datos?.fotos?.[0];
  if (fotoClasificada) {
    const comentarioClasificada = await api(
      'POST',
      `/fotos/comentario/foto/${fotoClasificada.id}`,
      otro.token,
      { texto: 'Ya clasificada, aquí sí manda la carpeta' },
    );
    check(
      'pero una foto YA CLASIFICADA se rige por su carpeta: el admin sí comenta',
      comentarioClasificada.estado === 201,
      `HTTP ${comentarioClasificada.estado}`,
    );
  }

  titulo('FASE 6 · clasificar por lotes (§18)');

  const sinDestino = await api('POST', '/fotos/bandeja/clasificar', tokenAdmin, {
    fotoIds: idsBandeja,
  });
  check(
    'clasificar sin destino se rechaza con un mensaje que dice qué falta',
    sinDestino.estado === 400 &&
      /actividad o una visita/.test(sinDestino.datos?.message ?? ''),
    `HTTP ${sinDestino.estado}`,
  );

  const lote = await api('POST', '/fotos/bandeja/clasificar', tokenAdmin, {
    fotoIds: idsBandeja.slice(0, 2),
    cicloId: cicloF6,
  });
  check(
    'un lote se mueve de la bandeja a una visita de una vez',
    lote.estado === 201 && lote.datos?.clasificadas >= 1,
    `HTTP ${lote.estado} · ${lote.datos?.clasificadas ?? '?'} clasificadas`,
  );

  const trasLote = await api('GET', '/fotos/bandeja', tokenAdmin);
  check(
    'y salen de la bandeja',
    trasLote.datos?.total < (bandeja.datos?.total ?? 0),
    `antes ${bandeja.datos?.total} · ahora ${trasLote.datos?.total}`,
  );

  const repetido = await api('POST', '/fotos/bandeja/clasificar', tokenAdmin, {
    fotoIds: idsBandeja.slice(0, 2),
    cicloId: cicloF6,
  });
  check(
    'reclasificar lo ya clasificado no las mueve dos veces: avisa',
    repetido.estado === 400 && /bandeja/.test(repetido.datos?.message ?? ''),
    `HTTP ${repetido.estado} · ${repetido.datos?.message ?? ''}`,
  );

  const ajenoClasifica = await api(
    'POST',
    '/fotos/bandeja/clasificar',
    otro.token,
    { fotoIds: idsBandeja, cicloId: cicloF6 },
  );
  check(
    'nadie clasifica la bandeja de otro, ni un ADMIN_GLOBAL',
    ajenoClasifica.estado === 400,
    `HTTP ${ajenoClasifica.estado}`,
  );

  titulo('FASE 6 · lo de v2 que NO debía romperse');

  const galeria = await api('GET', `/fotos/ciclo/${cicloF6}/foto`, tokenAdmin);
  check(
    'la galería paginada sigue respondiendo, ahora por ciclo',
    galeria.estado === 200 && Array.isArray(galeria.datos?.fotos),
    `HTTP ${galeria.estado} · ${galeria.datos?.fotos?.length ?? '?'} fotos`,
  );
  check(
    'y las fotos llegan con URL firmada y ya procesadas a WebP',
    (galeria.datos?.fotos ?? []).some((f) =>
      f.url?.includes('X-Amz-Signature'),
    ),
    'firma presente en la URL',
  );

  const unaFoto = (galeria.datos?.fotos ?? []).find(Boolean);
  if (unaFoto) {
    const descarga = await api(
      'GET',
      `/fotos/foto/${unaFoto.id}/descarga`,
      tokenAdmin,
    );
    check(
      'la descarga sigue dando nombre de archivo legible',
      descarga.estado === 200 && /\.webp$/.test(descarga.datos?.nombreArchivo ?? ''),
      descarga.datos?.nombreArchivo ?? `HTTP ${descarga.estado}`,
    );

    const borrada = await api('DELETE', `/fotos/foto/${unaFoto.id}`, tokenAdmin);
    check(
      'y borrar una foto sigue funcionando',
      borrada.estado === 200,
      `HTTP ${borrada.estado}`,
    );
  }

  // Las fotos que queden bloquean el borrado de la carpeta al limpiar.
  await db.query(
    'DELETE FROM comentarios_fotos WHERE "fotoId" IN (SELECT id FROM fotos WHERE "subidaPorId" IS NOT NULL)',
  );
  // Las fotos de los ciclos de este subárbol, y las que quedaron en bandeja.
  await db.query(
    `DELETE FROM fotos WHERE "cicloId" IN (
       SELECT ci.id FROM ciclos_fotos ci
       JOIN carpetas_fotos c ON c.id = ci."carpetaId"
       WHERE c.ruta = $1 OR c.ruta LIKE $1 || '/%')`,
    [String(carpetaId)],
  );
  await db.query(
    `DELETE FROM fotos WHERE "cicloId" IS NULL AND "actividadId" IS NULL
       AND "subidaPorId" = (SELECT id FROM usuarios WHERE rol = 'SUPERADMIN' LIMIT 1)`,
  );
  if (actividadId) {
    await db.query('DELETE FROM fotos WHERE "actividadId" = $1', [actividadId]);
    await db.query('DELETE FROM comentarios_fotos WHERE "actividadId" = $1', [actividadId]);
    await db.query('DELETE FROM actividades_fotos WHERE id = $1', [actividadId]);
  }

  await api('DELETE', `/usuario/${otro.id}`, tokenAdmin);
}

// ═════════════════════════════════════════════════════════════
// FASE 7 — compartir, invitaciones y portal (§9, §10, §26.8)
// ═════════════════════════════════════════════════════════════
async function fase7(db, tokenAdmin) {
  titulo('FASE 7 · siembra');

  const editorG = await cuentaDePrueba(tokenAdmin, 'f7editor', [
    { modulo: 'FOTOS', nivelFotos: 'EDITOR_GLOBAL' },
  ]);
  const supervisor = await cuentaDePrueba(tokenAdmin, 'f7super', [
    { modulo: 'FOTOS' },
  ]);
  if (!editorG || !supervisor) return;

  const raiz = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `__verif_f7 ${Date.now()}`,
  });
  pendientesDeLimpiar.unshift(raiz.datos.id);
  const proyecto = raiz.datos.id;

  const restringida = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Inspecciones internas',
    parentId: proyecto,
  });
  pendientesDeLimpiar.unshift(restringida.datos.id);

  titulo('FASE 7 · otorgar con grado (§10)');

  const compartir = (token, email, ids, permiso, extra = {}) =>
    api('POST', '/fotos/compartir', token, {
      email,
      carpetaIds: ids,
      permiso,
      ...extra,
    });

  const gradoInvalido = await compartir(
    tokenAdmin,
    supervisor.email,
    [proyecto],
    'MANDAMAS',
  );
  check(
    'un grado inventado se rechaza diciendo cuáles valen',
    gradoInvalido.estado === 400 &&
      /LECTURA, EDICION, TOTAL/.test(gradoInvalido.datos?.message ?? ''),
    `HTTP ${gradoInvalido.estado}`,
  );

  const sinAccesoAlCompartir = await compartir(
    tokenAdmin,
    supervisor.email,
    [proyecto],
    'SIN_ACCESO',
  );
  check(
    'SIN_ACCESO NO se admite al compartir: no es un grado que se conceda',
    sinAccesoAlCompartir.estado === 400,
    `HTTP ${sinAccesoAlCompartir.estado}`,
  );

  const otorgado = await compartir(
    tokenAdmin,
    supervisor.email,
    [proyecto],
    'LECTURA',
  );
  check(
    'se comparte con un interno que ya tiene cuenta: acceso directo, sin invitación',
    otorgado.estado === 201 && otorgado.datos?.via === 'acceso-directo',
    `HTTP ${otorgado.estado} · via=${otorgado.datos?.via}`,
  );

  const lista = await api('GET', `/fotos/compartir/carpeta/${proyecto}`, tokenAdmin);
  const fila = (lista.datos?.accesos ?? []).find(
    (a) => a.usuario.id === supervisor.id,
  );
  check(
    'la lista de §10 trae usuario, correo, permiso, fecha y quién lo invitó',
    !!fila &&
      fila.usuario.email === supervisor.email &&
      fila.permiso === 'LECTURA' &&
      !!fila.creadoEn &&
      !!fila.otorgadoPor?.nombre,
    `permiso=${fila?.permiso} otorgadoPor=${fila?.otorgadoPor?.nombre}`,
  );

  titulo('FASE 7 · cambiar el grado (§10)');

  const subido = await api(
    'PATCH',
    `/fotos/compartir/carpeta/${proyecto}/acceso/${supervisor.id}`,
    tokenAdmin,
    { permiso: 'EDICION' },
  );
  check(
    'se cambia el grado sin tener que revocar y volver a compartir',
    subido.estado === 200 &&
      subido.datos?.permiso === 'EDICION' &&
      subido.datos?.anterior === 'LECTURA',
    `HTTP ${subido.estado} · ${subido.datos?.anterior} → ${subido.datos?.permiso}`,
  );

  const escribe = await api('POST', '/fotos/carpeta', supervisor.token, {
    nombre: 'Puedo crear aquí',
    parentId: proyecto,
  });
  check(
    'y el cambio surte efecto de inmediato: ahora sí puede escribir',
    escribe.estado === 201,
    `HTTP ${escribe.estado}`,
  );
  if (escribe.datos?.id) pendientesDeLimpiar.unshift(escribe.datos.id);

  titulo('FASE 7 · la restricción de §7, por fin con puerta');

  const veAntes = await api(
    'GET',
    `/fotos/carpeta/${restringida.datos.id}`,
    supervisor.token,
  );
  check(
    'hereda la subcarpeta del proyecto que le compartieron',
    veAntes.estado === 200,
    `HTTP ${veAntes.estado}`,
  );

  const restringir = await api(
    'PATCH',
    `/fotos/compartir/carpeta/${restringida.datos.id}/acceso/${supervisor.id}`,
    tokenAdmin,
    { permiso: 'SIN_ACCESO' },
  );
  check(
    'SIN_ACCESO SÍ se admite al cambiar el grado: es la restricción de §7',
    restringir.estado === 200 && restringir.datos?.esRestriccionNueva === true,
    `HTTP ${restringir.estado} · restricciónNueva=${restringir.datos?.esRestriccionNueva}`,
  );

  const veDespues = await api(
    'GET',
    `/fotos/carpeta/${restringida.datos.id}`,
    supervisor.token,
  );
  check(
    'y deja de verla, con el 404 uniforme',
    veDespues.estado === 404,
    `HTTP ${veDespues.estado}`,
  );

  const dentroDelPadre = await api(
    'GET',
    `/fotos/carpeta/${proyecto}`,
    supervisor.token,
  );
  const nombres = (dentroDelPadre.datos?.secciones ?? [])
    .flatMap((s) => s.carpetas)
    .map((c) => c.nombre);
  check(
    'ni aparece listada en el padre — NO como elemento bloqueado, sino ausente',
    !nombres.includes('Inspecciones internas'),
    `ve: ${nombres.join(', ') || '(ninguna)'}`,
  );

  titulo('FASE 7 · el techo de §26.8');

  const propia = await api('POST', '/fotos/carpeta', editorG.token, {
    nombre: '__verif_f7 propia del editor',
  });
  if (propia.datos?.id) {
    pendientesDeLimpiar.unshift(propia.datos.id);
    // Sobre lo que él creó es PROPIETARIO, así que tiene TOTAL (§6) y puede
    // repartir hasta TOTAL. Es el caso que hace que el techo no sea trivial.
    const hastaSuTecho = await compartir(
      editorG.token,
      supervisor.email,
      [propia.datos.id],
      'TOTAL',
    );
    check(
      'un EDITOR_GLOBAL comparte hasta TOTAL lo que él mismo creó (§6 le da TOTAL)',
      hastaSuTecho.estado === 201,
      `HTTP ${hastaSuTecho.estado}`,
    );
  }

  const ajena = await compartir(
    editorG.token,
    supervisor.email,
    [proyecto],
    'LECTURA',
  );
  check(
    'pero NO comparte una carpeta ajena: compartir exige TOTAL (§5)',
    ajena.estado === 403,
    `HTTP ${ajena.estado}`,
  );

  titulo('FASE 7 · invitación con permiso y expiración (§9)');

  const correoNuevo = `__verif_cliente_${Date.now()}@prueba.local`;

  const caducada = await compartir(
    tokenAdmin,
    correoNuevo,
    [proyecto],
    'LECTURA',
    { expiraEn: '2020-01-01' },
  );
  check(
    'una fecha de expiración ya pasada se rechaza',
    caducada.estado === 400 && /ya pasó/.test(caducada.datos?.message ?? ''),
    `HTTP ${caducada.estado}`,
  );

  const invitacion = await compartir(
    tokenAdmin,
    correoNuevo,
    [proyecto],
    'LECTURA',
    { expiraEn: '2026-12-31', nombre: 'Cliente de prueba' },
  );
  check(
    'un correo desconocido genera INVITACIÓN, no acceso directo — lo decide el sistema',
    invitacion.estado === 201 && invitacion.datos?.via === 'invitacion',
    `HTTP ${invitacion.estado} · via=${invitacion.datos?.via}`,
  );
  check(
    'y respeta la fecha de expiración elegida (§9), no los 7 días por defecto',
    String(invitacion.datos?.expiraEn ?? '').startsWith('2026-12-31'),
    `expiraEn=${invitacion.datos?.expiraEn}`,
  );

  const token = String(invitacion.datos?.enlace ?? '').split('/').pop();
  check(
    'el enlace lleva un token',
    !!token && token.length > 20,
    `${token?.length ?? 0} caracteres`,
  );

  // El token NUNCA se guarda en claro: en la BD va su SHA-256.
  const enClaro = await db.query(
    'SELECT count(*)::int n FROM invitaciones_cliente WHERE "tokenHash" = $1',
    [token],
  );
  // El hash se calcula en Node: la BD no tiene pgcrypto, y de todos modos
  // reproducirlo aquí es la prueba de que lo guardado es el SHA-256.
  const hashEsperado = require('node:crypto')
    .createHash('sha256')
    .update(token)
    .digest('hex');
  const porHash = await db.query(
    'SELECT id, nombre, "expiraEn" FROM invitaciones_cliente WHERE "tokenHash" = $1',
    [hashEsperado],
  );
  check(
    'el token NO está en la BD en claro',
    enClaro.rows[0].n === 0,
    `filas con el token literal: ${enClaro.rows[0].n}`,
  );
  check(
    'lo que se guarda ES el SHA-256 del token',
    porHash.rows.length === 1,
    `${porHash.rows.length} fila(s) con el hash esperado`,
  );
  check(
    'y el nombre opcional de §9 se guardó',
    porHash.rows[0]?.nombre === 'Cliente de prueba',
    `nombre=${porHash.rows[0]?.nombre}`,
  );

  const grado = await db.query(
    `SELECT ic.permiso FROM invitaciones_carpeta ic
       JOIN invitaciones_cliente i ON i.id = ic."invitacionId"
      WHERE i.email = $1`,
    [correoNuevo],
  );
  check(
    'el grado viaja EN la invitación desde que se envía (§9), no se decide al aceptar',
    grado.rows.every((r) => r.permiso === 'LECTURA'),
    grado.rows.map((r) => r.permiso).join(', ') || '(ninguna)',
  );

  titulo('FASE 7 · el cliente entra por primera vez');

  const previa = await api('GET', `/invitacion/${token}`);
  check(
    'el enlace se puede consultar SIN SESIÓN y dice a qué da acceso y quién invita',
    previa.estado === 200 &&
      !!previa.datos?.recurso &&
      !!previa.datos?.invitadoPor &&
      previa.datos?.email === correoNuevo,
    `HTTP ${previa.estado} · recurso=${previa.datos?.recurso} por=${previa.datos?.invitadoPor}`,
  );

  const activada = await api('POST', `/invitacion/${token}/activar`, null, {
    nombre: 'Cliente Verificación',
    password: CLAVE_PRUEBA,
  });
  check(
    'acepta la invitación y se le crea la cuenta',
    activada.estado === 201 || activada.estado === 200,
    `HTTP ${activada.estado} · ${activada.datos?.message ?? ''}`,
  );

  const reuso = await api('POST', `/invitacion/${token}/activar`, null, {
    nombre: 'Otro',
    password: CLAVE_PRUEBA,
  });
  check(
    'el token es de UN SOLO USO: reutilizarlo se rechaza',
    reuso.estado >= 400,
    `HTTP ${reuso.estado}`,
  );

  const tokenCliente = await entrar(correoNuevo, CLAVE_PRUEBA);
  check('el cliente puede entrar con su cuenta nueva', !!tokenCliente, tokenCliente ? 'ok' : 'sin token');
  if (!tokenCliente) return;

  titulo('FASE 7 · el portal, sobre el árbol filtrado de la Fase 3');

  const portal = await api('GET', '/portal/carpeta', tokenCliente);
  const secciones = portal.datos?.secciones ?? [];
  check(
    'el portal responde sobre la navegación nueva, en secciones',
    portal.estado === 200 && Array.isArray(secciones),
    `HTTP ${portal.estado} · ${secciones.length} sección(es)`,
  );
  check(
    'y el cliente ve SOLO «Compartido conmigo»: no tiene carpetas propias',
    secciones.length === 1 && secciones[0].clave === 'compartidas',
    secciones.map((s) => `${s.clave}(${s.carpetas.length})`).join(', '),
  );
  check(
    'con exactamente lo que le corresponde y nada más',
    secciones[0]?.carpetas?.length === 1 &&
      secciones[0].carpetas[0].id === proyecto,
    (secciones[0]?.carpetas ?? []).map((c) => c.nombre).join(', '),
  );

  // Una subcarpeta de lo compartido SÍ se hereda (§7): es lo correcto, y
  // conviene afirmarlo para que nadie «arregle» la herencia por error.
  const heredada = await api(
    'GET',
    `/portal/carpeta/${restringida.datos.id}`,
    tokenCliente,
  );
  check(
    'hereda las subcarpetas de lo que le compartieron (§7)',
    heredada.estado === 200,
    `HTTP ${heredada.estado}`,
  );

  // Lo que está FUERA del árbol compartido no existe para él —ni bloqueado—.
  const fuera = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: '__verif_f7 fuera del alcance',
  });
  pendientesDeLimpiar.unshift(fuera.datos.id);

  const ajenaParaElCliente = await api(
    'GET',
    `/portal/carpeta/${fuera.datos.id}`,
    tokenCliente,
  );
  check(
    'y una carpeta fuera de lo compartido da 404: no se le confirma que exista',
    ajenaParaElCliente.estado === 404,
    `HTTP ${ajenaParaElCliente.estado}`,
  );

  const raizTrasFuera = await api('GET', '/portal/carpeta', tokenCliente);
  const visiblesCliente = (raizTrasFuera.datos?.secciones ?? [])
    .flatMap((s) => s.carpetas)
    .map((c) => c.nombre);
  check(
    'ni aparece en su raíz, ni siquiera como elemento bloqueado',
    !visiblesCliente.some((n) => n.includes('fuera del alcance')),
    `ve: ${visiblesCliente.join(', ')}`,
  );

  const escribeCliente = await api('POST', '/fotos/carpeta', tokenCliente, {
    nombre: 'No debería',
  });
  check(
    'y el módulo interno le está cerrado: su casa es /portal',
    escribeCliente.estado === 403,
    `HTTP ${escribeCliente.estado}`,
  );

  const compartirCliente = await api('POST', '/fotos/compartir', tokenCliente, {
    email: supervisor.email,
    carpetaIds: [proyecto],
    permiso: 'LECTURA',
  });
  check(
    'un cliente no reparte accesos',
    compartirCliente.estado === 403,
    `HTTP ${compartirCliente.estado}`,
  );

  titulo('FASE 7 · revocar');

  const revocado = await api(
    'DELETE',
    `/fotos/compartir/carpeta/${proyecto}/acceso/${supervisor.id}`,
    tokenAdmin,
  );
  check('se revoca el acceso', revocado.estado === 200, `HTTP ${revocado.estado}`);

  const trasRevocar = await api('GET', `/fotos/carpeta/${proyecto}`, supervisor.token);
  check(
    'y deja de ver la carpeta inmediatamente',
    trasRevocar.estado === 404,
    `HTTP ${trasRevocar.estado}`,
  );

  // Limpieza: el cliente creado y sus accesos.
  const cli = await db.query('SELECT id FROM usuarios WHERE email = $1', [
    correoNuevo,
  ]);
  if (cli.rows[0]) {
    await db.query('DELETE FROM accesos_compartidos WHERE "usuarioId" = $1', [
      cli.rows[0].id,
    ]);
    await db.query(
      'DELETE FROM invitaciones_carpeta WHERE "invitacionId" IN (SELECT id FROM invitaciones_cliente WHERE email = $1)',
      [correoNuevo],
    );
    await db.query('DELETE FROM invitaciones_cliente WHERE email = $1', [
      correoNuevo,
    ]);
    await db.query('DELETE FROM usuarios WHERE id = $1', [cli.rows[0].id]);
  }

  for (const c of [editorG, supervisor])
    await api('DELETE', `/usuario/${c.id}`, tokenAdmin);
}

// ═════════════════════════════════════════════════════════════
// FASE 8 — auditoría (§23), Excel (§19) y plantillas (§20)
// ═════════════════════════════════════════════════════════════

/** Un .xlsx de verdad, con las seis columnas de §19. */
async function excelDePrueba(filas, cabecera) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const hoja = wb.addWorksheet('Estructura');
  hoja.addRow(
    cabecera ?? ['Carpeta', 'Subcarpeta', 'Equipo', 'Tipo', 'Nombre', 'Descripción'],
  );
  for (const f of filas) hoja.addRow(f);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Sube el Excel por multipart, como llega de verdad. */
async function subirExcel(ruta, token, buffer, decisiones) {
  const form = new FormData();
  form.append(
    'archivo',
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'estructura.xlsx',
  );
  if (decisiones) form.append('decisiones', JSON.stringify(decisiones));

  const r = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  let datos = null;
  try {
    datos = await r.json();
  } catch {
    /* sin cuerpo */
  }
  return { estado: r.status, datos };
}

async function fase8(db, tokenAdmin) {
  titulo('FASE 8 · siembra');

  const supervisor = await cuentaDePrueba(tokenAdmin, 'f8super', [
    { modulo: 'FOTOS' },
  ]);
  if (!supervisor) return;

  const raiz = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `__verif_f8 ${Date.now()}`,
  });
  pendientesDeLimpiar.unshift(raiz.datos.id);
  const destino = raiz.datos.id;

  titulo('FASE 8 · auditoría: las 13 acciones de §23');

  // Cada acción se dispara de verdad y se comprueba que quedó registrada.
  const sub = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Auditada',
    parentId: destino,
  });
  const subId = sub.datos.id;

  const eventosDe = async (accion) => {
    const r = await api('GET', `/fotos/auditoria?accion=${accion}`, tokenAdmin);
    return r.datos?.eventos ?? [];
  };

  const creacion = await eventosDe('CREACION');
  check(
    '§23.1 crear carpeta queda registrado, con quién y qué',
    creacion.some(
      (e) => e.entidadId === subId && /Auditada/.test(e.descripcion ?? ''),
    ),
    creacion[0]?.descripcion ?? '(ninguno)',
  );
  check(
    'y guarda el NOMBRE del usuario además de la FK',
    creacion.every((e) => e.usuarioNombre),
    `usuarioNombre=${creacion[0]?.usuarioNombre}`,
  );

  await api('PATCH', `/fotos/carpeta/${subId}`, tokenAdmin, {
    nombre: 'Auditada (renombrada)',
  });
  const edicion = await eventosDe('EDICION');
  check(
    'renombrar registra el valor ANTERIOR y el nuevo',
    edicion.some(
      (e) =>
        e.entidadId === subId &&
        e.campoAfectado === 'nombre' &&
        e.valorAnterior === 'Auditada',
    ),
    `${edicion[0]?.valorAnterior} → ${edicion[0]?.valorNuevo}`,
  );

  await api('POST', `/fotos/carpeta/${subId}/archivar`, tokenAdmin);
  await api('POST', `/fotos/carpeta/${subId}/reabrir`, tokenAdmin);
  const archivado = await eventosDe('ARCHIVADO');
  check(
    'archivar queda registrado',
    archivado.some((e) => e.entidadId === subId),
    `${archivado.length} evento(s)`,
  );

  // Actividades: hace falta una carpeta de tipo EQUIPO. Desde la Fase 1a no hay
  // que sembrar nada en el catálogo de Gestión de Equipos.
  const ce = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Equipo para bitácora',
    parentId: destino,
    tipo: 'EQUIPO',
  });
  const equipoCarpetaId = ce.datos?.id ?? null;
  if (equipoCarpetaId) pendientesDeLimpiar.unshift(equipoCarpetaId);

  let actividadId = null;
  if (equipoCarpetaId) {
    const ciclo8 = await cicloAbiertoDe(equipoCarpetaId, tokenAdmin);
    const t = await api(
      'POST',
      `/fotos/ciclo/${ciclo8}/actividad`,
      tokenAdmin,
      { titulo: 'Revisar pernos' },
    );
    actividadId = t.datos?.id ?? null;

    const creacionT = await eventosDe('CREACION');
    check(
      '§23.3 crear actividad queda registrado',
      creacionT.some((e) => e.entidad === 'ACTIVIDAD' && e.entidadId === actividadId),
      `${creacionT.filter((e) => e.entidad === 'ACTIVIDAD').length} de actividad`,
    );

    await api('POST', `/fotos/actividad/${actividadId}/completar`, tokenAdmin);
    const completadas = await eventosDe('ACTIVIDAD_COMPLETADA');
    check(
      '§23.4 completar actividad queda registrado — la que HVC quiere poder auditar',
      completadas.some((e) => e.entidadId === actividadId),
      completadas[0]?.descripcion ?? '(ninguno)',
    );
  }

  // Compartir / cambiar permiso / revocar, con IP.
  await api('POST', '/fotos/compartir', tokenAdmin, {
    email: supervisor.email,
    carpetaIds: [destino],
    permiso: 'LECTURA',
  });
  const compartidos = await eventosDe('COMPARTIR');
  check(
    '§23.8 compartir queda registrado',
    compartidos.length > 0,
    compartidos[0]?.descripcion ?? '(ninguno)',
  );
  check(
    'y guarda la IP, que §23 pide «si corresponde»',
    compartidos.some((e) => e.ip),
    `ip=${compartidos[0]?.ip ?? 'null'}`,
  );

  await api(
    'PATCH',
    `/fotos/compartir/carpeta/${destino}/acceso/${supervisor.id}`,
    tokenAdmin,
    { permiso: 'EDICION' },
  );
  const cambios = await eventosDe('CAMBIO_PERMISO');
  check(
    '§23.9 cambiar permiso registra el grado anterior y el nuevo',
    cambios.some((e) => e.valorAnterior === 'LECTURA' && e.valorNuevo === 'EDICION'),
    `${cambios[0]?.valorAnterior} → ${cambios[0]?.valorNuevo}`,
  );

  await api(
    'DELETE',
    `/fotos/compartir/carpeta/${destino}/acceso/${supervisor.id}`,
    tokenAdmin,
  );
  const revocados = await eventosDe('REVOCAR_ACCESO');
  check(
    '§23.10 revocar acceso queda registrado',
    revocados.length > 0,
    `${revocados.length} evento(s)`,
  );

  titulo('FASE 8 · la bitácora no tumba la operación, y se consulta');

  const hilo = await api('GET', `/fotos/auditoria/carpeta/${subId}`, tokenAdmin);
  check(
    'el hilo de una carpeta devuelve su historia completa (§23)',
    hilo.estado === 200 && (hilo.datos ?? []).length >= 3,
    `${hilo.datos?.length ?? '?'} eventos`,
  );

  const porFecha = await api(
    'GET',
    `/fotos/auditoria?desde=2020-01-01&hasta=2020-01-02`,
    tokenAdmin,
  );
  check(
    'el filtro por fechas acota de verdad',
    (porFecha.datos?.eventos ?? []).length === 0,
    `${porFecha.datos?.eventos?.length ?? '?'} en un rango sin actividad`,
  );

  const porUsuario = await api(
    'GET',
    `/fotos/auditoria?usuarioId=${supervisor.id}`,
    tokenAdmin,
  );
  check(
    'y el filtro por usuario también',
    (porUsuario.datos?.eventos ?? []).every(
      (e) => e.usuarioId === supervisor.id,
    ),
    `${porUsuario.datos?.eventos?.length ?? 0} del supervisor`,
  );

  titulo('FASE 8 · plantillas de estructura (§20)');

  const sinNombre = await api('POST', '/fotos/plantilla', tokenAdmin, {});
  check(
    'una plantilla sin nombre se rechaza',
    sinNombre.estado === 400,
    `HTTP ${sinNombre.estado}`,
  );

  // El ejemplo literal de §20.
  // ⚠️ Si una corrida anterior murió antes de su limpieza, la plantilla sigue
  // ahí y el nombre es único: el POST contestaba 409 y la fase entera se iba
  // detrás con un `return`, dejando sin probar aplicar, importar y sus
  // permisos. Se retira antes, por la API y por id, como las cuentas.
  const previas = await api('GET', '/fotos/plantilla', tokenAdmin);
  for (const vieja of previas.datos ?? [])
    if (vieja.nombre === 'Inspección de Equipo')
      await api('DELETE', `/fotos/plantilla/${vieja.id}`, tokenAdmin);

  const plantilla = await api('POST', '/fotos/plantilla', tokenAdmin, {
    nombre: 'Inspección de Equipo',
    descripcion: 'El guion estándar de HVC',
    nodos: [
      { tipo: 'ACTIVIDAD', nombre: 'Estado general' },
      { tipo: 'ACTIVIDAD', nombre: 'Pernos' },
      { tipo: 'ACTIVIDAD', nombre: 'Soldaduras' },
      { tipo: 'ACTIVIDAD', nombre: 'Estructura' },
      // ⚠️ Un nodo ALBUM ya no se admite al crear: se retiraron en la Fase 4.
      // Que el POST lo rechace es lo que se comprueba más abajo.
      { tipo: 'ACTIVIDAD', nombre: 'Evidencia fotográfica' },
    ],
  });
  check(
    'se crea la plantilla de §20 con sus cinco elementos',
    plantilla.estado === 201 && (plantilla.datos?.nodos ?? []).length === 5,
    `HTTP ${plantilla.estado} · ${plantilla.datos?.nodos?.length ?? '?'} nodos`,
  );
  const plantillaId = plantilla.datos?.id;
  if (!plantillaId) return;

  const duplicada = await api('POST', '/fotos/plantilla', tokenAdmin, {
    nombre: 'Inspección de Equipo',
  });
  check(
    'dos plantillas no pueden llamarse igual',
    duplicada.estado === 409,
    `HTTP ${duplicada.estado}`,
  );

  const hojaConHijos = await api('POST', '/fotos/plantilla', tokenAdmin, {
    nombre: '__verif imposible',
    nodos: [
      { tipo: 'ACTIVIDAD', nombre: 'No puede', hijos: [{ tipo: 'CARPETA', nombre: 'X' }] },
    ],
  });
  check(
    'una ACTIVIDAD no puede contener elementos: se rechaza al guardar, no al aplicar',
    hojaConHijos.estado === 400 && /no puede contener/.test(hojaConHijos.datos?.message ?? ''),
    `HTTP ${hojaConHijos.estado}`,
  );

  const delSupervisor = await api('POST', '/fotos/plantilla', supervisor.token, {
    nombre: '__verif del supervisor',
  });
  check(
    'un supervisor NO administra plantillas: son criterio de empresa',
    delSupervisor.estado === 400 || delSupervisor.estado === 403,
    `HTTP ${delSupervisor.estado}`,
  );

  titulo('FASE 8 · aplicar la plantilla («Crear desde plantilla»)');

  if (equipoCarpetaId) {
    const aplicada = await api(
      'POST',
      `/fotos/plantilla/${plantillaId}/aplicar/${equipoCarpetaId}`,
      tokenAdmin,
    );
    check(
      'se estampa sobre un EQUIPO: las 5 actividades',
      aplicada.estado === 201 && aplicada.datos?.actividades === 5,
      `HTTP ${aplicada.estado} · actividades=${aplicada.datos?.actividades}`,
    );

    const desdePlantilla = await eventosDe('CREACION_DESDE_PLANTILLA');
    check(
      'y queda en la bitácora qué plantilla y cuánto creó',
      desdePlantilla.some((e) => /Inspección de Equipo/.test(e.descripcion ?? '')),
      desdePlantilla[0]?.descripcion ?? '(ninguno)',
    );
  }

  // Sobre una carpeta CORRIENTE las actividades no caben (§13).
  const enCorriente = await api(
    'POST',
    `/fotos/plantilla/${plantillaId}/aplicar/${subId}`,
    tokenAdmin,
  );
  check(
    'sobre una carpeta corriente las actividades se OMITEN, no se cuelan saltándose §13',
    enCorriente.datos?.actividades === 0 &&
      enCorriente.datos?.omitidas?.actividades === 5,
    `actividades=${enCorriente.datos?.actividades} omitidas=${enCorriente.datos?.omitidas?.actividades}`,
  );
  check(
    'y se avisa del motivo en vez de callarlo',
    /solo se pueden crear dentro de una carpeta de equipo/i.test(
      enCorriente.datos?.aviso ?? '',
    ),
    enCorriente.datos?.aviso ?? '(sin aviso)',
  );
  // ⚠️ Aquí se comprobaba «pero el álbum sí se crea: lo que cabe, entra».
  // Con los álbumes retirados (Fase 4) sobre una carpeta corriente ya no cabe
  // NADA de esta plantilla, y eso es lo correcto: una carpeta corriente es
  // estructura, no contenido.
  const tipoAlbum = await api('POST', '/fotos/plantilla', tokenAdmin, {
    nombre: `__verif_plantilla_album ${Date.now()}`,
    nodos: [{ tipo: 'ALBUM', nombre: 'Ya no' }],
  });
  check(
    'una plantilla NUEVA con un nodo ÁLBUM se rechaza',
    tipoAlbum.estado === 400 &&
      /CARPETA, ACTIVIDAD/.test(tipoAlbum.datos?.message ?? ''),
    `HTTP ${tipoAlbum.estado} · ${tipoAlbum.datos?.message ?? ''}`,
  );

  // Editar la plantilla NO toca lo ya creado — el punto de no versionar.
  const cicloParaEditar = await cicloAbiertoDe(
    equipoCarpetaId ?? subId,
    tokenAdmin,
  );
  const antesDeEditar = await api(
    'GET',
    `/fotos/ciclo/${cicloParaEditar}/actividad`,
    tokenAdmin,
  );
  await api('PATCH', `/fotos/plantilla/${plantillaId}`, tokenAdmin, {
    nodos: [{ tipo: 'ACTIVIDAD', nombre: 'Solo esta' }],
  });
  const despuesDeEditar = await api(
    'GET',
    `/fotos/ciclo/${cicloParaEditar}/actividad`,
    tokenAdmin,
  );
  check(
    'EDITAR la plantilla no cambia lo ya creado: se copió, no se enlazó',
    (antesDeEditar.datos ?? []).length === (despuesDeEditar.datos ?? []).length,
    `antes ${antesDeEditar.datos?.length} · después ${despuesDeEditar.datos?.length}`,
  );

  titulo('FASE 8 · importación por Excel (§19)');

  const malaCabecera = await subirExcel(
    `/fotos/importacion/carpeta/${destino}/previa`,
    tokenAdmin,
    await excelDePrueba([], ['Proyecto', 'Otra', 'Cosa', 'X', 'Y', 'Z']),
  );
  check(
    'una cabecera que no es la de §19 se rechaza diciendo qué columna falla',
    malaCabecera.estado === 400 && /columna 1/.test(malaCabecera.datos?.message ?? ''),
    `HTTP ${malaCabecera.estado}`,
  );

  // El ejemplo literal de §19.
  const filas = [
    ['Proyecto A', 'Frente 1', 'Equipo 01', 'Actividad', 'Revisar pernos', 'Verificar estado'],
    ['Proyecto A', 'Frente 1', 'Equipo 01', 'Actividad', 'Revisar soldadura', ''],
    // ⚠️ «Álbum» era un tipo válido hasta la Fase 4. Ahora es una fila con
    // problema, como cualquier otro tipo inventado: la plantilla de Excel que
    // HVC tenga guardada hay que actualizarla, igual que cuando la columna
    // pasó de decir `Tarea` a `Actividad`.
    ['Proyecto A', 'Frente 1', 'Equipo 01', 'Álbum', 'Estado inicial', 'Inspección'],
    ['Proyecto A', 'Frente 2', 'Equipo 02', 'Actividad', 'Revisar estructura', ''],
    // Filas con problema: se informan pero no bloquean el resto.
    ['', 'Frente 3', '', 'Actividad', 'Sin carpeta', ''],
    ['Proyecto A', '', 'Equipo 03', 'Actividad', 'Camino con hueco', ''],
    ['Proyecto A', 'Frente 1', 'Equipo 01', 'Cosa', 'Tipo inventado', ''],
  ];
  const libro = await excelDePrueba(filas);

  const previa = await subirExcel(
    `/fotos/importacion/carpeta/${destino}/previa`,
    tokenAdmin,
    libro,
  );
  check(
    'la vista previa de §19 responde sin escribir nada',
    previa.estado === 201 && previa.datos?.resumen,
    `HTTP ${previa.estado} · ${previa.datos?.resumen?.filas ?? '?'} filas válidas`,
  );
  check(
    'lee las 3 filas buenas y aparta las 4 con problema (Álbum ya no vale)',
    previa.datos?.resumen?.filas === 3 && previa.datos?.resumen?.problemas === 4,
    `filas=${previa.datos?.resumen?.filas} problemas=${previa.datos?.resumen?.problemas}`,
  );
  check(
    'y dice el motivo de cada una, con su número de fila',
    (previa.datos?.problemas ?? []).every((p) => p.fila && p.motivo),
    (previa.datos?.problemas ?? []).map((p) => `f${p.fila}: ${p.motivo}`).join(' · '),
  );
  check(
    'anuncia las 5 carpetas del camino (Proyecto A + 2 frentes + 2 equipos)',
    previa.datos?.resumen?.carpetasNuevas === 5,
    `nuevas=${previa.datos?.resumen?.carpetasNuevas}`,
  );

  const antesDeImportar = await db.query(
    'SELECT count(*)::int n FROM carpetas_fotos',
  );

  const confirmada = await subirExcel(
    `/fotos/importacion/carpeta/${destino}/confirmar`,
    tokenAdmin,
    libro,
  );
  check(
    'confirmar crea la estructura (§19 paso 8)',
    confirmada.estado === 201 &&
      confirmada.datos?.creado?.carpetas === 5 &&
      confirmada.datos?.creado?.actividades === 3,
    `carpetas=${confirmada.datos?.creado?.carpetas} actividades=${confirmada.datos?.creado?.actividades}`,
  );

  const despuesDeImportar = await db.query(
    'SELECT count(*)::int n FROM carpetas_fotos',
  );
  check(
    'y la vista previa NO había escrito: el conteo solo sube al confirmar',
    despuesDeImportar.rows[0].n - antesDeImportar.rows[0].n === 5,
    `+${despuesDeImportar.rows[0].n - antesDeImportar.rows[0].n} carpetas`,
  );

  titulo('FASE 8 · conflictos: Crear / Omitir / Actualizar (§19)');

  const segunda = await subirExcel(
    `/fotos/importacion/carpeta/${destino}/previa`,
    tokenAdmin,
    libro,
  );
  check(
    'reimportar el mismo archivo detecta los conflictos, no duplica en silencio',
    // Tres y no cuatro desde la Fase 4: la fila de tipo «Álbum» ya no crea
    // nada, así que tampoco puede chocar con nada.
    segunda.datos?.resumen?.conflictos === 3,
    `${segunda.datos?.resumen?.conflictos} conflicto(s)`,
  );
  check(
    'y las carpetas del camino ya salen como existentes',
    segunda.datos?.resumen?.carpetasExistentes === 5 &&
      segunda.datos?.resumen?.carpetasNuevas === 0,
    `existentes=${segunda.datos?.resumen?.carpetasExistentes} nuevas=${segunda.datos?.resumen?.carpetasNuevas}`,
  );

  const omitiendo = await subirExcel(
    `/fotos/importacion/carpeta/${destino}/confirmar`,
    tokenAdmin,
    libro,
  );
  check(
    'sin decisiones se OMITE: ante la duda, no duplicar',
    omitiendo.datos?.creado?.actividades === 0 &&
      omitiendo.datos?.omitido?.actividades === 3,
    `creadas=${omitiendo.datos?.creado?.actividades} omitidas=${omitiendo.datos?.omitido?.actividades}`,
  );

  const decisiones = {};
  for (const c of segunda.datos?.conflictos ?? []) decisiones[c.fila] = 'ACTUALIZAR';
  const actualizando = await subirExcel(
    `/fotos/importacion/carpeta/${destino}/confirmar`,
    tokenAdmin,
    libro,
    decisiones,
  );
  check(
    'con ACTUALIZAR se reescribe lo existente en vez de crear otro',
    actualizando.datos?.actualizado?.actividades === 3 &&
      actualizando.datos?.creado?.actividades === 0,
    `actualizadas=${actualizando.datos?.actualizado?.actividades} creadas=${actualizando.datos?.creado?.actividades}`,
  );

  const creando = { };
  for (const c of segunda.datos?.conflictos ?? []) creando[c.fila] = 'CREAR';
  const duplicando = await subirExcel(
    `/fotos/importacion/carpeta/${destino}/confirmar`,
    tokenAdmin,
    libro,
    creando,
  );
  check(
    'y con CREAR sí se añade otra, que es lo que esa opción significa',
    duplicando.datos?.creado?.actividades === 3,
    `creadas=${duplicando.datos?.creado?.actividades}`,
  );

  const importaciones = await eventosDe('IMPORTACION_EXCEL');
  check(
    '§23.13 importar Excel queda registrado',
    importaciones.length >= 1,
    importaciones[0]?.descripcion ?? '(ninguno)',
  );

  titulo('FASE 8 · el permiso de importar es de la carpeta, no global');

  const ajena = await subirExcel(
    `/fotos/importacion/carpeta/${destino}/previa`,
    supervisor.token,
    libro,
  );
  check(
    'quien no ve la carpeta no puede importar en ella',
    ajena.estado === 404 || ajena.estado === 403,
    `HTTP ${ajena.estado}`,
  );

  // Limpieza de lo que creó la importación, de más profundo a menos.
  const creadas = await db.query(
    'SELECT id, ruta FROM carpetas_fotos WHERE ruta LIKE $1 ORDER BY length(ruta) DESC',
    [`${raiz.datos.id}/%`],
  );
  // ⚠️ Desde la Fase 1 las actividades cuelgan de un CICLO, así que ya no se
  // pueden borrar por `carpetaId` —esa columna no existe—. Tampoco hace
  // falta: `ciclos_fotos` y `actividades_fotos` van con Cascade y se las
  // lleva el borrado de la carpeta. Lo que sí hay que retirar a mano son los
  // álbumes, que son `Restrict` y la bloquean.
  // Desde la Fase 4 no hay álbumes que retirar antes: `ciclos_fotos`,
  // `actividades_fotos` y `albumes_fotos` van todos con Cascade, así que la
  // carpeta se lleva lo suyo.
  for (const c of creadas.rows)
    await db.query('DELETE FROM carpetas_fotos WHERE id = $1', [c.id]).catch(() => {});
  await db.query('DELETE FROM plantillas_estructura_fotos WHERE nombre LIKE $1', [
    'Inspección de Equipo',
  ]);
  await db.query('DELETE FROM plantillas_estructura_fotos WHERE nombre LIKE $1', [
    '__verif%',
  ]);

  await api('DELETE', `/usuario/${supervisor.id}`, tokenAdmin);
}

// ═════════════════════════════════════════════════════════════
// REGRESIÓN — los módulos que Fotos no debe tocar
// ═════════════════════════════════════════════════════════════
/**
 * Fase 9 · lo que el frontend descubrió y el backend tuvo que cerrar.
 *
 * El único hallazgo con código detrás: un álbum VACÍO no se podía retirar por
 * ninguna vía —salió al limpiar una prueba por API, y además bloqueaba el
 * borrado de su carpeta porque la FK es `Restrict`—. Se cubre aquí y no en la
 * Fase 6 porque la 6 ya está cerrada y verificada; mezclarlo allí haría que
 * su cuenta de comprobaciones dejara de coincidir con lo que se reportó.
 */
async function fase9(db, token) {
  titulo('FASE 9 · una carpeta con fotos dentro no se borra (Fase 4)');

  // ⚠️ Este bloque probaba el borrado de un ÁLBUM: vacío sí, con fotos no.
  // Los álbumes se retiraron en la Fase 4, y con ellos el `Restrict` que era
  // —sin que lo pareciera— lo que impedía borrar una carpeta con contenido.
  // La protección se movió a `CarpetaService.eliminar`, que cuenta las FOTOS
  // del subárbol. Eso es lo que se comprueba ahora: mide el contenido, no el
  // envase.
  const raiz = await api('POST', '/fotos/carpeta', token, {
    nombre: `Fase9 fotos ${Date.now()}`,
  });
  check('Carpeta de prueba creada', raiz.estado === 201, `HTTP ${raiz.estado}`);
  if (raiz.estado !== 201) return;
  pendientesDeLimpiar.push(raiz.datos.id);

  const equipo9 = await api('POST', '/fotos/carpeta', token, {
    nombre: 'Equipo con fotos',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
  });
  pendientesDeLimpiar.push(equipo9.datos?.id);
  const ciclo9 = await cicloAbiertoDe(equipo9.datos?.id, token);

  const img = await imagenDePrueba();
  const sub = await subirFotos(`/fotos/ciclo/${ciclo9}/foto`, token, [img]);
  check('Foto subida a la visita', sub.datos?.subidas === 1, JSON.stringify(sub.datos));

  const rechazo = await api('DELETE', `/fotos/carpeta/${equipo9.datos.id}`, token);
  check(
    'una carpeta CON fotos dentro se rechaza con 400',
    rechazo.estado === 400,
    `HTTP ${rechazo.estado}`,
  );
  check(
    'y el mensaje dice cuántas fotos lo impiden',
    /1 foto/.test(rechazo.datos?.message ?? ''),
    rechazo.datos?.message,
  );

  // Y la madre tampoco, porque tiene una hija dentro. Son dos candados
  // distintos y los dos siguen en pie.
  const conHija = await api('DELETE', `/fotos/carpeta/${raiz.datos.id}`, token);
  check(
    'y la carpeta madre sigue bloqueada por su hija',
    conHija.estado === 400 && /carpeta\(s\) dentro/.test(conHija.datos?.message ?? ''),
    `HTTP ${conHija.estado} · ${conHija.datos?.message ?? ''}`,
  );

  // 3 · la descripción de una foto se corrige (Fase 2b)
  const g = await api('GET', `/fotos/ciclo/${ciclo9}/foto`, token);
  const foto = (g.datos?.fotos ?? [])[0];

  // ⚠️ La galería NO devolvía la descripción por foto hasta la Fase 2b, y
  // sin eso no hay nada que corregir en la pantalla.
  check(
    'La galería devuelve la descripción de cada foto',
    foto !== undefined && 'descripcion' in foto,
    JSON.stringify(Object.keys(foto ?? {})),
  );

  const editada = await api('PATCH', `/fotos/foto/${foto.id}`, token, {
    descripcion: 'Compresor con fuga en la línea de succión',
  });
  check(
    'Se corrige la descripción de una foto ya subida',
    editada.estado === 200 &&
      editada.datos?.descripcion === 'Compresor con fuga en la línea de succión',
    `HTTP ${editada.estado} · ${editada.datos?.descripcion}`,
  );

  const gDesc = await api('GET', `/fotos/ciclo/${ciclo9}/foto`, token);
  const fotoDesc = (gDesc.datos?.fotos ?? [])[0];
  check(
    'y se lee de vuelta en la galería',
    fotoDesc?.descripcion === 'Compresor con fuga en la línea de succión',
    String(fotoDesc?.descripcion),
  );

  // ⚠️ El rastro es lo que hace de esto una corrección y no una edición
  // silenciosa: la bitácora guarda el valor ANTERIOR y el nuevo.
  // El evento cuelga del EQUIPO, que es la carpeta de la foto — la raíz solo
  // es su madre, y el hilo de §23 es por carpeta.
  const hist = await api(
    'GET',
    `/fotos/auditoria/carpeta/${equipo9.datos.id}`,
    token,
  );
  check(
    'y queda en la bitácora con el valor anterior y el nuevo',
    (hist.datos?.eventos ?? hist.datos ?? []).some(
      (e) =>
        e.entidad === 'FOTO' &&
        e.accion === 'EDICION' &&
        /Compresor con fuga/.test(e.descripcion ?? ''),
    ),
    JSON.stringify(
      (hist.datos?.eventos ?? hist.datos ?? [])
        .filter((e) => e.entidad === 'FOTO')
        .map((e) => e.descripcion),
    ),
  );

  const vaciada = await api('PATCH', `/fotos/foto/${foto.id}`, token, {
    descripcion: '',
  });
  check(
    'vaciarla es una corrección válida y la deja en null',
    vaciada.estado === 200 && vaciada.datos?.descripcion === null,
    `HTTP ${vaciada.estado} · ${JSON.stringify(vaciada.datos?.descripcion)}`,
  );

  // ⚠️ Lo que NO se puede es reemplazar la IMAGEN: no hay ruta, y es a
  // propósito —cambiar el archivo detrás de un registro ya existente
  // permitiría alterar la prueba de una inspección sin que se note—.
  const reemplazo = await subirFotos(`/fotos/foto/${foto.id}`, token, [img]);
  check(
    'no existe forma de reemplazar el ARCHIVO de una foto',
    reemplazo.estado === 404,
    `HTTP ${reemplazo.estado}`,
  );

  // 4 · al irse la última foto la carpeta vuelve a poder borrarse
  //
  // ⚠️ Aquí se comprobaba que el ÁLBUM se quedaba vacío en vez de borrarse
  // solo (Fase 2b), y que su carpeta seguía bloqueada por él. Sin álbumes, lo
  // que queda es la regla que importaba: sin fotos dentro, la carpeta se va.
  // Un ciclo vacío NO la bloquea —es una visita, no contenido— y por eso
  // `ciclos_fotos` va con Cascade.
  await api('DELETE', `/fotos/foto/${foto.id}`, token);
  const sinFotos = await api(
    'DELETE',
    `/fotos/carpeta/${equipo9.datos.id}`,
    token,
  );
  check(
    'sin fotos dentro, el equipo se elimina — su ciclo vacío no lo bloquea',
    sinFotos.estado === 200,
    `HTTP ${sinFotos.estado} · ${sinFotos.datos?.message ?? ''}`,
  );
  if (sinFotos.estado === 200)
    pendientesDeLimpiar.splice(
      pendientesDeLimpiar.indexOf(equipo9.datos.id),
      1,
    );

  const dc = await api('DELETE', `/fotos/carpeta/${raiz.datos.id}`, token);
  check('y la carpeta madre ya vacía también', dc.estado === 200, `HTTP ${dc.estado}`);
  if (dc.estado === 200)
    pendientesDeLimpiar.splice(pendientesDeLimpiar.indexOf(raiz.datos.id), 1);

  titulo('FASE 9 · mover una foto (Fase 2c)');

  // Dos carpetas hermanas para poder mover ENTRE ellas, y una actividad.
  const raizM = await api('POST', '/fotos/carpeta', token, {
    nombre: `__verif_2c ${Date.now()}`,
  });
  pendientesDeLimpiar.unshift(raizM.datos.id);
  // Los dos son EQUIPOS: desde la Fase 4 una foto vive en un CICLO, y solo un
  // equipo tiene ciclos. «Mover entre carpetas» pasó a ser «mover entre
  // visitas», que es la misma pregunta un nivel más abajo.
  const origenC = await api('POST', '/fotos/carpeta', token, {
    nombre: 'Origen',
    parentId: raizM.datos.id,
    tipo: 'EQUIPO',
  });
  pendientesDeLimpiar.unshift(origenC.datos.id);
  const destinoC = await api('POST', '/fotos/carpeta', token, {
    nombre: 'Destino',
    parentId: raizM.datos.id,
    tipo: 'EQUIPO',
  });
  pendientesDeLimpiar.unshift(destinoC.datos.id);
  const cicloM = await cicloAbiertoDe(destinoC.datos.id, token);
  const actividadM = await api(
    'POST',
    `/fotos/ciclo/${cicloM}/actividad`,
    token,
    { titulo: 'Inspección 2c' },
  );

  const cicloOrigen = await cicloAbiertoDe(origenC.datos.id, token);
  await subirFotos(`/fotos/ciclo/${cicloOrigen}/foto`, token, [img], {
    descripcion: 'foto de origen',
  });
  const gM = await api('GET', `/fotos/ciclo/${cicloOrigen}/foto`, token);
  const fotoM = (gM.datos?.fotos ?? [])[0];

  const sinDestino = await api('POST', `/fotos/foto/${fotoM.id}/mover`, token, {});
  check(
    'mover sin decir a dónde se rechaza',
    sinDestino.estado === 400,
    `HTTP ${sinDestino.estado}`,
  );

  // 1 · a la visita de otro equipo. Ya no hay álbum que crear: el destino
  // existe desde que el equipo se dio de alta.
  const aCiclo = await api('POST', `/fotos/foto/${fotoM.id}/mover`, token, {
    cicloId: cicloM,
  });
  const gDestino = await api('GET', `/fotos/ciclo/${cicloM}/foto`, token);
  check(
    'se mueve a la visita de otro equipo',
    aCiclo.estado === 201 && (gDestino.datos?.fotos ?? []).length === 1,
    `HTTP ${aCiclo.estado} · ${gDestino.datos?.fotos?.length} foto(s)`,
  );

  const gOrigen = await api('GET', `/fotos/ciclo/${cicloOrigen}/foto`, token);
  check(
    'y la visita de origen se queda sin ella, pero sigue existiendo',
    (gOrigen.datos?.fotos ?? []).length === 0,
    `${gOrigen.datos?.fotos?.length} foto(s)`,
  );

  // 2 · a una ACTIVIDAD.
  const aActividadM = await api('POST', `/fotos/foto/${fotoM.id}/mover`, token, {
    actividadId: actividadM.datos.id,
  });
  const fotosT = await api('GET', `/fotos/actividad/${actividadM.datos.id}/foto`, token);
  check(
    'se mueve a una actividad',
    aActividadM.estado === 201 && (fotosT.datos ?? []).length === 1,
    `HTTP ${aActividadM.estado} · ${(fotosT.datos ?? []).length}`,
  );

  // 3 · mover a donde ya está no escribe ni ensucia la bitácora.
  const mismoSitio = await api('POST', `/fotos/foto/${fotoM.id}/mover`, token, {
    actividadId: actividadM.datos.id,
  });
  check(
    'moverla a donde ya está se contesta sin cambios',
    mismoSitio.estado === 201 && mismoSitio.datos?.sinCambios === true,
    `HTTP ${mismoSitio.estado} · sinCambios=${mismoSitio.datos?.sinCambios}`,
  );

  // 4 · el rastro de §23, con origen y destino legibles.
  const histM = await api(
    'GET',
    `/fotos/auditoria/carpeta/${destinoC.datos.id}`,
    token,
  );
  const evsM = (histM.datos?.eventos ?? histM.datos ?? []).filter(
    (e) => e.accion === 'MOVIMIENTO' && e.entidad === 'FOTO',
  );
  check(
    'cada movimiento queda en la bitácora diciendo de dónde a dónde',
    evsM.length >= 1 && /→/.test(evsM[0].descripcion ?? ''),
    evsM[0]?.descripcion,
  );

  // 5 · el permiso es de los DOS lados.
  const ajenoM = await cuentaDePrueba(token, 'f9mover', [{ modulo: 'FOTOS' }]);
  if (ajenoM) {
    const sinNinguno = await api(
      'POST',
      `/fotos/foto/${fotoM.id}/mover`,
      ajenoM.token,
      { cicloId: cicloOrigen },
    );
    check(
      'quien no ve la foto no la mueve — el 404 uniforme',
      sinNinguno.estado === 404,
      `HTTP ${sinNinguno.estado}`,
    );

    // Se le comparte SOLO el origen: puede leer y escribir donde está la
    // foto, pero no en el destino. Debe fallar igual.
    await api('POST', '/fotos/compartir', token, {
      email: ajenoM.email,
      carpetaIds: [destinoC.datos.id],
      permiso: 'EDICION',
    });
    const sinDestinoPermiso = await api(
      'POST',
      `/fotos/foto/${fotoM.id}/mover`,
      ajenoM.token,
      { cicloId: cicloOrigen },
    );
    check(
      'con permiso solo en el ORIGEN, mover al destino se rechaza',
      sinDestinoPermiso.estado === 404 || sinDestinoPermiso.estado === 403,
      `HTTP ${sinDestinoPermiso.estado}`,
    );

    // ⚠️ Y no puede mandar a su bandeja una foto que no subió: la bandeja
    // de §18 es privada de quien sube, así que ahí desaparecería para todos
    // menos para su autor.
    const aBandejaAjena = await api(
      'POST',
      `/fotos/foto/${fotoM.id}/mover`,
      ajenoM.token,
      { bandeja: true },
    );
    check(
      'nadie manda a «sin clasificar» una foto que no subió',
      aBandejaAjena.estado === 400,
      `HTTP ${aBandejaAjena.estado}`,
    );

    await api('DELETE', `/usuario/${ajenoM.id}`, token);
  }

  // 6 · su autor SÍ la devuelve a la bandeja.
  const aBandejaM = await api('POST', `/fotos/foto/${fotoM.id}/mover`, token, {
    bandeja: true,
  });
  const bandejaM = await api('GET', '/fotos/bandeja', token);
  check(
    'su autor sí la devuelve a «sin clasificar»',
    aBandejaM.estado === 201 &&
      (bandejaM.datos?.fotos ?? []).some((f) => f.id === fotoM.id),
    `HTTP ${aBandejaM.estado}`,
  );

  titulo('FASE 9 · clasificar desde la bandeja hacia una visita (Fase 4)');

  // ⚠️ Aquí se probaba «crear el álbum CON NOMBRE al clasificar» (Fase 2c):
  // el álbum que recogía el lote nacía sin título y había que ir a editarlo
  // después. Con los álbumes retirados el problema desapareció con ellos —el
  // destino ya existe y ya tiene nombre: es la visita—, así que lo que queda
  // por comprobar es que clasificar hacia un ciclo funciona y que el cuerpo
  // ya no habla de álbumes.
  const clasM = await api('POST', '/fotos/bandeja/clasificar', token, {
    fotoIds: [fotoM.id],
    cicloId: cicloOrigen,
  });
  check(
    'una foto de la bandeja se clasifica en una visita',
    clasM.estado === 201 && clasM.datos?.clasificadas === 1,
    `HTTP ${clasM.estado} · ${JSON.stringify(clasM.datos)}`,
  );
  check(
    'y el resultado dice a qué ciclo fue, no a qué álbum',
    clasM.datos?.cicloId === cicloOrigen && !('albumId' in (clasM.datos ?? {})),
    JSON.stringify(clasM.datos),
  );

  const gClas = await api('GET', `/fotos/ciclo/${cicloOrigen}/foto`, token);
  check(
    'la foto aparece en la galería de esa visita',
    (gClas.datos?.fotos ?? []).some((f) => f.id === fotoM.id),
    `${gClas.datos?.fotos?.length} foto(s)`,
  );

  // Limpieza de esta sección. Ya no hay álbumes que retirar antes: la foto
  // basta, porque es lo que bloquea el borrado de la carpeta.
  await api('DELETE', `/fotos/foto/${fotoM.id}`, token);
  await api('DELETE', `/fotos/actividad/${actividadM.datos.id}`, token);

  // «no existe» y «no la ves» contestan lo mismo, ahora sobre un CICLO.
  const fantasma = await api('GET', '/fotos/ciclo/99999999/foto', token);
  check(
    'un ciclo inexistente contesta 404 con el texto uniforme',
    fantasma.estado === 404 &&
      /no existe o no tienes acceso/.test(fantasma.datos?.message ?? ''),
    `HTTP ${fantasma.estado} · ${fantasma.datos?.message}`,
  );
}

/**
 * Fase 10 · exportaciones (§69) y el candado que le faltaba a la bitácora.
 *
 * Las dos mitades van juntas a propósito: exportar la auditoría sin haber
 * cerrado antes quién puede leerla habría sido ampliar el agujero, no
 * cerrarlo.
 */
async function fase10(db, tokenAdmin) {
  titulo('FASE 10 · la bitácora ya no es un canal lateral');

  const sup = await cuentaDePrueba(tokenAdmin, 'f10sup', [{ modulo: 'FOTOS' }]);
  const lector = await cuentaDePrueba(tokenAdmin, 'f10lec', [
    { modulo: 'FOTOS', nivelFotos: 'LECTURA_GLOBAL' },
  ]);
  if (!sup || !lector) return;

  // Una carpeta que el supervisor NO puede ver.
  // De tipo EQUIPO porque una de las tres exportaciones son sus actividades, y
  // desde la Fase 1 ésas cuelgan de un ciclo, que solo tiene un equipo.
  const oculta = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `Fase10 oculta ${Date.now()}`,
    tipo: 'EQUIPO',
  });
  if (oculta.estado !== 201) {
    check('Carpeta de prueba creada', false, `HTTP ${oculta.estado}`);
    return;
  }
  pendientesDeLimpiar.push(oculta.datos.id);
  const cid = oculta.datos.id;
  const cicloCid = await cicloAbiertoDe(cid, tokenAdmin);

  // La premisa: no la ve.
  const ve = await api('GET', `/fotos/carpeta/${cid}`, sup.token);
  check('El supervisor NO ve la carpeta (404)', ve.estado === 404, `HTTP ${ve.estado}`);

  // ⚠️ Esto es lo que estaba roto: la bitácora la enseñaba igual.
  const hilo = await api('GET', `/fotos/auditoria/carpeta/${cid}`, sup.token);
  check(
    'Y tampoco ve su historial — mismo 404, no un 200 con los eventos',
    hilo.estado === 404,
    `HTTP ${hilo.estado}`,
  );

  const global = await api('GET', '/fotos/auditoria', sup.token);
  check(
    'La bitácora del módulo le contesta 403',
    global.estado === 403,
    `HTTP ${global.estado}`,
  );

  // Un LECTURA_GLOBAL sí ve el hilo de la carpeta (tiene LECTURA sobre todo)
  // pero NO la consulta general, que es de ADMIN_GLOBAL.
  const hiloLector = await api('GET', `/fotos/auditoria/carpeta/${cid}`, lector.token);
  check(
    'Un LECTURA_GLOBAL sí ve el historial de la carpeta',
    hiloLector.estado === 200,
    `HTTP ${hiloLector.estado}`,
  );
  const globalLector = await api('GET', '/fotos/auditoria', lector.token);
  check(
    '…pero la consulta general sigue siendo de ADMIN_GLOBAL',
    globalLector.estado === 403,
    `HTTP ${globalLector.estado}`,
  );

  const admin = await api('GET', '/fotos/auditoria', tokenAdmin);
  check('El administrador la sigue consultando', admin.estado === 200, `HTTP ${admin.estado}`);

  titulo('FASE 10 · exportaciones (§69)');

  const descargar = async (ruta, token) => {
    const r = await fetch(API + ruta, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const buf = Buffer.from(await r.arrayBuffer());
    return {
      estado: r.status,
      buffer: buf,
      nombre: r.headers.get('content-disposition') ?? '',
      tipo: r.headers.get('content-type') ?? '',
    };
  };
  const esXlsx = (b) => b.slice(0, 2).toString('hex') === '504b';
  const esPdf = (b) => b.slice(0, 4).toString() === '%PDF';

  for (const [ruta, etiqueta] of [
    [`/fotos/ciclo/${cicloCid}/actividad/exportar`, 'Actividades'],
    ['/fotos/auditoria/exportar', 'Auditoría del módulo'],
    [`/fotos/auditoria/carpeta/${cid}/exportar`, 'Historial de carpeta'],
  ]) {
    const x = await descargar(`${ruta}?formato=excel`, tokenAdmin);
    check(
      `${etiqueta} · Excel se genera y es un XLSX de verdad`,
      x.estado === 200 && esXlsx(x.buffer) && x.buffer.length > 1000,
      `HTTP ${x.estado} · ${x.buffer.length} bytes`,
    );
    const p = await descargar(`${ruta}?formato=pdf`, tokenAdmin);
    check(
      `${etiqueta} · PDF se genera y es un PDF de verdad`,
      p.estado === 200 && esPdf(p.buffer) && p.buffer.length > 1000,
      `HTTP ${p.estado} · ${p.buffer.length} bytes`,
    );
  }

  const malo = await api('GET', '/fotos/auditoria/exportar?formato=word', tokenAdmin);
  check('Un formato inválido se rechaza con 400', malo.estado === 400, `HTTP ${malo.estado}`);

  // El permiso de exportar es el del service que lee, no uno propio.
  const expSup = await descargar(`/fotos/ciclo/${cicloCid}/actividad/exportar`, sup.token);
  check(
    'Exportar las actividades de un ciclo que no ve → 404',
    expSup.estado === 404,
    `HTTP ${expSup.estado}`,
  );
  const audSup = await descargar('/fotos/auditoria/exportar', sup.token);
  check(
    'Exportar la bitácora sin ser administrador → 403',
    audSup.estado === 403,
    `HTTP ${audSup.estado}`,
  );

  // ⚠️ El nombre de archivo va dentro de una cabecera HTTP y lo escribe
  // cualquiera: una carpeta con comillas rompía el `filename` y colaba
  // parámetros sueltos en `Content-Disposition`.
  const mala = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'ma"la; evil=1',
  });
  if (mala.estado === 201) {
    pendientesDeLimpiar.push(mala.datos.id);
    const x = await descargar(
      `/fotos/auditoria/carpeta/${mala.datos.id}/exportar?formato=excel`,
      tokenAdmin,
    );
    check(
      'Un nombre con comillas NO inyecta parámetros en la cabecera',
      !/evil=1/.test(x.nombre) && /^attachment; filename="[\w.-]+"$/.test(x.nombre),
      x.nombre,
    );
  }

  // Y los acentos se pliegan en vez de salir crudos en la cabecera.
  const conTilde = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Pabellón ñandú',
  });
  if (conTilde.estado === 201) {
    pendientesDeLimpiar.push(conTilde.datos.id);
    const x = await descargar(
      `/fotos/auditoria/carpeta/${conTilde.datos.id}/exportar?formato=excel`,
      tokenAdmin,
    );
    check(
      'Los acentos del nombre se pliegan a ASCII',
      x.nombre.includes('Pabellon_nandu'),
      x.nombre,
    );
  }
}

// ═════════════════════════════════════════════════════════════
// REDISEÑO · FASE 1 — ciclos de un equipo
// ═════════════════════════════════════════════════════════════
/**
 * Los ciclos (visitas) de un equipo.
 *
 * Cuatro cosas que esta fase tiene que sostener, y ninguna la ve el
 * compilador:
 *
 *  1. **Un solo ciclo abierto por equipo.** Se comprueba por partida doble:
 *     la API lo rechaza con un mensaje legible, y el ÍNDICE PARCIAL de la
 *     base lo rechaza también cuando se le escribe por debajo saltándose el
 *     service. Sin la segunda mitad, la prueba solo diría que el service
 *     recuerda mirar — que es justo lo que un candado de base existe para
 *     que nadie tenga que recordar.
 *  2. **Abrir hereda el checklist**, y solo el checklist: las actividades
 *     nacen PENDIENTES, sin responsable y sin marca de completado.
 *  3. **Un ciclo cerrado no lo edita NADIE, tampoco un `ADMIN_GLOBAL`.**
 *  4. **Reabrir es explícito y deja su propia entrada en la bitácora.**
 */
async function ciclos(db, tokenAdmin) {
  titulo('REDISEÑO FASE 1 · un equipo nace con su ciclo 1 (§4.2)');

  const adminG = await cuentaDePrueba(tokenAdmin, 'cicloadm', [
    { modulo: 'FOTOS', nivelFotos: 'ADMIN_GLOBAL' },
  ]);
  if (!adminG) return;

  const raiz = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `__verif_ciclos ${Date.now()}`,
  });
  pendientesDeLimpiar.unshift(raiz.datos.id);

  const equipo = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Fancoil de prueba',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
  });
  if (equipo.estado !== 201) {
    check('carpeta de equipo creada', false, `HTTP ${equipo.estado}`);
    await api('DELETE', `/usuario/${adminG.id}`, tokenAdmin);
    return;
  }
  pendientesDeLimpiar.unshift(equipo.datos.id);
  const equipoId = equipo.datos.id;

  const lista0 = await api('GET', `/fotos/carpeta/${equipoId}/ciclo`, tokenAdmin);
  const c1 = (lista0.datos ?? [])[0];
  check(
    'al crear el equipo nace su Ciclo 1, abierto y sin estado',
    lista0.estado === 200 &&
      lista0.datos.length === 1 &&
      c1.numero === 1 &&
      c1.cerradoEn === null &&
      c1.estado === null,
    `${lista0.datos?.length} ciclo(s) · numero=${c1?.numero} cerradoEn=${c1?.cerradoEn} estado=${c1?.estado}`,
  );
  check(
    'y guarda quién lo abrió',
    !!c1?.abiertoPor?.id && c1.cerradoPor === null,
    `abiertoPor=${c1?.abiertoPor?.nombre} cerradoPor=${c1?.cerradoPor}`,
  );
  if (!c1) return;
  const ciclo1 = c1.id;

  // Una carpeta corriente no tiene ciclos: es la misma lectura estricta de
  // §13, un escalón más arriba.
  const corriente = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Carpeta corriente',
    parentId: raiz.datos.id,
  });
  pendientesDeLimpiar.unshift(corriente.datos.id);
  const cicloCorriente = await api(
    'POST',
    `/fotos/carpeta/${corriente.datos.id}/ciclo`,
    tokenAdmin,
  );
  check(
    'una carpeta corriente no admite ciclos',
    cicloCorriente.estado === 400 &&
      /no lo es/.test(cicloCorriente.datos?.message ?? ''),
    `HTTP ${cicloCorriente.estado}`,
  );

  // ── El checklist del ciclo 1 ──
  const titulos = ['Revisar filtros', 'Medir presiones', 'Limpiar serpentín'];
  const creadas = [];
  for (const t of titulos) {
    const a = await api('POST', `/fotos/ciclo/${ciclo1}/actividad`, tokenAdmin, {
      titulo: t,
      prioridad: 'ALTA',
      responsableId: adminG.id,
    });
    if (a.datos?.id) creadas.push(a.datos.id);
  }
  check(
    'las actividades cuelgan del ciclo, no de la carpeta',
    creadas.length === 3,
    `${creadas.length} de 3`,
  );
  if (creadas.length !== 3) return;

  const completada = await api(
    'POST',
    `/fotos/actividad/${creadas[0]}/completar`,
    tokenAdmin,
  );
  check(
    'una de ellas se completa dentro del ciclo abierto',
    completada.estado === 200 || completada.estado === 201,
    `HTTP ${completada.estado}`,
  );

  titulo('REDISEÑO FASE 1 · un solo ciclo abierto por equipo');

  // 1ª mitad: la puerta normal.
  const segundo = await api('POST', `/fotos/carpeta/${equipoId}/ciclo`, tokenAdmin);
  check(
    'la API rechaza abrir un segundo ciclo con uno en curso, y dice cuál',
    segundo.estado === 400 &&
      /ciclo 1 sigue abierto/i.test(segundo.datos?.message ?? ''),
    `HTTP ${segundo.estado} · ${segundo.datos?.message ?? ''}`,
  );

  // 2ª mitad: el candado de la BASE, escribiendo por debajo del service.
  //
  // ⚠️ Esto es lo que de verdad prueba el índice. Prisma no sabe declarar un
  // índice único PARCIAL, así que lo crea la migración a mano — y un objeto
  // que solo existe en un `.sql` es exactamente el que una migración futura
  // puede dejarse por el camino sin que nada compile mal.
  const fila = await db.query(
    'SELECT "carpetaId", "abiertoPorId" FROM ciclos_fotos WHERE id = $1',
    [ciclo1],
  );
  const { carpetaId, abiertoPorId } = fila.rows[0];
  const mensaje = await debeFallar(
    db,
    `INSERT INTO ciclos_fotos ("carpetaId", numero, "abiertoPorId", "actualizadoEn")
     VALUES (${carpetaId}, 99, ${abiertoPorId}, now())`,
  );
  check(
    'y el índice único PARCIAL lo rechaza también saltándose el service',
    mensaje !== null && /ciclos_fotos_un_solo_abierto_idx/.test(mensaje),
    mensaje ? mensaje.split('\n')[0] : 'el INSERT entró (no debía)',
  );

  const def = await db.query(
    `SELECT indexdef FROM pg_indexes WHERE indexname = 'ciclos_fotos_un_solo_abierto_idx'`,
  );
  check(
    'el índice es UNIQUE y está acotado a los ciclos abiertos',
    def.rows.length === 1 &&
      /UNIQUE/i.test(def.rows[0].indexdef) &&
      /WHERE \("?cerradoEn"? IS NULL\)/i.test(def.rows[0].indexdef),
    def.rows[0]?.indexdef ?? 'no existe',
  );

  titulo('REDISEÑO FASE 1 · un ciclo cerrado es historial, para TODOS');

  const cerrado = await api('POST', `/fotos/ciclo/${ciclo1}/cerrar`, tokenAdmin);
  check(
    'cerrar registra cuándo y quién',
    (cerrado.estado === 200 || cerrado.estado === 201) &&
      cerrado.datos?.cerradoEn !== null &&
      !!cerrado.datos?.cerradoPor?.id,
    `HTTP ${cerrado.estado} · cerradoPor=${cerrado.datos?.cerradoPor?.nombre}`,
  );

  const otraVez = await api('POST', `/fotos/ciclo/${ciclo1}/cerrar`, tokenAdmin);
  check(
    'cerrar dos veces se rechaza',
    otraVez.estado === 400,
    `HTTP ${otraVez.estado}`,
  );

  // ⚠️ La comprobación central de la fase: el ADMIN_GLOBAL alcanza TODO el
  // árbol y aun así no puede tocar un ciclo cerrado. El candado no es de
  // rol, es de estado — y si el administrador pudiera saltárselo, el
  // historial dejaría de valer para lo único que sirve.
  const nuevaEnCerrado = await api(
    'POST',
    `/fotos/ciclo/${ciclo1}/actividad`,
    adminG.token,
    { titulo: 'A destiempo' },
  );
  check(
    'un ADMIN_GLOBAL NO puede añadir actividades a un ciclo cerrado',
    nuevaEnCerrado.estado === 400 &&
      /cerrado/.test(nuevaEnCerrado.datos?.message ?? ''),
    `HTTP ${nuevaEnCerrado.estado} · ${nuevaEnCerrado.datos?.message ?? ''}`,
  );

  const editaCerrado = await api(
    'PATCH',
    `/fotos/actividad/${creadas[1]}`,
    adminG.token,
    { titulo: 'Retocada después' },
  );
  check(
    'un ADMIN_GLOBAL NO puede editar una actividad de un ciclo cerrado',
    editaCerrado.estado === 400 &&
      /cerrado/.test(editaCerrado.datos?.message ?? ''),
    `HTTP ${editaCerrado.estado}`,
  );

  const completaCerrado = await api(
    'POST',
    `/fotos/actividad/${creadas[1]}/completar`,
    adminG.token,
  );
  check(
    'ni completarla',
    completaCerrado.estado === 400,
    `HTTP ${completaCerrado.estado}`,
  );

  const borraCerrado = await api(
    'DELETE',
    `/fotos/actividad/${creadas[1]}`,
    adminG.token,
  );
  check('ni borrarla', borraCerrado.estado === 400, `HTTP ${borraCerrado.estado}`);

  const img = await imagenDePrueba();
  const subeCerrado = await subirFotos(
    `/fotos/actividad/${creadas[0]}/foto`,
    adminG.token,
    [img],
  );
  check(
    'ni subir fotos a una actividad suya',
    subeCerrado.estado === 400 && /cerrado/.test(subeCerrado.datos?.message ?? ''),
    `HTTP ${subeCerrado.estado} · ${subeCerrado.datos?.message ?? ''}`,
  );

  const estadoCerrado = await api(
    'PATCH',
    `/fotos/ciclo/${ciclo1}/estado`,
    adminG.token,
    { estadoId: null },
  );
  check(
    'ni cambiar el estado del equipo en ese ciclo',
    estadoCerrado.estado === 400,
    `HTTP ${estadoCerrado.estado}`,
  );

  // Leerlo sí, por supuesto: es historial, no un secreto.
  const leeCerrado = await api(
    'GET',
    `/fotos/ciclo/${ciclo1}/actividad`,
    adminG.token,
  );
  check(
    'pero LEER el ciclo cerrado sigue funcionando',
    leeCerrado.estado === 200 && leeCerrado.datos.length === 3,
    `HTTP ${leeCerrado.estado} · ${leeCerrado.datos?.length} actividad(es)`,
  );

  titulo('REDISEÑO FASE 1 · abrir el siguiente hereda el checklist (§4.3)');

  const ciclo2r = await api('POST', `/fotos/carpeta/${equipoId}/ciclo`, tokenAdmin);
  check(
    'con el anterior cerrado, el ciclo 2 sí entra',
    (ciclo2r.estado === 200 || ciclo2r.estado === 201) &&
      ciclo2r.datos?.numero === 2,
    `HTTP ${ciclo2r.estado} · numero=${ciclo2r.datos?.numero}`,
  );
  const ciclo2 = ciclo2r.datos?.id;
  if (!ciclo2) return;

  const heredadas = await api('GET', `/fotos/ciclo/${ciclo2}/actividad`, tokenAdmin);
  const h = heredadas.datos ?? [];
  check(
    'hereda las 3 actividades del ciclo anterior, con sus títulos',
    h.length === 3 && titulos.every((t) => h.some((a) => a.titulo === t)),
    `${h.length} actividad(es): ${h.map((a) => a.titulo).join(' · ')}`,
  );
  check(
    'son filas NUEVAS, no las mismas movidas de ciclo',
    h.every((a) => !creadas.includes(a.id)),
    `ids ciclo1=${creadas.join(',')} ciclo2=${h.map((a) => a.id).join(',')}`,
  );
  check(
    'nacen PENDIENTES y sin marca de completado, aunque una lo estuviera',
    h.every((a) => a.estado === 'PENDIENTE' && a.completadaEn === null),
    h.map((a) => a.estado).join(','),
  );
  check(
    'y sin el responsable de la visita anterior',
    h.every((a) => a.responsable === null),
    h.map((a) => a.responsable?.nombre ?? 'null').join(','),
  );
  check(
    'lo que SÍ se hereda es la prioridad — es del checklist, no del trabajo',
    h.every((a) => a.prioridad === 'ALTA'),
    h.map((a) => a.prioridad).join(','),
  );

  // Y el ciclo 1 sigue con lo suyo: heredar no es mover.
  const c1despues = await api('GET', `/fotos/ciclo/${ciclo1}/actividad`, tokenAdmin);
  check(
    'el ciclo 1 conserva sus actividades y su completada',
    c1despues.datos?.length === 3 &&
      c1despues.datos.some((a) => a.estado === 'COMPLETADA'),
    `${c1despues.datos?.length} actividad(es)`,
  );

  titulo('REDISEÑO FASE 1 · el estado del equipo (§7)');

  const estados = await api('GET', '/fotos/estado-equipo', tokenAdmin);
  check(
    'el catálogo de estados viene sembrado como DATOS, no en el código',
    estados.estado === 200 && estados.datos.length >= 3,
    `${estados.datos?.length} estado(s): ${(estados.datos ?? [])
      .map((e) => `${e.nombre}/${e.color}`)
      .join(' · ')}`,
  );
  const naranja = (estados.datos ?? []).find((e) => e.color === 'NARANJA');

  const puesto = await api('PATCH', `/fotos/ciclo/${ciclo2}/estado`, tokenAdmin, {
    estadoId: naranja?.id,
  });
  check(
    'se le pone estado al ciclo en curso',
    puesto.estado === 200 && puesto.datos?.estado?.id === naranja?.id,
    `HTTP ${puesto.estado} · estado=${puesto.datos?.estado?.nombre}`,
  );

  const inventado = await api('PATCH', `/fotos/ciclo/${ciclo2}/estado`, tokenAdmin, {
    estadoId: 999999,
  });
  check(
    'un estado que no existe se rechaza',
    inventado.estado === 404,
    `HTTP ${inventado.estado}`,
  );

  // §7: la tarjeta del explorador enseña el estado del ciclo MÁS RECIENTE.
  const explorador = await api('GET', `/fotos/carpeta/${raiz.datos.id}`, tokenAdmin);
  const tarjeta = (explorador.datos?.secciones ?? [])
    .flatMap((s) => s.carpetas ?? [])
    .find((c) => c.id === equipoId);
  check(
    'la tarjeta del explorador lleva el estado del ciclo más reciente',
    tarjeta?.estadoEquipo?.id === naranja?.id,
    `estadoEquipo=${tarjeta?.estadoEquipo?.nombre ?? 'null'}`,
  );

  const borrarEnUso = await api(
    'DELETE',
    `/fotos/estado-equipo/${naranja?.id}`,
    tokenAdmin,
  );
  check(
    'un estado con ciclos detrás no se borra: se ofrece retirarlo',
    borrarEnUso.estado === 400 && /Retíralo/.test(borrarEnUso.datos?.message ?? ''),
    `HTTP ${borrarEnUso.estado} · ${borrarEnUso.datos?.message ?? ''}`,
  );

  const configuraAdmin = await api('POST', '/fotos/estado-equipo', adminG.token, {
    nombre: `__verif_estado ${Date.now()}`,
    color: 'VERDE',
  });
  check(
    'configurar el catálogo es de ADMIN_GLOBAL — y éste lo es, así que entra',
    configuraAdmin.estado === 201,
    `HTTP ${configuraAdmin.estado}`,
  );
  if (configuraAdmin.datos?.id)
    await api(
      'DELETE',
      `/fotos/estado-equipo/${configuraAdmin.datos.id}`,
      tokenAdmin,
    );

  const colorRaro = await api('POST', '/fotos/estado-equipo', tokenAdmin, {
    nombre: `__verif_color ${Date.now()}`,
    color: 'FUCSIA',
  });
  check(
    'la PALETA sí es cerrada: un color inventado se rechaza',
    colorRaro.estado === 400 && /VERDE/.test(colorRaro.datos?.message ?? ''),
    `HTTP ${colorRaro.estado}`,
  );

  titulo('REDISEÑO FASE 1 · reabrir es explícito y deja rastro');

  const reabrirConOtroAbierto = await api(
    'POST',
    `/fotos/ciclo/${ciclo1}/reabrir`,
    tokenAdmin,
  );
  check(
    'no se reabre uno viejo con otro en curso — el invariante se sostiene',
    reabrirConOtroAbierto.estado === 400 &&
      /en curso/.test(reabrirConOtroAbierto.datos?.message ?? ''),
    `HTTP ${reabrirConOtroAbierto.estado} · ${reabrirConOtroAbierto.datos?.message ?? ''}`,
  );

  await api('POST', `/fotos/ciclo/${ciclo2}/cerrar`, tokenAdmin);
  const reabierto = await api('POST', `/fotos/ciclo/${ciclo1}/reabrir`, tokenAdmin);
  check(
    'con el otro cerrado, reabrir borra la marca de cierre',
    (reabierto.estado === 200 || reabierto.estado === 201) &&
      reabierto.datos?.cerradoEn === null &&
      reabierto.datos?.cerradoPor === null,
    `HTTP ${reabierto.estado} · cerradoEn=${reabierto.datos?.cerradoEn}`,
  );

  const editaTrasReabrir = await api(
    'PATCH',
    `/fotos/actividad/${creadas[1]}`,
    tokenAdmin,
    { titulo: 'Corregida tras reabrir' },
  );
  check(
    'y el ciclo vuelve a admitir cambios — que es para lo que se reabre',
    editaTrasReabrir.estado === 200,
    `HTTP ${editaTrasReabrir.estado}`,
  );

  const hilo = await api('GET', `/fotos/auditoria/carpeta/${equipoId}`, tokenAdmin);
  const eventos = hilo.datos ?? [];
  const tiene = (accion) => eventos.some((e) => e.accion === accion);
  check(
    'la bitácora registra abrir, cerrar Y reabrir por separado (§23)',
    tiene('CICLO_ABIERTO') && tiene('CICLO_CERRADO') && tiene('CICLO_REABIERTO'),
    eventos
      .filter((e) => e.entidad === 'CICLO')
      .map((e) => e.accion)
      .join(' · '),
  );
  const reap = eventos.find((e) => e.accion === 'CICLO_REABIERTO');
  check(
    'la entrada de reapertura dice quién y sobre qué ciclo',
    !!reap?.usuarioNombre && reap.entidadId === ciclo1,
    `${reap?.usuarioNombre} · entidadId=${reap?.entidadId} (ciclo1=${ciclo1})`,
  );
  const cambioEstado = eventos.find(
    (e) => e.entidad === 'CICLO' && e.campoAfectado === 'estado',
  );
  check(
    'y el cambio de estado guarda el valor anterior y el nuevo',
    !!cambioEstado && cambioEstado.valorNuevo === naranja?.nombre,
    `${cambioEstado?.valorAnterior} → ${cambioEstado?.valorNuevo}`,
  );

  await api('DELETE', `/usuario/${adminG.id}`, tokenAdmin);
}

// ═════════════════════════════════════════════════════════════
// REDISEÑO · FASE 2 — tipo de sistema y catálogo de actividades
// ═════════════════════════════════════════════════════════════
/**
 * El vocabulario del módulo y la preselección del checklist.
 *
 * Lo que esta fase tiene que sostener:
 *
 *  1. **Familia y tipo son DATOS**, en dos niveles, administrables por un
 *     `ADMIN_GLOBAL` y legibles por cualquiera. Un nombre repetido dentro de
 *     la misma familia choca; en otra familia, no.
 *  2. **El tipo de sistema es un campo de primera clase del EQUIPO**, no un
 *     campo configurable: se guarda, se lee y se corrige.
 *  3. **La preselección**: dar de alta un equipo estampa el checklist de su
 *     tipo, y `undefined` ≠ `[]`.
 *  4. **Renombrar el catálogo NO reescribe una visita ya hecha**, porque la
 *     actividad copió el nombre.
 */
async function catalogoActividades(db, tokenAdmin) {
  titulo('REDISEÑO FASE 2 · familias y tipos de sistema');

  const sup = await cuentaDePrueba(tokenAdmin, 'catsup', [{ modulo: 'FOTOS' }]);
  if (!sup) return;

  const familias = await api('GET', '/fotos/sistema', tokenAdmin);
  check(
    'las dos familias que nombró HVC vienen sembradas como datos',
    familias.estado === 200 &&
      ['Aire Acondicionado', 'Ventilación'].every((n) =>
        (familias.datos ?? []).some((f) => f.nombre === n),
      ),
    (familias.datos ?? []).map((f) => f.nombre).join(' · '),
  );

  const aire = (familias.datos ?? []).find(
    (f) => f.nombre === 'Aire Acondicionado',
  );
  const venti = (familias.datos ?? []).find((f) => f.nombre === 'Ventilación');
  if (!aire || !venti) return;

  check(
    'un supervisor las LEE — hacen falta para dar de alta un equipo',
    (await api('GET', '/fotos/sistema', sup.token)).estado === 200,
  );
  const creaSup = await api('POST', '/fotos/sistema/familia', sup.token, {
    nombre: `__verif_fam ${Date.now()}`,
  });
  check(
    'pero NO las configura: eso es de ADMIN_GLOBAL',
    creaSup.estado === 403,
    `HTTP ${creaSup.estado}`,
  );

  const sello = Date.now();
  const t1 = await api('POST', '/fotos/sistema/tipo', tokenAdmin, {
    familiaId: aire.id,
    nombre: `__verif_split ${sello}`,
    orden: 1,
  });
  check(
    'se crea un tipo dentro de una familia',
    t1.estado === 201 && t1.datos?.familiaId === aire.id,
    `HTTP ${t1.estado}`,
  );
  const tipoAire = t1.datos?.id;
  if (!tipoAire) return;

  const repetido = await api('POST', '/fotos/sistema/tipo', tokenAdmin, {
    familiaId: aire.id,
    nombre: `__verif_split ${sello}`,
  });
  check(
    'el mismo nombre en la MISMA familia se rechaza',
    repetido.estado === 409,
    `HTTP ${repetido.estado}`,
  );

  // ⚠️ La unicidad es del PAR, no del nombre: «Estándar» puede existir en
  // Aire Acondicionado y en Ventilación sin ser el mismo tipo.
  const enOtra = await api('POST', '/fotos/sistema/tipo', tokenAdmin, {
    familiaId: venti.id,
    nombre: `__verif_split ${sello}`,
  });
  check(
    '…pero el mismo nombre en OTRA familia sí entra',
    enOtra.estado === 201,
    `HTTP ${enOtra.estado}`,
  );
  const tipoVenti = enOtra.datos?.id;

  const familiaConTipos = await api(
    'DELETE',
    `/fotos/sistema/familia/${aire.id}`,
    tokenAdmin,
  );
  check(
    'una familia con tipos dentro no se borra: se ofrece retirarla',
    familiaConTipos.estado === 400 &&
      /Retírala/.test(familiaConTipos.datos?.message ?? ''),
    `HTTP ${familiaConTipos.estado}`,
  );

  titulo('REDISEÑO FASE 2 · el catálogo de actividades');

  const d1 = await api('POST', '/fotos/catalogo-actividad', tokenAdmin, {
    nombre: `__verif_filtros ${sello}`,
    descripcion: 'Limpieza y revisión del filtro',
    orden: 1,
    tiposSistema: [tipoAire],
  });
  const d2 = await api('POST', '/fotos/catalogo-actividad', tokenAdmin, {
    nombre: `__verif_presiones ${sello}`,
    orden: 2,
    tiposSistema: [tipoAire],
  });
  // Ésta NO es del tipo del equipo: sirve para probar que la preselección
  // acota de verdad y no trae el catálogo entero.
  const d3 = await api('POST', '/fotos/catalogo-actividad', tokenAdmin, {
    nombre: `__verif_aspas ${sello}`,
    orden: 3,
    tiposSistema: [tipoVenti],
  });
  check(
    'se crean tres definiciones, dos de un tipo y una de otro',
    [d1, d2, d3].every((d) => d.estado === 201),
    [d1, d2, d3].map((d) => d.estado).join(','),
  );
  const defs = [d1, d2, d3].map((d) => d.datos?.id).filter(Boolean);
  if (defs.length !== 3) return;

  check(
    'una definición devuelve sus tipos de sistema aplanados',
    (d1.datos?.tipos ?? []).length === 1 &&
      d1.datos.tipos[0].id === tipoAire &&
      d1.datos.tipos[0].familia?.nombre === 'Aire Acondicionado',
    JSON.stringify(d1.datos?.tipos ?? []),
  );

  const acotado = await api(
    'GET',
    `/fotos/catalogo-actividad?tipoSistema=${tipoAire}`,
    tokenAdmin,
  );
  const nombresAcotados = (acotado.datos ?? []).map((d) => d.nombre);
  check(
    'el catálogo se acota por tipo de sistema — es la preselección',
    acotado.estado === 200 &&
      nombresAcotados.includes(`__verif_filtros ${sello}`) &&
      nombresAcotados.includes(`__verif_presiones ${sello}`) &&
      !nombresAcotados.includes(`__verif_aspas ${sello}`),
    nombresAcotados.join(' · '),
  );

  const catSup = await api('GET', '/fotos/catalogo-actividad', sup.token);
  check(
    'un supervisor LEE el catálogo pero no lo configura',
    catSup.estado === 200 &&
      (await api('POST', '/fotos/catalogo-actividad', sup.token, { nombre: 'X' }))
        .estado === 403,
  );

  titulo('REDISEÑO FASE 2 · la preselección al dar de alta un equipo');

  const raiz = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `__verif_cat ${sello}`,
  });
  pendientesDeLimpiar.unshift(raiz.datos.id);

  // (a) Sin decir nada: se estampa la preselección del tipo.
  const eq1 = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Equipo con preselección',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
    tipoSistemaId: tipoAire,
  });
  if (eq1.estado !== 201) {
    check('equipo con tipo de sistema creado', false, `HTTP ${eq1.estado}`);
    return;
  }
  pendientesDeLimpiar.unshift(eq1.datos.id);

  const ciclo1 = await cicloAbiertoDe(eq1.datos.id, tokenAdmin);
  const acts1 = await api('GET', `/fotos/ciclo/${ciclo1}/actividad`, tokenAdmin);
  const titulos1 = (acts1.datos ?? []).map((a) => a.titulo);
  check(
    'el Ciclo 1 nace con el checklist del tipo de sistema, y solo con ése',
    titulos1.length === 2 &&
      titulos1.includes(`__verif_filtros ${sello}`) &&
      !titulos1.includes(`__verif_aspas ${sello}`),
    titulos1.join(' · '),
  );
  check(
    'y la descripción del catálogo viaja con la actividad',
    (acts1.datos ?? []).find((a) => a.titulo === `__verif_filtros ${sello}`)
      ?.descripcion === 'Limpieza y revisión del filtro',
  );

  const abierta = await api('GET', `/fotos/carpeta/${eq1.datos.id}`, tokenAdmin);
  check(
    'el tipo de sistema es un campo del equipo y vuelve con su familia',
    abierta.datos?.carpetaActual?.tipoSistema?.id === tipoAire &&
      abierta.datos.carpetaActual.tipoSistema.familia?.nombre ===
        'Aire Acondicionado',
    JSON.stringify(abierta.datos?.carpetaActual?.tipoSistema ?? null),
  );

  // (b) Lista vacía EXPLÍCITA: ninguna. No es lo mismo que omitirla.
  const eq2 = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Equipo sin checklist',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
    tipoSistemaId: tipoAire,
    actividades: [],
  });
  pendientesDeLimpiar.unshift(eq2.datos?.id);
  const ciclo2 = await cicloAbiertoDe(eq2.datos?.id, tokenAdmin);
  const acts2 = await api('GET', `/fotos/ciclo/${ciclo2}/actividad`, tokenAdmin);
  check(
    'con `actividades: []` no se estampa ninguna — desmarcarlas todas vale',
    (acts2.datos ?? []).length === 0,
    `${acts2.datos?.length} actividad(es)`,
  );

  // (c) Una elección concreta.
  const eq3 = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Equipo con una sola',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
    tipoSistemaId: tipoAire,
    actividades: [defs[1]],
  });
  pendientesDeLimpiar.unshift(eq3.datos?.id);
  const ciclo3 = await cicloAbiertoDe(eq3.datos?.id, tokenAdmin);
  const acts3 = await api('GET', `/fotos/ciclo/${ciclo3}/actividad`, tokenAdmin);
  check(
    'y con una lista concreta se estampa exactamente ésa',
    (acts3.datos ?? []).length === 1 &&
      acts3.datos[0].titulo === `__verif_presiones ${sello}`,
    (acts3.datos ?? []).map((a) => a.titulo).join(' · '),
  );

  const enCorriente = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Corriente con tipo',
    parentId: raiz.datos.id,
    tipoSistemaId: tipoAire,
  });
  check(
    'una carpeta corriente no admite tipo de sistema',
    enCorriente.estado === 400 && /Equipo/.test(enCorriente.datos?.message ?? ''),
    `HTTP ${enCorriente.estado}`,
  );

  titulo('REDISEÑO FASE 2 · traer el catálogo a un ciclo ya abierto');

  const traer = await api(
    'POST',
    `/fotos/ciclo/${ciclo2}/actividad/desde-catalogo`,
    tokenAdmin,
    { definiciones: [defs[0], defs[1]] },
  );
  check(
    'se añaden al ciclo abierto las que se eligen',
    (traer.estado === 200 || traer.estado === 201) && traer.datos?.anadidas === 2,
    `HTTP ${traer.estado} · ${JSON.stringify(traer.datos)}`,
  );

  const otraVez = await api(
    'POST',
    `/fotos/ciclo/${ciclo2}/actividad/desde-catalogo`,
    tokenAdmin,
    { definiciones: [defs[0], defs[1]] },
  );
  check(
    'y repetir no duplica: se saltan por título',
    otraVez.datos?.anadidas === 0 && otraVez.datos?.omitidas === 2,
    JSON.stringify(otraVez.datos),
  );

  // El candado del historial también manda aquí: el catálogo no es una
  // puerta trasera para escribir en una visita cerrada.
  await api('POST', `/fotos/ciclo/${ciclo3}/cerrar`, tokenAdmin);
  const enCerrado = await api(
    'POST',
    `/fotos/ciclo/${ciclo3}/actividad/desde-catalogo`,
    tokenAdmin,
    { definiciones: [defs[0]] },
  );
  check(
    'un ciclo cerrado NO admite traer actividades del catálogo',
    enCerrado.estado === 400 && /cerrado/.test(enCerrado.datos?.message ?? ''),
    `HTTP ${enCerrado.estado}`,
  );

  titulo('REDISEÑO FASE 2 · el catálogo propone, no reescribe el pasado');

  // ⚠️ La comprobación que justifica que la actividad COPIE el nombre en vez
  // de apuntar al catálogo con una FK.
  const renombrada = await api(
    'PATCH',
    `/fotos/catalogo-actividad/${defs[0]}`,
    tokenAdmin,
    { nombre: `__verif_filtros_v2 ${sello}` },
  );
  check(
    'se renombra una definición del catálogo',
    renombrada.estado === 200,
    `HTTP ${renombrada.estado}`,
  );
  const trasRenombrar = await api(
    'GET',
    `/fotos/ciclo/${ciclo1}/actividad`,
    tokenAdmin,
  );
  check(
    'la visita ya hecha CONSERVA el nombre con el que se recorrió',
    (trasRenombrar.datos ?? []).some(
      (a) => a.titulo === `__verif_filtros ${sello}`,
    ),
    (trasRenombrar.datos ?? []).map((a) => a.titulo).join(' · '),
  );

  // Cambiar el tipo de sistema del equipo tampoco toca sus visitas.
  const cambiaTipo = await api(
    'PATCH',
    `/fotos/carpeta/${eq1.datos.id}`,
    tokenAdmin,
    { tipoSistemaId: tipoVenti },
  );
  check(
    'el tipo de sistema de un equipo se corrige',
    cambiaTipo.estado === 200,
    `HTTP ${cambiaTipo.estado}`,
  );
  const trasCambio = await api(
    'GET',
    `/fotos/ciclo/${ciclo1}/actividad`,
    tokenAdmin,
  );
  check(
    '…y su checklist en curso NO se reescribe: sigue siendo el que había',
    (trasCambio.datos ?? []).length === 2,
    `${trasCambio.datos?.length} actividad(es)`,
  );

  const tipoEnUso = await api(
    'DELETE',
    `/fotos/sistema/tipo/${tipoVenti}`,
    tokenAdmin,
  );
  check(
    'un tipo con equipos detrás no se borra: se ofrece retirarlo',
    tipoEnUso.estado === 400 && /Retíralo/.test(tipoEnUso.datos?.message ?? ''),
    `HTTP ${tipoEnUso.estado} · ${tipoEnUso.datos?.message ?? ''}`,
  );

  // ⚠️ Retirado: no se puede volver a elegir, pero el equipo que lo tenía lo
  // conserva. `activo` retira del formulario, no reescribe lo capturado.
  await api('PATCH', `/fotos/sistema/tipo/${tipoAire}`, tokenAdmin, {
    activo: false,
  });
  const conRetirado = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Equipo con tipo retirado',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
    tipoSistemaId: tipoAire,
  });
  check(
    'un tipo RETIRADO ya no se puede asignar…',
    conRetirado.estado === 400 &&
      /retirado/.test(conRetirado.datos?.message ?? ''),
    `HTTP ${conRetirado.estado}`,
  );
  if (conRetirado.datos?.id) pendientesDeLimpiar.unshift(conRetirado.datos.id);
  const eq3Sigue = await api('GET', `/fotos/carpeta/${eq3.datos.id}`, tokenAdmin);
  check(
    '…pero el equipo que ya lo tenía lo conserva',
    eq3Sigue.datos?.carpetaActual?.tipoSistema?.id === tipoAire,
    JSON.stringify(eq3Sigue.datos?.carpetaActual?.tipoSistema ?? null),
  );

  // ⚠️ Al revés que un tipo o un estado, una DEFINICIÓN sí se borra aunque se
  // haya usado: nada apunta a ella, las actividades copiaron el nombre.
  const borrada = await api(
    'DELETE',
    `/fotos/catalogo-actividad/${defs[0]}`,
    tokenAdmin,
  );
  check(
    'una definición del catálogo SÍ se borra aunque se haya usado…',
    borrada.estado === 200,
    `HTTP ${borrada.estado}`,
  );
  const sobreviven = await api(
    'GET',
    `/fotos/ciclo/${ciclo1}/actividad`,
    tokenAdmin,
  );
  check(
    '…y las actividades que salieron de ella siguen ahí',
    (sobreviven.datos ?? []).length === 2,
    `${sobreviven.datos?.length} actividad(es)`,
  );

  // ── Limpieza ──
  //
  // ⚠️ Va aquí y no en `limpiar()`, que solo sabe de carpetas: los tipos de
  // sistema son `Restrict` desde los equipos, así que hay que borrar primero
  // los equipos —de más profundo a menos, como siempre— y solo después el
  // vocabulario. Sin esto, cada corrida dejaría tipos `__verif_*` colgando.
  await api('DELETE', `/fotos/catalogo-actividad/${defs[1]}`, tokenAdmin);
  await api('DELETE', `/fotos/catalogo-actividad/${defs[2]}`, tokenAdmin);
  for (const eq of [eq1, eq2, eq3])
    if (eq.datos?.id) await api('DELETE', `/fotos/carpeta/${eq.datos.id}`, tokenAdmin);
  if (enCorriente.datos?.id)
    await api('DELETE', `/fotos/carpeta/${enCorriente.datos.id}`, tokenAdmin);

  const tipoLibre = await api('DELETE', `/fotos/sistema/tipo/${tipoAire}`, tokenAdmin);
  check(
    'sin equipos detrás, el tipo de sistema SÍ se borra',
    tipoLibre.estado === 200,
    `HTTP ${tipoLibre.estado} · ${tipoLibre.datos?.message ?? ''}`,
  );
  await api('DELETE', `/fotos/sistema/tipo/${tipoVenti}`, tokenAdmin);
  await api('DELETE', `/usuario/${sup.id}`, tokenAdmin);
}

// ═════════════════════════════════════════════════════════════
// REDISEÑO · FASE 3 — evidencia fotográfica por actividad
// ═════════════════════════════════════════════════════════════
/**
 * Antes/después, una foto, o ninguna.
 *
 * Lo que esta fase tiene que sostener:
 *
 *  1. **La evidencia es una EXPECTATIVA, no un candado**: se puede completar
 *     una actividad sin su foto, y la señal se ve igual. Bloquear el check
 *     sería trabar el trabajo en obra, que es el fallo que el módulo evita
 *     en todas partes.
 *  2. **`faltaEvidencia` se DERIVA**, no se guarda: subir y borrar una foto
 *     lo mueven solo.
 *  3. **El momento solo existe donde tiene sentido**: lo exige una actividad
 *     ANTES_DESPUES, lo rechazan las demás, y el CHECK de la base impide que
 *     una foto de álbum lleve uno.
 *  4. **Se hereda entre ciclos y se copia del catálogo**, porque es parte del
 *     checklist y no del trabajo hecho.
 */
async function evidenciaActividades(db, tokenAdmin) {
  titulo('REDISEÑO FASE 3 · el CHECK y la migración');

  const chk = await db.query(
    `SELECT conname FROM pg_constraint WHERE conname = 'fotos_momento_solo_actividad_chk'`,
  );
  check(
    'el CHECK de «momento solo en foto de actividad» existe',
    chk.rows.length === 1,
    chk.rows[0]?.conname ?? 'no existe',
  );

  titulo('REDISEÑO FASE 3 · la evidencia se pide, se hereda y se copia');

  const sello = Date.now();
  const raiz = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `__verif_evi ${sello}`,
  });
  pendientesDeLimpiar.unshift(raiz.datos.id);

  const equipo = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Equipo con evidencia',
    parentId: raiz.datos.id,
    tipo: 'EQUIPO',
  });
  if (equipo.estado !== 201) {
    check('equipo creado', false, `HTTP ${equipo.estado}`);
    return;
  }
  pendientesDeLimpiar.unshift(equipo.datos.id);
  const equipoId = equipo.datos.id;
  const ciclo1 = await cicloAbiertoDe(equipoId, tokenAdmin);

  const aUna = await api('POST', `/fotos/ciclo/${ciclo1}/actividad`, tokenAdmin, {
    titulo: 'Medición de presiones',
  });
  check(
    'sin decir nada, una actividad pide UNA foto — el defecto razonable',
    aUna.datos?.evidencia === 'UNA' && aUna.datos?.faltaEvidencia === true,
    `evidencia=${aUna.datos?.evidencia} falta=${aUna.datos?.faltaEvidencia}`,
  );

  const aNinguna = await api(
    'POST',
    `/fotos/ciclo/${ciclo1}/actividad`,
    tokenAdmin,
    { titulo: 'Firma del acta', evidencia: 'NINGUNA' },
  );
  check(
    'NINGUNA no reclama nada',
    aNinguna.datos?.evidencia === 'NINGUNA' &&
      aNinguna.datos?.faltaEvidencia === false,
    `falta=${aNinguna.datos?.faltaEvidencia}`,
  );

  const aDos = await api('POST', `/fotos/ciclo/${ciclo1}/actividad`, tokenAdmin, {
    titulo: 'Limpieza de serpentín',
    evidencia: 'ANTES_DESPUES',
  });
  check(
    'ANTES_DESPUES nace reclamando las dos',
    aDos.datos?.evidencia === 'ANTES_DESPUES' &&
      aDos.datos?.tieneAntes === false &&
      aDos.datos?.tieneDespues === false &&
      aDos.datos?.faltaEvidencia === true,
    JSON.stringify({
      antes: aDos.datos?.tieneAntes,
      despues: aDos.datos?.tieneDespues,
    }),
  );

  const inventada = await api(
    'POST',
    `/fotos/ciclo/${ciclo1}/actividad`,
    tokenAdmin,
    { titulo: 'X', evidencia: 'VIDEO' },
  );
  check(
    'un tipo de evidencia inventado se rechaza con los valores permitidos',
    inventada.estado === 400 &&
      /ANTES_DESPUES/.test(inventada.datos?.message ?? ''),
    `HTTP ${inventada.estado}`,
  );

  const idUna = aUna.datos?.id;
  const idDos = aDos.datos?.id;
  if (!idUna || !idDos) return;

  titulo('REDISEÑO FASE 3 · el momento de cada foto');

  const img = await imagenDePrueba();

  const sinMomento = await subirFotos(
    `/fotos/actividad/${idDos}/foto`,
    tokenAdmin,
    [img],
  );
  check(
    'una actividad ANTES_DESPUES EXIGE decir cuál de los dos es',
    sinMomento.estado === 400 &&
      /cuál de los dos/.test(sinMomento.datos?.message ?? ''),
    `HTTP ${sinMomento.estado} · ${sinMomento.datos?.message ?? ''}`,
  );

  const conMomentoDeMas = await subirFotos(
    `/fotos/actividad/${idUna}/foto`,
    tokenAdmin,
    [img],
    { momento: 'ANTES' },
  );
  check(
    'y una de tipo UNA lo rechaza: no hay dos huecos que distinguir',
    conMomentoDeMas.estado === 400,
    `HTTP ${conMomentoDeMas.estado} · ${conMomentoDeMas.datos?.message ?? ''}`,
  );

  const momentoRaro = await subirFotos(
    `/fotos/actividad/${idDos}/foto`,
    tokenAdmin,
    [img],
    { momento: 'DURANTE' },
  );
  check(
    'un momento inventado se rechaza',
    momentoRaro.estado === 400 && /ANTES/.test(momentoRaro.datos?.message ?? ''),
    `HTTP ${momentoRaro.estado}`,
  );

  const antes = await subirFotos(
    `/fotos/actividad/${idDos}/foto`,
    tokenAdmin,
    [img],
    { momento: 'antes' },
  );
  check(
    'el antes entra (y el valor no distingue mayúsculas)',
    antes.estado === 201 && antes.datos?.subidas === 1,
    `HTTP ${antes.estado} · ${JSON.stringify(antes.datos?.fallidas ?? [])}`,
  );

  const trasAntes = await api(
    'GET',
    `/fotos/ciclo/${ciclo1}/actividad`,
    tokenAdmin,
  );
  const dosTrasAntes = (trasAntes.datos ?? []).find((a) => a.id === idDos);
  check(
    'con solo el antes, la actividad sigue diciendo que le falta algo',
    dosTrasAntes?.tieneAntes === true &&
      dosTrasAntes?.tieneDespues === false &&
      dosTrasAntes?.faltaEvidencia === true,
    JSON.stringify({
      antes: dosTrasAntes?.tieneAntes,
      despues: dosTrasAntes?.tieneDespues,
      falta: dosTrasAntes?.faltaEvidencia,
    }),
  );

  const despues = await subirFotos(
    `/fotos/actividad/${idDos}/foto`,
    tokenAdmin,
    [img],
    { momento: 'DESPUES' },
  );
  check('el después entra', despues.estado === 201);

  const completo = await api(
    'GET',
    `/fotos/ciclo/${ciclo1}/actividad`,
    tokenAdmin,
  );
  const dosCompleto = (completo.datos ?? []).find((a) => a.id === idDos);
  check(
    'con los dos huecos puestos, ya no falta evidencia',
    dosCompleto?.faltaEvidencia === false,
    `falta=${dosCompleto?.faltaEvidencia}`,
  );

  const fotosDeDos = await api('GET', `/fotos/actividad/${idDos}/foto`, tokenAdmin);
  check(
    'y cada foto dice en qué hueco está',
    (fotosDeDos.datos ?? []).length === 2 &&
      (fotosDeDos.datos ?? []).some((f) => f.momento === 'ANTES') &&
      (fotosDeDos.datos ?? []).some((f) => f.momento === 'DESPUES'),
    (fotosDeDos.datos ?? []).map((f) => f.momento).join(','),
  );

  // ⚠️ Se DERIVA: borrar el después vuelve a reclamarlo, sin que nadie
  // reescriba ninguna columna.
  const elDespues = (fotosDeDos.datos ?? []).find(
    (f) => f.momento === 'DESPUES',
  );
  await api('DELETE', `/fotos/foto/${elDespues.id}`, tokenAdmin);
  const trasBorrar = await api(
    'GET',
    `/fotos/ciclo/${ciclo1}/actividad`,
    tokenAdmin,
  );
  const dosTrasBorrar = (trasBorrar.datos ?? []).find((a) => a.id === idDos);
  check(
    'borrar el después lo vuelve a reclamar — la señal se deriva, no se guarda',
    dosTrasBorrar?.tieneDespues === false &&
      dosTrasBorrar?.faltaEvidencia === true,
    JSON.stringify({
      despues: dosTrasBorrar?.tieneDespues,
      falta: dosTrasBorrar?.faltaEvidencia,
    }),
  );

  titulo('REDISEÑO FASE 3 · el CHECK muerde por debajo del service');

  // Una foto SUELTA del ciclo con momento: no tiene actividad, así que el
  // service ni siquiera lo admite — y esto comprueba que la base tampoco lo
  // dejaría pasar por debajo.
  await subirFotos(`/fotos/ciclo/${ciclo1}/foto`, tokenAdmin, [img], {
    descripcion: `__verif_suelta_evi ${sello}`,
  });
  // La subida devuelve contadores, no ids: la foto se localiza por su ciclo.
  // Es una lectura, no una escritura suelta contra la base.
  const filaFoto = await db.query(
    'SELECT id FROM fotos WHERE "cicloId" = $1 LIMIT 1',
    [ciclo1],
  );
  const fotoSuelta = filaFoto.rows[0]?.id ?? null;
  check(
    'hay una foto suelta del ciclo con la que probar el CHECK',
    fotoSuelta !== null,
    `fotoId=${fotoSuelta}`,
  );
  if (fotoSuelta) {
    const mensaje = await debeFallar(
      db,
      `UPDATE fotos SET momento = 'ANTES' WHERE id = ${fotoSuelta}`,
    );
    check(
      'un `momento` en una foto sin actividad lo rechaza el CHECK',
      mensaje !== null && /fotos_momento_solo_actividad_chk/.test(mensaje),
      mensaje ? mensaje.split('\n')[0] : 'el UPDATE entró (no debía)',
    );
  }

  titulo('REDISEÑO FASE 3 · se pide, pero NO se impone');

  // ⚠️ La decisión de la fase: completar una actividad a la que le falta la
  // evidencia SE PERMITE. La señal se enseña; el trabajo no se detiene.
  const completar = await api(
    'POST',
    `/fotos/actividad/${idUna}/completar`,
    tokenAdmin,
  );
  check(
    'se completa una actividad SIN su foto — es expectativa, no candado',
    (completar.estado === 200 || completar.estado === 201) &&
      completar.datos?.estado === 'COMPLETADA',
    `HTTP ${completar.estado}`,
  );
  check(
    '…y sigue avisando de que la evidencia falta',
    completar.datos?.faltaEvidencia === true,
    `falta=${completar.datos?.faltaEvidencia}`,
  );

  titulo('REDISEÑO FASE 3 · se hereda al abrir la visita siguiente');

  await api('POST', `/fotos/ciclo/${ciclo1}/cerrar`, tokenAdmin);
  const ciclo2 = await api('POST', `/fotos/carpeta/${equipoId}/ciclo`, tokenAdmin);
  const heredadas = await api(
    'GET',
    `/fotos/ciclo/${ciclo2.datos?.id}/actividad`,
    tokenAdmin,
  );
  const h = heredadas.datos ?? [];
  check(
    'la evidencia viaja con el checklist: es qué fotografiar, no trabajo hecho',
    h.find((a) => a.titulo === 'Limpieza de serpentín')?.evidencia ===
      'ANTES_DESPUES' &&
      h.find((a) => a.titulo === 'Firma del acta')?.evidencia === 'NINGUNA',
    h.map((a) => `${a.titulo}=${a.evidencia}`).join(' · '),
  );
  check(
    'y las heredadas nacen SIN fotos, reclamando lo suyo otra vez',
    h.find((a) => a.titulo === 'Limpieza de serpentín')?.faltaEvidencia === true,
  );

  titulo('REDISEÑO FASE 3 · el catálogo también la propone');

  const def = await api('POST', '/fotos/catalogo-actividad', tokenAdmin, {
    nombre: `__verif_evi_cat ${sello}`,
    evidencia: 'ANTES_DESPUES',
  });
  check(
    'una definición de catálogo lleva su tipo de evidencia',
    def.estado === 201 && def.datos?.evidencia === 'ANTES_DESPUES',
    `HTTP ${def.estado} · ${def.datos?.evidencia}`,
  );

  const traida = await api(
    'POST',
    `/fotos/ciclo/${ciclo2.datos?.id}/actividad/desde-catalogo`,
    tokenAdmin,
    { definiciones: [def.datos?.id] },
  );
  check('se trae al ciclo', traida.datos?.anadidas === 1);

  const conCatalogo = await api(
    'GET',
    `/fotos/ciclo/${ciclo2.datos?.id}/actividad`,
    tokenAdmin,
  );
  check(
    'y la actividad nace con la evidencia que proponía el catálogo',
    (conCatalogo.datos ?? []).find(
      (a) => a.titulo === `__verif_evi_cat ${sello}`,
    )?.evidencia === 'ANTES_DESPUES',
  );

  // ⚠️ Y cambiarla en el catálogo no reescribe la que ya se estampó, igual
  // que pasa con el nombre.
  await api('PATCH', `/fotos/catalogo-actividad/${def.datos?.id}`, tokenAdmin, {
    evidencia: 'NINGUNA',
  });
  const trasCambio = await api(
    'GET',
    `/fotos/ciclo/${ciclo2.datos?.id}/actividad`,
    tokenAdmin,
  );
  check(
    'cambiarla en el catálogo NO reescribe la actividad ya creada',
    (trasCambio.datos ?? []).find(
      (a) => a.titulo === `__verif_evi_cat ${sello}`,
    )?.evidencia === 'ANTES_DESPUES',
  );

  // Limpieza propia.
  await api('DELETE', `/fotos/catalogo-actividad/${def.datos?.id}`, tokenAdmin);
}

async function regresion(token) {
  titulo('REGRESIÓN · Costos, Equipos y Auth siguen respondiendo');
  const rutas = [
    ['/costos/admin/catalogo?tipo=UNIDAD_MEDIDA', 'Costos · catálogos'],
    ['/costos/proveedor', 'Costos · proveedores'],
    ['/costos/requerimiento?grupo=mios', 'Costos · requerimientos'],
    ['/equipos/organizacion', 'Equipos · organizaciones'],
    ['/usuario', 'Auth · usuarios'],
  ];
  for (const [ruta, nombre] of rutas) {
    const r = await api('GET', ruta, token);
    check(`${nombre} responde`, r.estado === 200, `HTTP ${r.estado}`);
  }
}

/** Borra lo que creó la corrida. Las hijas primero: las FK son Restrict. */
async function limpiar(token) {
  for (const id of pendientesDeLimpiar)
    await api('DELETE', `/fotos/carpeta/${id}`, token);
}

(async () => {
  const soloFase = (() => {
    const i = process.argv.indexOf('--fase');
    return i === -1 ? null : Number(process.argv[i + 1]);
  })();

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const token = await entrar(
    process.env.SUPERADMIN_EMAIL,
    process.env.SUPERADMIN_PASSWORD,
  );
  if (!token) {
    console.error(
      `No se pudo entrar como SuperAdmin en ${API}. ¿Está el backend levantado?`,
    );
    await db.end();
    process.exit(1);
  }

  try {
    if (soloFase === null || soloFase === 1) await fase1(db, token);
    if (soloFase === null || soloFase === 2) await fase2(db, token);
    if (soloFase === null || soloFase === 3) await fase3(db, token);
    if (soloFase === null || soloFase === 4) await fase4(db, token);
    if (soloFase === null || soloFase === 5) await fase5(db, token);
    if (soloFase === null || soloFase === 6) await fase6(db, token);
    if (soloFase === null || soloFase === 7) await fase7(db, token);
    if (soloFase === null || soloFase === 8) await fase8(db, token);
    if (soloFase === null || soloFase === 9) await fase9(db, token);
    if (soloFase === null || soloFase === 10) await fase10(db, token);
    if (soloFase === null || soloFase === 11) await ciclos(db, token);
    if (soloFase === null || soloFase === 12) await catalogoActividades(db, token);
    if (soloFase === null || soloFase === 13) await evidenciaActividades(db, token);
    if (soloFase === null) await regresion(token);
  } finally {
    await limpiar(token);
    await db.end();
  }

  console.log(`\n═══ ${ok} ok, ${fallos} fallos ═══`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
