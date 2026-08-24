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
 *   node scripts/verificar-fotos.cjs            # todas las fases hechas
 *   node scripts/verificar-fotos.cjs --fase 2   # solo una
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
async function fase1(db, token) {
  titulo('FASE 1 · estructura en la base');

  const tablasEsperadas = [
    'carpetas_fotos',
    'albumes_fotos',
    'tareas_fotos',
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
    `INSERT INTO fotos ("albumId","tareaId","subidaPorId","claveImagen","claveMiniatura",
                        "anchoPx","altoPx",bytes,"bytesOriginal",formato)
     VALUES (1,1,1,'a','b',1,1,1,1,'webp')`,
  );
  check(
    'foto colgando de álbum Y tarea a la vez se rechaza',
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
  check(
    'la tarjeta cuenta `albumes`, no `lotes`',
    Boolean(tarjeta) && 'albumes' in tarjeta && !('lotes' in tarjeta),
    tarjeta ? Object.keys(tarjeta).join(',') : 'sin tarjeta',
  );
  check('la tarjeta ya no trae `estado`', Boolean(tarjeta) && !('estado' in tarjeta));
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
  const visible = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Visible',
    parentId: obra.datos.id,
  });
  const oculta = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Oculta',
    parentId: obra.datos.id,
  });
  pendientesDeLimpiar.unshift(visible.datos.id, oculta.datos.id, obra.datos.id);

  // Álbumes y fotos por SQL: contar no necesita subir nada a R2.
  const sembrarFotos = async (carpetaId, cuantas) => {
    const album = await db.query(
      `INSERT INTO albumes_fotos ("carpetaId","creadoPorId","actualizadoEn")
       VALUES ($1,$2,NOW()) RETURNING id`,
      [carpetaId, 1],
    );
    for (let i = 0; i < cuantas; i++)
      await db.query(
        `INSERT INTO fotos ("albumId","subidaPorId","claveImagen","claveMiniatura",
                            "anchoPx","altoPx",bytes,"bytesOriginal",formato)
         VALUES ($1,$2,$3,$4,10,10,10,10,'webp')`,
        [album.rows[0].id, 1, `__v/${carpetaId}/${i}`, `__v/${carpetaId}/t${i}`],
      );
    return album.rows[0].id;
  };
  const albumVisible = await sembrarFotos(visible.datos.id, 2);
  const albumOculta = await sembrarFotos(oculta.datos.id, 3);

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
    `fotos=${paraAdmin?.fotos} albumes=${paraAdmin?.albumes} subcarpetas=${paraAdmin?.subcarpetas}`,
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
    'y solo 1 álbum, no 2',
    paraSupervisor?.albumes === 1,
    `albumes=${paraSupervisor?.albumes}`,
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
  await db.query('DELETE FROM fotos WHERE "albumId" = ANY($1)', [
    [albumVisible, albumOculta],
  ]);
  await db.query('DELETE FROM albumes_fotos WHERE id = ANY($1)', [
    [albumVisible, albumOculta],
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
    const galeria = await api(
      'GET',
      `/fotos/carpeta/${equipoId}/album`,
      tokenAdmin,
    );
    check(
      'la imagen de un campo NO aparece en la galería: no es evidencia',
      galeria.estado === 200 && (galeria.datos?.albumes ?? []).length === 0,
      `${(galeria.datos?.albumes ?? []).length} álbum(es)`,
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

  // Una carpeta CORRIENTE y una de EQUIPO: §13 solo admite tareas en la
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

  titulo('FASE 5 · las tareas viven dentro de un EQUIPO (§13)');

  const enCorriente = await api(
    'POST',
    `/fotos/carpeta/${corriente.datos.id}/tarea`,
    tokenAdmin,
    { titulo: 'No debería poder' },
  );
  check(
    'una carpeta corriente NO admite tareas — es la lectura estricta de §13',
    enCorriente.estado === 400 && /no lo es/.test(enCorriente.datos?.message ?? ''),
    `HTTP ${enCorriente.estado} · ${enCorriente.datos?.message ?? ''}`,
  );

  const sinTitulo = await api('POST', `/fotos/carpeta/${equipoId}/tarea`, tokenAdmin, {
    descripcion: 'sin título',
  });
  check(
    'una tarea sin título se rechaza',
    sinTitulo.estado === 400,
    `HTTP ${sinTitulo.estado}`,
  );

  const estadoRaro = await api('POST', `/fotos/carpeta/${equipoId}/tarea`, tokenAdmin, {
    titulo: 'X',
    estado: 'CASI',
  });
  check(
    'un estado inventado se rechaza con los valores permitidos',
    estadoRaro.estado === 400 && /PENDIENTE/.test(estadoRaro.datos?.message ?? ''),
    `HTTP ${estadoRaro.estado}`,
  );

  const tarea = await api('POST', `/fotos/carpeta/${equipoId}/tarea`, tokenAdmin, {
    titulo: 'Revisar estado estructural',
    descripcion: 'Chasis y anclajes',
    prioridad: 'ALTA',
    fecha: '2026-08-18',
    responsableId: editorG.id,
  });
  check(
    'se crea una tarea con responsable, prioridad y fecha',
    tarea.estado === 201 &&
      tarea.datos?.estado === 'PENDIENTE' &&
      tarea.datos?.responsable?.id === editorG.id,
    `HTTP ${tarea.estado} · estado=${tarea.datos?.estado} prioridad=${tarea.datos?.prioridad}`,
  );
  const tareaId = tarea.datos?.id;
  if (!tareaId) return;

  check(
    'nace sin marca de completada',
    tarea.datos.completadaEn === null && tarea.datos.completadaPor === null,
    `completadaEn=${tarea.datos.completadaEn}`,
  );

  titulo('FASE 5 · el check rápido de §13');

  const completada = await api('POST', `/fotos/tarea/${tareaId}/completar`, tokenAdmin);
  check(
    'completar registra fecha/hora Y quién la completó (§13)',
    completada.estado === 201 &&
      completada.datos?.estado === 'COMPLETADA' &&
      !!completada.datos?.completadaEn &&
      !!completada.datos?.completadaPor?.id,
    `estado=${completada.datos?.estado} por=${completada.datos?.completadaPor?.nombre}`,
  );

  const reabierta = await api('POST', `/fotos/tarea/${tareaId}/reabrir`, tokenAdmin);
  check(
    'reabrir vuelve a PENDIENTE y BORRA la marca — no deja un dato que ya no es cierto',
    reabierta.datos?.estado === 'PENDIENTE' &&
      reabierta.datos?.completadaEn === null &&
      reabierta.datos?.completadaPor === null,
    `estado=${reabierta.datos?.estado} completadaEn=${reabierta.datos?.completadaEn}`,
  );

  // La misma marca por el camino del PATCH: si sólo la escribiera la ruta
  // del check, editar el estado a mano dejaría una completada sin firma.
  const porPatch = await api('PATCH', `/fotos/tarea/${tareaId}`, tokenAdmin, {
    estado: 'COMPLETADA',
  });
  check(
    'y el PATCH de estado escribe la misma marca, no solo la ruta del check',
    porPatch.datos?.completadaEn && porPatch.datos?.completadaPor?.id,
    `completadaPor=${porPatch.datos?.completadaPor?.nombre ?? '(nadie)'}`,
  );
  await api('POST', `/fotos/tarea/${tareaId}/reabrir`, tokenAdmin);

  titulo('FASE 5 · editar una tarea no pisa lo que no llega');

  await api('PATCH', `/fotos/tarea/${tareaId}`, tokenAdmin, {
    estado: 'EN_PROCESO',
  });
  const tras = await api('GET', `/fotos/tarea/${tareaId}`, tokenAdmin);
  check(
    'mandar solo {estado} conserva descripción, prioridad y responsable',
    tras.datos?.descripcion === 'Chasis y anclajes' &&
      tras.datos?.prioridad === 'ALTA' &&
      tras.datos?.responsable?.id === editorG.id,
    `descripcion=${tras.datos?.descripcion} prioridad=${tras.datos?.prioridad}`,
  );

  titulo('FASE 5 · permisos de tareas (§5, todo por AccesoService)');

  const verLector = await api('GET', `/fotos/carpeta/${equipoId}/tarea`, lectorG.token);
  check(
    'LECTURA_GLOBAL ve las tareas',
    verLector.estado === 200 && (verLector.datos ?? []).length > 0,
    `HTTP ${verLector.estado} · ${verLector.datos?.length ?? '?'} tareas`,
  );

  const crearLector = await api('POST', `/fotos/carpeta/${equipoId}/tarea`, lectorG.token, {
    titulo: 'No debería',
  });
  check(
    'pero NO crea: escribir es EDICION',
    crearLector.estado === 403,
    `HTTP ${crearLector.estado}`,
  );

  const completarLector = await api(
    'POST',
    `/fotos/tarea/${tareaId}/completar`,
    lectorG.token,
  );
  check(
    'ni completa — el check rápido también es escritura',
    completarLector.estado === 403,
    `HTTP ${completarLector.estado}`,
  );

  const verAjeno = await api('GET', `/fotos/carpeta/${equipoId}/tarea`, ajeno.token);
  check(
    'quien no ve la carpeta recibe 404, no 403: no se le confirma que exista',
    verAjeno.estado === 404,
    `HTTP ${verAjeno.estado}`,
  );

  const tareaAjeno = await api('GET', `/fotos/tarea/${tareaId}`, ajeno.token);
  check(
    'y tampoco por el id de la tarea',
    tareaAjeno.estado === 404,
    `HTTP ${tareaAjeno.estado}`,
  );

  titulo('FASE 5 · comentarios en las cuatro entidades (§14)');

  // El álbum se siembra por SQL a propósito: hoy `POST carpeta/:id/album` es
  // la SUBIDA de fotos (multipart), y el alta de un álbum con nombre la
  // construye la Fase 6. Lo que se verifica aquí es el COMENTARIO sobre un
  // álbum, que es lo que §14 exige y ya está implementado — sembrarlo por la
  // API obligaría a subir un archivo real para probar otra cosa.
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
    ['tarea', tareaId, 'una tarea'],
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

  const vacio = await api('POST', `/fotos/comentario/tarea/${tareaId}`, tokenAdmin, {
    texto: '   ',
  });
  check(
    'un comentario vacío se rechaza',
    vacio.estado === 400,
    `HTTP ${vacio.estado}`,
  );

  // El CHECK de la BD sigue en pie por debajo del service.
  const dueños = await db.query(
    `SELECT ("carpetaId" IS NOT NULL)::int + ("tareaId" IS NOT NULL)::int
          + ("albumId" IS NOT NULL)::int + ("fotoId" IS NOT NULL)::int AS n
       FROM comentarios_fotos`,
  );
  check(
    'todo comentario guardado tiene EXACTAMENTE un dueño',
    dueños.rows.every((r) => r.n === 1),
    `${dueños.rows.length} filas revisadas`,
  );

  titulo('FASE 5 · leer, editar y borrar comentarios');

  const lista = await api('GET', `/fotos/comentario/tarea/${tareaId}`, tokenAdmin);
  check(
    'los comentarios de una tarea se listan en orden de conversación',
    lista.estado === 200 && (lista.datos ?? []).length > 0,
    `HTTP ${lista.estado} · ${lista.datos?.length ?? '?'} comentarios`,
  );
  check(
    'y llegan sin editar: `editadoEn` en null distingue «nunca tocado» (§14)',
    (lista.datos ?? []).every((c) => c.editadoEn === null),
    `editadoEn=${lista.datos?.[0]?.editadoEn}`,
  );

  const mio = creados.find((c) => c.entidad === 'tarea');
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
    `/fotos/comentario/tarea/${tareaId}`,
    lectorG.token,
    { texto: 'Desde lectura' },
  );
  check(
    'LECTURA_GLOBAL ve los comentarios pero no escribe: §14 le concede visualizar',
    lectorComenta.estado === 403,
    `HTTP ${lectorComenta.estado}`,
  );

  const lectorLee = await api('GET', `/fotos/comentario/tarea/${tareaId}`, lectorG.token);
  check(
    'y leerlos sí puede',
    lectorLee.estado === 200,
    `HTTP ${lectorLee.estado} · ${lectorLee.datos?.length ?? '?'} comentarios`,
  );

  const propioDelEditor = await api(
    'POST',
    `/fotos/comentario/tarea/${tareaId}`,
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

  const enArchivada = await api('POST', `/fotos/carpeta/${equipoId}/tarea`, tokenAdmin, {
    titulo: 'En rama cerrada',
  });
  check(
    'no se crean tareas en una rama archivada, ni siendo SuperAdmin',
    enArchivada.estado === 403 && /archivada/.test(enArchivada.datos?.message ?? ''),
    `HTTP ${enArchivada.estado}`,
  );

  const comentaArchivada = await api(
    'POST',
    `/fotos/comentario/tarea/${tareaId}`,
    tokenAdmin,
    { texto: 'En rama cerrada' },
  );
  check(
    'ni se comenta',
    comentaArchivada.estado === 403,
    `HTTP ${comentaArchivada.estado}`,
  );

  const leeArchivada = await api('GET', `/fotos/carpeta/${equipoId}/tarea`, tokenAdmin);
  check(
    'pero leer sigue funcionando: archivada es de SOLO LECTURA, no invisible',
    leeArchivada.estado === 200,
    `HTTP ${leeArchivada.estado}`,
  );

  await api('POST', `/fotos/carpeta/${raiz.datos.id}/reabrir`, tokenAdmin);

  titulo('FASE 5 · borrar una tarea');

  const conComentarios = await api('DELETE', `/fotos/tarea/${tareaId}`, tokenAdmin);
  check(
    'borrar una tarea se lleva sus comentarios (Cascade), no falla por ellos',
    conComentarios.estado === 200,
    `HTTP ${conComentarios.estado}`,
  );

  const huerfanos = await db.query(
    'SELECT count(*)::int n FROM comentarios_fotos WHERE "tareaId" = $1',
    [tareaId],
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

  titulo('FASE 6 · álbum con nombre (§16)');

  const sinNombre = await api(
    'POST',
    `/fotos/album/carpeta/${carpetaId}`,
    tokenAdmin,
    {},
  );
  check(
    'crear un álbum sin nombre por esta puerta se rechaza',
    sinNombre.estado === 400,
    `HTTP ${sinNombre.estado} · ${sinNombre.datos?.message ?? ''}`,
  );

  const album = await api(
    'POST',
    `/fotos/album/carpeta/${carpetaId}`,
    tokenAdmin,
    {
      nombre: 'Estado inicial',
      descripcion: 'Antes de intervenir',
      fecha: '2026-08-18',
    },
  );
  check(
    'se crea el álbum de §16 («Equipo ABC → Álbum Estado inicial»)',
    album.estado === 201 && album.datos?.nombre === 'Estado inicial',
    `HTTP ${album.estado} · nombre=${album.datos?.nombre} fecha=${String(album.datos?.fecha).slice(0, 10)}`,
  );
  const albumId = album.datos?.id;
  if (!albumId) return;

  check(
    'nace vacío y sin comentarios',
    album.datos._count.fotos === 0 && album.datos._count.comentarios === 0,
    JSON.stringify(album.datos._count),
  );

  const renombrado = await api('PATCH', `/fotos/album/${albumId}`, tokenAdmin, {
    nombre: 'Estado inicial (rev. B)',
  });
  check(
    'se renombra sin tocar lo que no llega',
    renombrado.datos?.nombre === 'Estado inicial (rev. B)' &&
      renombrado.datos?.descripcion === 'Antes de intervenir',
    `nombre=${renombrado.datos?.nombre} descripcion=${renombrado.datos?.descripcion}`,
  );

  if (!r2Configurado) {
    await api('DELETE', `/usuario/${otro.id}`, tokenAdmin);
    return;
  }

  titulo('FASE 6 · subir a los cuatro destinos');

  const img = await imagenDePrueba();

  const aAlbum = await subirFotos(`/fotos/album/${albumId}/foto`, tokenAdmin, [
    img,
    img,
  ]);
  check(
    'se suben fotos a un álbum que YA existe (§16)',
    aAlbum.estado === 201 && aAlbum.datos?.subidas === 2,
    `HTTP ${aAlbum.estado} · ${aAlbum.datos?.subidas ?? '?'} subidas`,
  );
  check(
    'y NO crea un álbum nuevo: caen en el que se le indicó',
    aAlbum.datos?.albumId === albumId,
    `albumId=${aAlbum.datos?.albumId} (esperado ${albumId})`,
  );

  // Una carpeta de tipo EQUIPO para poder tener tarea. Desde la Fase 1a no
  // hace falta ningún equipo del catálogo: basta el `tipo`.
  let tareaId = null;
  const carpetaEquipo = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Equipo para fotos de tarea',
    parentId: carpetaId,
    tipo: 'EQUIPO',
  });
  if (carpetaEquipo.datos?.id) {
    pendientesDeLimpiar.unshift(carpetaEquipo.datos.id);
    const tarea = await api(
      'POST',
      `/fotos/carpeta/${carpetaEquipo.datos.id}/tarea`,
      tokenAdmin,
      { titulo: 'Inspección' },
    );
    tareaId = tarea.datos?.id ?? null;
  }

  if (tareaId) {
    const aTarea = await subirFotos(`/fotos/tarea/${tareaId}/foto`, tokenAdmin, [
      img,
    ]);
    check(
      'se suben fotos a una TAREA (§15: «tarea relacionada»)',
      aTarea.estado === 201 && aTarea.datos?.tareaId === tareaId,
      `HTTP ${aTarea.estado} · tareaId=${aTarea.datos?.tareaId}`,
    );
    check(
      'y esas no cuelgan de ningún álbum',
      aTarea.datos?.albumId === null,
      `albumId=${aTarea.datos?.albumId}`,
    );

    // ── Borrar UNA foto de la tarea (puerta abierta en la Fase 2a) ──
    //
    // El endpoint es el mismo `DELETE /fotos/foto/:id` de siempre —
    // `exigirSobreFoto` resuelve los tres casos y el de tarea es uno—, pero
    // hasta la Fase 2a ninguna pantalla lo llamaba para éstas: la única
    // salida era borrar la tarea entera, que además el backend rechaza si
    // tiene fotos. Se comprueba aquí que la puerta lleva a alguna parte.
    const antesDeBorrar = await api('GET', `/fotos/tarea/${tareaId}/foto`, tokenAdmin);
    const fotoDeTarea = (antesDeBorrar.datos ?? [])[0];

    const conFotos = await api('DELETE', `/fotos/tarea/${tareaId}`, tokenAdmin);
    check(
      'una tarea CON fotos no se borra: la evidencia no se va por delante',
      conFotos.estado === 400,
      `HTTP ${conFotos.estado}`,
    );

    // La subió el SuperAdmin, así que para `otro` —un ADMIN_GLOBAL— es
    // AJENA, y §5 pide TOTAL para ésas. Su nivel se lo da sobre todo el
    // árbol, así que debe poder: es la mitad de la regla que el botón de
    // la rejilla hace cumplir en la pantalla.
    const borradaDeTarea = await api(
      'DELETE',
      `/fotos/foto/${fotoDeTarea?.id}`,
      otro.token,
    );
    const despues = await api('GET', `/fotos/tarea/${tareaId}/foto`, tokenAdmin);
    check(
      'se borra UNA foto de la tarea sin tocar la tarea (ajena, con TOTAL)',
      borradaDeTarea.estado === 200 && (despues.datos ?? []).length === 0,
      `HTTP ${borradaDeTarea.estado} · quedan ${(despues.datos ?? []).length}`,
    );

    // ⚠️ Y la tarea NO desaparece al quedarse sin fotos: al revés que un
    // álbum, que hoy sí se retira solo (eso lo cambia la Fase 2b).
    const sigueViva = await api('GET', `/fotos/tarea/${tareaId}`, tokenAdmin);
    check(
      'la tarea sigue existiendo aunque se quede sin fotos',
      sigueViva.estado === 200,
      `HTTP ${sigueViva.estado}`,
    );

    const yaVacia = await api('DELETE', `/fotos/tarea/${tareaId}`, tokenAdmin);
    check(
      'y ya vacía sí se puede borrar',
      yaVacia.estado === 200,
      `HTTP ${yaVacia.estado}`,
    );
    tareaId = null;
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
      sinAsignar.datos?.albumId === null &&
      sinAsignar.datos?.tareaId === null,
    `HTTP ${sinAsignar.estado} · subidas=${sinAsignar.datos?.subidas} album=${sinAsignar.datos?.albumId} tarea=${sinAsignar.datos?.tareaId}`,
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

  const fotoDeAlbum = (
    await api('GET', `/fotos/carpeta/${carpetaId}/album`, tokenAdmin)
  ).datos?.albumes?.[0]?.fotos?.[0];
  if (fotoDeAlbum) {
    const comentarioClasificada = await api(
      'POST',
      `/fotos/comentario/foto/${fotoDeAlbum.id}`,
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
    sinDestino.estado === 400 && /tarea, un álbum o una carpeta/.test(sinDestino.datos?.message ?? ''),
    `HTTP ${sinDestino.estado}`,
  );

  const lote = await api('POST', '/fotos/bandeja/clasificar', tokenAdmin, {
    fotoIds: idsBandeja.slice(0, 2),
    albumId,
  });
  check(
    'un lote se mueve de la bandeja a un álbum de una vez',
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
    albumId,
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
    { fotoIds: idsBandeja, albumId },
  );
  check(
    'nadie clasifica la bandeja de otro, ni un ADMIN_GLOBAL',
    ajenoClasifica.estado === 400,
    `HTTP ${ajenoClasifica.estado}`,
  );

  titulo('FASE 6 · lo de v2 que NO debía romperse');

  const galeria = await api(
    'GET',
    `/fotos/carpeta/${carpetaId}/album`,
    tokenAdmin,
  );
  check(
    'la galería paginada por álbum sigue respondiendo',
    galeria.estado === 200 && Array.isArray(galeria.datos?.albumes),
    `HTTP ${galeria.estado} · ${galeria.datos?.albumes?.length ?? '?'} álbumes`,
  );
  check(
    'y las fotos llegan con URL firmada y ya procesadas a WebP',
    (galeria.datos?.albumes ?? []).some((a) =>
      (a.fotos ?? []).some((f) => f.url?.includes('X-Amz-Signature')),
    ),
    'firma presente en la URL',
  );

  const unaFoto = (galeria.datos?.albumes ?? [])
    .flatMap((a) => a.fotos ?? [])
    .find(Boolean);
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
  await db.query('DELETE FROM fotos WHERE "albumId" IN (SELECT id FROM albumes_fotos WHERE "carpetaId" = $1)', [carpetaId]);
  await db.query('DELETE FROM fotos WHERE "subidaPorId" = (SELECT id FROM usuarios WHERE rol = \'SUPERADMIN\' LIMIT 1) AND "albumId" IS NULL AND "tareaId" IS NULL');
  await db.query('DELETE FROM comentarios_fotos WHERE "albumId" IN (SELECT id FROM albumes_fotos WHERE "carpetaId" = $1)', [carpetaId]);
  await db.query('DELETE FROM albumes_fotos WHERE "carpetaId" = $1', [carpetaId]);
  if (tareaId) {
    await db.query('DELETE FROM fotos WHERE "tareaId" = $1', [tareaId]);
    await db.query('DELETE FROM comentarios_fotos WHERE "tareaId" = $1', [tareaId]);
    await db.query('DELETE FROM tareas_fotos WHERE id = $1', [tareaId]);
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

  // Tareas: hace falta una carpeta de tipo EQUIPO. Desde la Fase 1a no hay
  // que sembrar nada en el catálogo de Gestión de Equipos.
  const ce = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: 'Equipo para bitácora',
    parentId: destino,
    tipo: 'EQUIPO',
  });
  const equipoCarpetaId = ce.datos?.id ?? null;
  if (equipoCarpetaId) pendientesDeLimpiar.unshift(equipoCarpetaId);

  let tareaId = null;
  if (equipoCarpetaId) {
    const t = await api(
      'POST',
      `/fotos/carpeta/${equipoCarpetaId}/tarea`,
      tokenAdmin,
      { titulo: 'Revisar pernos' },
    );
    tareaId = t.datos?.id ?? null;

    const creacionT = await eventosDe('CREACION');
    check(
      '§23.3 crear tarea queda registrado',
      creacionT.some((e) => e.entidad === 'TAREA' && e.entidadId === tareaId),
      `${creacionT.filter((e) => e.entidad === 'TAREA').length} de tarea`,
    );

    await api('POST', `/fotos/tarea/${tareaId}/completar`, tokenAdmin);
    const completadas = await eventosDe('TAREA_COMPLETADA');
    check(
      '§23.4 completar tarea queda registrado — la que HVC quiere poder auditar',
      completadas.some((e) => e.entidadId === tareaId),
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
  const plantilla = await api('POST', '/fotos/plantilla', tokenAdmin, {
    nombre: 'Inspección de Equipo',
    descripcion: 'El guion estándar de HVC',
    nodos: [
      { tipo: 'TAREA', nombre: 'Estado general' },
      { tipo: 'TAREA', nombre: 'Pernos' },
      { tipo: 'TAREA', nombre: 'Soldaduras' },
      { tipo: 'TAREA', nombre: 'Estructura' },
      { tipo: 'ALBUM', nombre: 'Evidencia fotográfica' },
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
      { tipo: 'TAREA', nombre: 'No puede', hijos: [{ tipo: 'ALBUM', nombre: 'X' }] },
    ],
  });
  check(
    'una TAREA no puede contener elementos: se rechaza al guardar, no al aplicar',
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
      'se estampa sobre un EQUIPO: 4 tareas y 1 álbum',
      aplicada.estado === 201 &&
        aplicada.datos?.tareas === 4 &&
        aplicada.datos?.albumes === 1,
      `HTTP ${aplicada.estado} · tareas=${aplicada.datos?.tareas} álbumes=${aplicada.datos?.albumes}`,
    );

    const desdePlantilla = await eventosDe('CREACION_DESDE_PLANTILLA');
    check(
      'y queda en la bitácora qué plantilla y cuánto creó',
      desdePlantilla.some((e) => /Inspección de Equipo/.test(e.descripcion ?? '')),
      desdePlantilla[0]?.descripcion ?? '(ninguno)',
    );
  }

  // Sobre una carpeta CORRIENTE las tareas no caben (§13).
  const enCorriente = await api(
    'POST',
    `/fotos/plantilla/${plantillaId}/aplicar/${subId}`,
    tokenAdmin,
  );
  check(
    'sobre una carpeta corriente las tareas se OMITEN, no se cuelan saltándose §13',
    enCorriente.datos?.tareas === 0 && enCorriente.datos?.omitidas?.tareas === 4,
    `tareas=${enCorriente.datos?.tareas} omitidas=${enCorriente.datos?.omitidas?.tareas}`,
  );
  check(
    'y se avisa del motivo en vez de callarlo',
    /solo se pueden crear dentro de una carpeta de equipo/i.test(
      enCorriente.datos?.aviso ?? '',
    ),
    enCorriente.datos?.aviso ?? '(sin aviso)',
  );
  check(
    'pero el álbum sí se crea: lo que cabe, entra',
    enCorriente.datos?.albumes === 1,
    `álbumes=${enCorriente.datos?.albumes}`,
  );

  // Editar la plantilla NO toca lo ya creado — el punto de no versionar.
  const antesDeEditar = await api(
    'GET',
    `/fotos/carpeta/${equipoCarpetaId ?? subId}/tarea`,
    tokenAdmin,
  );
  await api('PATCH', `/fotos/plantilla/${plantillaId}`, tokenAdmin, {
    nodos: [{ tipo: 'TAREA', nombre: 'Solo esta' }],
  });
  const despuesDeEditar = await api(
    'GET',
    `/fotos/carpeta/${equipoCarpetaId ?? subId}/tarea`,
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
    ['Proyecto A', 'Frente 1', 'Equipo 01', 'Tarea', 'Revisar pernos', 'Verificar estado'],
    ['Proyecto A', 'Frente 1', 'Equipo 01', 'Tarea', 'Revisar soldadura', ''],
    ['Proyecto A', 'Frente 1', 'Equipo 01', 'Álbum', 'Estado inicial', 'Inspección'],
    ['Proyecto A', 'Frente 2', 'Equipo 02', 'Tarea', 'Revisar estructura', ''],
    // Filas con problema: se informan pero no bloquean el resto.
    ['', 'Frente 3', '', 'Tarea', 'Sin carpeta', ''],
    ['Proyecto A', '', 'Equipo 03', 'Tarea', 'Camino con hueco', ''],
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
    'lee las 4 filas buenas y aparta las 3 con problema',
    previa.datos?.resumen?.filas === 4 && previa.datos?.resumen?.problemas === 3,
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
      confirmada.datos?.creado?.tareas === 3 &&
      confirmada.datos?.creado?.albumes === 1,
    `carpetas=${confirmada.datos?.creado?.carpetas} tareas=${confirmada.datos?.creado?.tareas} álbumes=${confirmada.datos?.creado?.albumes}`,
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
    segunda.datos?.resumen?.conflictos === 4,
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
    omitiendo.datos?.creado?.tareas === 0 &&
      omitiendo.datos?.omitido?.tareas === 3,
    `creadas=${omitiendo.datos?.creado?.tareas} omitidas=${omitiendo.datos?.omitido?.tareas}`,
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
    actualizando.datos?.actualizado?.tareas === 3 &&
      actualizando.datos?.creado?.tareas === 0,
    `actualizadas=${actualizando.datos?.actualizado?.tareas} creadas=${actualizando.datos?.creado?.tareas}`,
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
    duplicando.datos?.creado?.tareas === 3,
    `creadas=${duplicando.datos?.creado?.tareas}`,
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
  for (const c of creadas.rows) {
    await db.query('DELETE FROM comentarios_fotos WHERE "carpetaId" = $1', [c.id]);
    await db.query(
      'DELETE FROM comentarios_fotos WHERE "tareaId" IN (SELECT id FROM tareas_fotos WHERE "carpetaId" = $1)',
      [c.id],
    );
    await db.query('DELETE FROM tareas_fotos WHERE "carpetaId" = $1', [c.id]);
    await db.query('DELETE FROM albumes_fotos WHERE "carpetaId" = $1', [c.id]);
    await db.query('DELETE FROM carpetas_fotos WHERE id = $1', [c.id]).catch(() => {});
  }
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
  titulo('FASE 9 · Eliminar un álbum (§16)');

  const raiz = await api('POST', '/fotos/carpeta', token, {
    nombre: `Fase9 albumes ${Date.now()}`,
  });
  check('Carpeta de prueba creada', raiz.estado === 201, `HTTP ${raiz.estado}`);
  if (raiz.estado !== 201) return;
  pendientesDeLimpiar.push(raiz.datos.id);

  // 1 · el vacío se va
  const vacio = await api('POST', `/fotos/album/carpeta/${raiz.datos.id}`, token, {
    nombre: 'Vacío',
  });
  check('Álbum vacío creado', vacio.estado === 201, `HTTP ${vacio.estado}`);
  const borrado = await api('DELETE', `/fotos/album/${vacio.datos.id}`, token);
  check('Un álbum vacío se elimina', borrado.estado === 200, `HTTP ${borrado.estado}`);

  // 2 · el que tiene fotos NO se va, y lo dice
  const lleno = await api('POST', `/fotos/album/carpeta/${raiz.datos.id}`, token, {
    nombre: 'Con fotos',
  });
  const img = await imagenDePrueba();
  const sub = await subirFotos(`/fotos/album/${lleno.datos.id}/foto`, token, [img]);
  check('Foto subida al álbum', sub.datos?.subidas === 1, JSON.stringify(sub.datos));

  const rechazo = await api('DELETE', `/fotos/album/${lleno.datos.id}`, token);
  check(
    'Un álbum CON fotos se rechaza con 400',
    rechazo.estado === 400,
    `HTTP ${rechazo.estado}`,
  );
  check(
    'El mensaje dice cuántas fotos lo impiden',
    /1 foto/.test(rechazo.datos?.message ?? ''),
    rechazo.datos?.message,
  );
  check(
    'y ya NO promete que el álbum se retire solo al vaciarlo',
    !/se retirará solo/.test(rechazo.datos?.message ?? ''),
    rechazo.datos?.message,
  );

  // 3 · la descripción de una foto se corrige (Fase 2b)
  const g = await api('GET', `/fotos/carpeta/${raiz.datos.id}/album`, token);
  const foto = (g.datos?.albumes ?? []).flatMap((a) => a.fotos ?? [])[0];

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

  const gDesc = await api('GET', `/fotos/carpeta/${raiz.datos.id}/album`, token);
  const fotoDesc = (gDesc.datos?.albumes ?? []).flatMap((a) => a.fotos ?? [])[0];
  check(
    'y se lee de vuelta en la galería',
    fotoDesc?.descripcion === 'Compresor con fuga en la línea de succión',
    String(fotoDesc?.descripcion),
  );

  // ⚠️ El rastro es lo que hace de esto una corrección y no una edición
  // silenciosa: la bitácora guarda el valor ANTERIOR y el nuevo.
  const hist = await api(
    'GET',
    `/fotos/auditoria/carpeta/${raiz.datos.id}`,
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

  // 4 · al irse la última foto el álbum SE QUEDA, vacío (Fase 2b)
  //
  // ⚠️ Esta comprobación estaba INVERTIDA hasta la Fase 2b: el álbum se
  // retiraba solo. Se escribió cuando un álbum solo podía nacer de una
  // subida; desde §16 se crea vacío y CON NOMBRE, así que el auto-borrado
  // destruía algo que alguien había titulado, y el nombre no se recupera.
  await api('DELETE', `/fotos/foto/${foto.id}`, token);
  const g2 = await api('GET', `/fotos/carpeta/${raiz.datos.id}/album`, token);
  const sigue = (g2.datos?.albumes ?? []).find((a) => a.id === lleno.datos.id);
  check(
    'Al borrar la última foto el álbum SE QUEDA, vacío',
    !!sigue && (sigue.fotos ?? []).length === 0,
    `existe=${!!sigue} fotos=${(sigue?.fotos ?? []).length}`,
  );

  // Y la carpeta NO se puede borrar mientras ese álbum siga ahí: es el
  // `Restrict` de siempre. Vaciar no es borrar, y esto lo demuestra.
  const conAlbumVacio = await api(
    'DELETE',
    `/fotos/carpeta/${raiz.datos.id}`,
    token,
  );
  check(
    'y la carpeta sigue bloqueada por ese álbum vacío',
    conAlbumVacio.estado === 400,
    `HTTP ${conAlbumVacio.estado}`,
  );

  // 5 · borrar el álbum ya vacío es una decisión explícita
  const borradoVacio = await api('DELETE', `/fotos/album/${lleno.datos.id}`, token);
  check(
    'el álbum vacío se elimina a mano, que es la vía que queda',
    borradoVacio.estado === 200,
    `HTTP ${borradoVacio.estado}`,
  );

  const dc = await api('DELETE', `/fotos/carpeta/${raiz.datos.id}`, token);
  check('La carpeta ya sin álbumes se elimina', dc.estado === 200, `HTTP ${dc.estado}`);
  if (dc.estado === 200)
    pendientesDeLimpiar.splice(pendientesDeLimpiar.indexOf(raiz.datos.id), 1);

  titulo('FASE 9 · mover una foto (Fase 2c)');

  // Dos carpetas hermanas para poder mover ENTRE ellas, y una tarea.
  const raizM = await api('POST', '/fotos/carpeta', token, {
    nombre: `__verif_2c ${Date.now()}`,
  });
  pendientesDeLimpiar.unshift(raizM.datos.id);
  const origenC = await api('POST', '/fotos/carpeta', token, {
    nombre: 'Origen',
    parentId: raizM.datos.id,
  });
  pendientesDeLimpiar.unshift(origenC.datos.id);
  const destinoC = await api('POST', '/fotos/carpeta', token, {
    nombre: 'Destino',
    parentId: raizM.datos.id,
    tipo: 'EQUIPO',
  });
  pendientesDeLimpiar.unshift(destinoC.datos.id);
  const tareaM = await api(
    'POST',
    `/fotos/carpeta/${destinoC.datos.id}/tarea`,
    token,
    { titulo: 'Inspección 2c' },
  );

  const subidaM = await subirFotos(
    `/fotos/carpeta/${origenC.datos.id}/album`,
    token,
    [img],
    { descripcion: 'lote de origen' },
  );
  const albumOrigen = subidaM.datos?.albumId;
  const gM = await api('GET', `/fotos/carpeta/${origenC.datos.id}/album`, token);
  const fotoM = (gM.datos?.albumes ?? []).flatMap((a) => a.fotos ?? [])[0];

  const sinDestino = await api('POST', `/fotos/foto/${fotoM.id}/mover`, token, {});
  check(
    'mover sin decir a dónde se rechaza',
    sinDestino.estado === 400,
    `HTTP ${sinDestino.estado}`,
  );

  // 1 · a otra CARPETA: el servidor crea el álbum que la recoge.
  const aCarpeta = await api('POST', `/fotos/foto/${fotoM.id}/mover`, token, {
    carpetaId: destinoC.datos.id,
  });
  const gDestino = await api(
    'GET',
    `/fotos/carpeta/${destinoC.datos.id}/album`,
    token,
  );
  check(
    'se mueve a otra carpeta, y allí se le crea un álbum',
    aCarpeta.estado === 201 &&
      (gDestino.datos?.albumes ?? []).flatMap((a) => a.fotos ?? []).length === 1,
    `HTTP ${aCarpeta.estado}`,
  );

  // ⚠️ Y el álbum de ORIGEN se queda, vacío: desde la Fase 2b vaciar no es
  // borrar, y mover la última foto es vaciar.
  const gOrigen = await api(
    'GET',
    `/fotos/carpeta/${origenC.datos.id}/album`,
    token,
  );
  const albumSigue = (gOrigen.datos?.albumes ?? []).find(
    (a) => a.id === albumOrigen,
  );
  check(
    'el álbum de origen se queda vacío, no se borra',
    !!albumSigue && (albumSigue.fotos ?? []).length === 0,
    `existe=${!!albumSigue}`,
  );

  // 2 · a una TAREA.
  const aTareaM = await api('POST', `/fotos/foto/${fotoM.id}/mover`, token, {
    tareaId: tareaM.datos.id,
  });
  const fotosT = await api('GET', `/fotos/tarea/${tareaM.datos.id}/foto`, token);
  check(
    'se mueve a una tarea',
    aTareaM.estado === 201 && (fotosT.datos ?? []).length === 1,
    `HTTP ${aTareaM.estado} · ${(fotosT.datos ?? []).length}`,
  );

  // 3 · mover a donde ya está no escribe ni ensucia la bitácora.
  const mismoSitio = await api('POST', `/fotos/foto/${fotoM.id}/mover`, token, {
    tareaId: tareaM.datos.id,
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
      { carpetaId: origenC.datos.id },
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
      { carpetaId: origenC.datos.id },
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

  titulo('FASE 9 · crear el álbum CON NOMBRE desde la bandeja (Fase 2c)');

  // ⚠️ Hasta la Fase 2c el álbum que recogía el lote nacía SIN nombre, y no
  // había forma de ponérselo al clasificar: había que clasificar y luego ir
  // a editar el álbum, que es el paso de más que §18 quiere evitar.
  const clasM = await api('POST', '/fotos/bandeja/clasificar', token, {
    fotoIds: [fotoM.id],
    carpetaId: origenC.datos.id,
    nombre: 'Revisión del 23',
    descripcion: 'Lo que se encontró al bajar de la obra',
  });
  const gNombre = await api(
    'GET',
    `/fotos/carpeta/${origenC.datos.id}/album`,
    token,
  );
  const albumNombrado = (gNombre.datos?.albumes ?? []).find(
    (a) => a.id === clasM.datos?.albumId,
  );
  check(
    'clasificar en una carpeta crea el álbum CON el nombre indicado',
    clasM.estado === 201 &&
      albumNombrado?.nombre === 'Revisión del 23' &&
      albumNombrado?.descripcion === 'Lo que se encontró al bajar de la obra',
    `HTTP ${clasM.estado} · ${albumNombrado?.nombre}`,
  );

  // ⚠️ Hacia un álbum que YA existe el nombre se rechaza: sería renombrarlo
  // por la puerta de atrás, y para eso está `PATCH /fotos/album/:id`.
  await api('POST', `/fotos/foto/${fotoM.id}/mover`, token, { bandeja: true });
  const nombreAAlbum = await api('POST', '/fotos/bandeja/clasificar', token, {
    fotoIds: [fotoM.id],
    albumId: albumNombrado.id,
    nombre: 'Otro nombre',
  });
  check(
    'pero hacia un álbum existente el nombre se rechaza: no es renombrar',
    nombreAAlbum.estado === 400,
    `HTTP ${nombreAAlbum.estado}`,
  );

  // Sin nombre sigue funcionando: la captura rápida de §17 clasifica sin
  // escribir nada, y entonces el álbum nace sin título como siempre.
  const sinNombre = await api('POST', '/fotos/bandeja/clasificar', token, {
    fotoIds: [fotoM.id],
    albumId: albumNombrado.id,
  });
  check(
    'y sin nombre clasifica igual, como hasta ahora',
    sinNombre.estado === 201 && sinNombre.datos?.clasificadas === 1,
    `HTTP ${sinNombre.estado}`,
  );

  // Limpieza de esta sección: la foto y los álbumes, para que las carpetas
  // se puedan borrar (el `Restrict` de siempre).
  await api('DELETE', `/fotos/foto/${fotoM.id}`, token);
  for (const c of [origenC.datos.id, destinoC.datos.id]) {
    const g = await api('GET', `/fotos/carpeta/${c}/album`, token);
    for (const a of g.datos?.albumes ?? [])
      await api('DELETE', `/fotos/album/${a.id}`, token);
  }
  await api('DELETE', `/fotos/tarea/${tareaM.datos.id}`, token);

  // 5 · «no existe» y «no la ves» contestan lo mismo
  const fantasma = await api('DELETE', '/fotos/album/99999999', token);
  check(
    'Un álbum inexistente contesta 404 con el texto uniforme',
    fantasma.estado === 404 && /no existe o no tienes acceso/.test(fantasma.datos?.message ?? ''),
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
  const oculta = await api('POST', '/fotos/carpeta', tokenAdmin, {
    nombre: `Fase10 oculta ${Date.now()}`,
  });
  if (oculta.estado !== 201) {
    check('Carpeta de prueba creada', false, `HTTP ${oculta.estado}`);
    return;
  }
  pendientesDeLimpiar.push(oculta.datos.id);
  const cid = oculta.datos.id;

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
    [`/fotos/carpeta/${cid}/tarea/exportar`, 'Tareas'],
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
  const expSup = await descargar(`/fotos/carpeta/${cid}/tarea/exportar`, sup.token);
  check(
    'Exportar las tareas de una carpeta que no ve → 404',
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
