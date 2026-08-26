import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  RotateCcwIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';

import logoEvidencia from '@/assets/hvc-logo.png';
import { useGeolocation } from '../hooks/useGeolocation';
import { cargarImagen } from '../lib/cargarImagen';
import { dibujarEvidenciaSobreCanvas } from '../lib/composeEvidencePhoto';
import { obtenerDireccionLegible } from '../lib/reverseGeocoding';

interface CamaraFotosProps {
  abierto: boolean;

  onCerrar: () => void;

  /**
   * Se llama cada vez que se toma una fotografía.
   * El padre solamente la agrega al lote.
   */
  onCapturar: (foto: File) => void;

  /**
   * Permite eliminar del lote padre una fotografía
   * que fue eliminada durante la revisión.
   */
  onEliminar?: (foto: File) => void;

  /**
   * Cantidad de espacios disponibles en el lote padre.
   */
  cuposDisponibles: number;
}

type EstadoCamara =
  | 'iniciando'
  | 'lista'
  | 'sin-camara'
  | 'permiso-denegado';

type ModoCamara = 'camara' | 'revision';

interface FotoSesion {
  id: string;
  archivo: File;
  preview: string;
}

const MAX_FOTOS_SESION = 15;

export function CamaraFotos({
  abierto,
  onCerrar,
  onCapturar,
  onEliminar,
  cuposDisponibles,
}: CamaraFotosProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [estado, setEstado] =
    useState<EstadoCamara>('iniciando');

  const [modo, setModo] =
    useState<ModoCamara>('camara');

  const [fotosSesion, setFotosSesion] =
    useState<FotoSesion[]>([]);

  const [modoFrontal, setModoFrontal] =
    useState(false);

  const [tieneVariasCamaras, setTieneVariasCamaras] =
    useState(false);

  const [fotoSeleccionada, setFotoSeleccionada] =
    useState<FotoSesion | null>(null);

  const [capturando, setCapturando] =
    useState(false);

  /**
   * ============================================================
   * EVIDENCIA: GPS + LOGO
   * ============================================================
   *
   * El GPS se observa mientras el modal está abierto, en paralelo
   * a la cámara. No bloquea nada: si falla, cada foto se genera
   * igual, solo que sin coordenadas.
   */

  const { estado: estadoGps, error: errorGps, posicionRef } =
    useGeolocation(abierto);

  const logoRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelado = false;

    cargarImagen(logoEvidencia)
      .then((img) => {
        if (!cancelado) {
          logoRef.current = img;
        }
      })
      .catch(() => {
        /**
         * Si el logo no carga, la fotografía de evidencia
         * igual debe poder generarse (sin logo).
         */
        logoRef.current = null;
      });

    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * ============================================================
   * STREAM
   * ============================================================
   */

  const detenerStream = useCallback(() => {
    const stream = streamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Nada que hacer si el track ya estaba detenido.
        }
      });
    }

    streamRef.current = null;

    /**
     * IMPORTANTE:
     * también desconectamos el video.
     */
    const video = videoRef.current;

    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  /**
   * Detecta si existe más de una cámara.
   */
  const detectarCamaras = useCallback(async () => {
    try {
      const dispositivos =
        await navigator.mediaDevices.enumerateDevices();

      const camaras = dispositivos.filter(
        (dispositivo) =>
          dispositivo.kind === 'videoinput',
      );

      setTieneVariasCamaras(camaras.length > 1);
    } catch {
      setTieneVariasCamaras(false);
    }
  }, []);

  /**
   * Inicia la cámara.
   *
   * Esta función es la única responsable de crear
   * y conectar el MediaStream al video.
   */
  const iniciarCamara = useCallback(
    async (frontal: boolean) => {
      /**
       * Primero siempre eliminamos cualquier stream anterior.
       */
      detenerStream();

      setEstado('iniciando');

      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado('sin-camara');
        return;
      }

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: frontal
                ? 'user'
                : 'environment',

              width: {
                ideal: 1920,
              },

              height: {
                ideal: 1080,
              },
            },

            audio: false,
          });

        streamRef.current = stream;

        /**
         * Puede ocurrir que durante el await el usuario
         * haya cerrado la cámara.
         */
        if (!abiertoRef.current) {
          stream
            .getTracks()
            .forEach((track) => track.stop());

          return;
        }

        /**
         * El video debe existir cuando conectamos
         * el stream.
         */
        const video = videoRef.current;

        if (!video) {
          stream
            .getTracks()
            .forEach((track) => track.stop());

          streamRef.current = null;

          setEstado('sin-camara');

          return;
        }

        video.srcObject = stream;

        /**
         * Esperamos a que el navegador pueda reproducir.
         */
        try {
          await video.play();
        } catch {
          /**
           * Algunos navegadores móviles pueden necesitar
           * que el video termine de cargar.
           */
        }

        /**
         * Comprobamos nuevamente que la cámara siga abierta.
         */
        if (!abiertoRef.current) {
          detenerStream();
          return;
        }

        setEstado('lista');

        await detectarCamaras();
      } catch (error) {
        const esPermiso =
          error instanceof DOMException &&
          (error.name === 'NotAllowedError' ||
            error.name === 'SecurityError');

        const noHayCamara =
          error instanceof DOMException &&
          (error.name === 'NotFoundError' ||
            error.name === 'DevicesNotFoundError');

        if (esPermiso) {
          setEstado('permiso-denegado');
        } else if (noHayCamara) {
          setEstado('sin-camara');
        } else {
          setEstado('sin-camara');
        }
      }
    },
    [detenerStream, detectarCamaras],
  );

  /**
   * Referencia al estado abierto.
   *
   * Sirve para evitar que una promesa de getUserMedia()
   * termine conectando una cámara después de cerrar el modal.
   */
  const abiertoRef = useRef(abierto);

  useEffect(() => {
    abiertoRef.current = abierto;
  }, [abierto]);

  /**
   * ============================================================
   * APERTURA / CIERRE
   * ============================================================
   */

  useEffect(() => {
    if (!abierto) {
      detenerStream();
      return;
    }

    /**
     * Nueva sesión.
     */
    setModo('camara');
    setEstado('iniciando');
    setModoFrontal(false);
    setFotoSeleccionada(null);
    setFotosSesion([]);
    setCapturando(false);

    /**
     * Se inicia después de que el componente haya montado.
     */
    const timer = window.setTimeout(() => {
      iniciarCamara(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      detenerStream();
    };
  }, [abierto, detenerStream, iniciarCamara]);

  /**
   * ============================================================
   * CAMBIO DE MODO
   * ============================================================
   *
   * Esta es una de las partes importantes que corrige
   * la pantalla negra.
   *
   * Cuando entramos a revisión:
   *   cámara → detener stream.
   *
   * Cuando volvemos a cámara:
   *   revisión → iniciar stream nuevamente.
   */

  useEffect(() => {
    if (!abierto) return;

    if (modo === 'revision') {
      detenerStream();
      return;
    }

    /**
     * Si volvemos al modo cámara, esperamos una intervención
     * para asegurarnos de que <video> ya exista nuevamente.
     */
    const timer = window.setTimeout(() => {
      iniciarCamara(modoFrontal);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    modo,
    abierto,
    modoFrontal,
    detenerStream,
    iniciarCamara,
  ]);

  /**
   * ============================================================
   * PREVIEWS
   * ============================================================
   */

  const liberarPreviews = useCallback(
    (fotos: FotoSesion[]) => {
      fotos.forEach((foto) => {
        try {
          URL.revokeObjectURL(foto.preview);
        } catch {
          // La URL ya pudo haber sido liberada.
        }
      });
    },
    [],
  );

  /**
   * ============================================================
   * LÍMITES
   * ============================================================
   */

  const limiteSesion = Math.min(
    MAX_FOTOS_SESION,
    Math.max(
      cuposDisponibles + fotosSesion.length,
      0,
    ),
  );

  const cantidadFotos = fotosSesion.length;

  const puedeCapturar =
    estado === 'lista' &&
    !capturando &&
    cantidadFotos < limiteSesion &&
    cuposDisponibles > 0;

  const sinCupo =
    cuposDisponibles <= 0 ||
    cantidadFotos >= limiteSesion;

  /**
   * ============================================================
   * CAPTURA
   * ============================================================
   *
   * Flujo por fotografía:
   *
   * 1. Se dibuja el frame actual del video en el canvas.
   * 2. Se registra la fecha/hora EXACTA de este instante.
   * 3. Se lee la última posición GPS conocida (puede ser null).
   * 4. Se intenta reverse geocoding (tolerante a fallos).
   * 5. Se dibuja logo + metadata sobre el mismo canvas.
   * 6. Se genera el Blob/File final y se entrega igual que antes.
   */

  const capturar = async () => {
    if (!puedeCapturar) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
    return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      return;
    }

    setCapturando(true);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const contexto = canvas.getContext('2d');

    if (!contexto) {
      setCapturando(false);
      return;
    }

    // Momento exacto de la captura (no el de apertura de cámara).
    const fechaCaptura = new Date();

    contexto.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    // Última posición GPS conocida en este instante.
    const posicionActual = posicionRef.current;

    let direccion: string[] | null = null;

    if (posicionActual) {
      try {
        direccion = await obtenerDireccionLegible(
          posicionActual.latitude,
          posicionActual.longitude,
        );
      } catch {
        direccion = null;
      }
    }

    /**
     * El modal pudo haberse cerrado mientras esperábamos
     * el reverse geocoding.
     */
    if (!abiertoRef.current) {
      setCapturando(false);
      return;
    }

    dibujarEvidenciaSobreCanvas(
      contexto,
      canvas.width,
      canvas.height,
      logoRef.current,
      {
        fecha: fechaCaptura,
        latitude: posicionActual?.latitude ?? null,
        longitude: posicionActual?.longitude ?? null,
        accuracy: posicionActual?.accuracy ?? null,
        direccion,
      },
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCapturando(false);
          return;
        }

        const ahora = Date.now();

        const id =
          `${ahora}-` +
          Math.random()
            .toString(36)
            .slice(2, 9);

        const archivo = new File(
          [blob],
          `foto-evidencia-${ahora}.jpg`,
          {
            type: 'image/jpeg',
            lastModified: ahora,
          },
        );

        const preview =
          URL.createObjectURL(blob);

        const nuevaFoto: FotoSesion = {
          id,
          archivo,
          preview,
        };

        setFotosSesion((prev) => [
          ...prev,
          nuevaFoto,
        ]);

        /**
         * Se agrega al lote del padre.
         * Todavía NO se sube al backend.
         */
        onCapturar(archivo);

        setCapturando(false);
      },
      'image/jpeg',
      0.92,
    );
  };

  /**
   * ============================================================
   * CAMBIAR CÁMARA
   * ============================================================
   */

  const cambiarCamara = () => {
    if (estado !== 'lista') return;

    setModoFrontal((actual) => !actual);
  };

  /**
   * ============================================================
   * REVISIÓN
   * ============================================================
   */

  const abrirRevision = () => {
    setFotoSeleccionada(null);
    setModo('revision');
  };

  /**
   * ============================================================
   * ELIMINAR FOTO
   * ============================================================
   */

  const eliminarFoto = (foto: FotoSesion) => {
    /**
     * Primero avisamos al padre.
     *
     * Esto es necesario porque onCapturar()
     * ya había agregado el File al lote.
     */
    onEliminar?.(foto.archivo);

    setFotosSesion((prev) => {
      const siguiente = prev.filter(
        (item) => item.id !== foto.id,
      );

      try {
        URL.revokeObjectURL(foto.preview);
      } catch {
        // Nada que hacer.
      }

      return siguiente;
    });

    if (
      fotoSeleccionada?.id === foto.id
    ) {
      setFotoSeleccionada(null);
    }
  };

  /**
   * ============================================================
   * CONTINUAR TOMANDO
   * ============================================================
   *
   * No intentamos manipular manualmente el video.
   *
   * Cambiamos el modo.
   *
   * El useEffect de arriba detectará:
   *
   * revision → camara
   *
   * y arrancará nuevamente getUserMedia().
   */

  const continuarTomando = () => {
    setFotoSeleccionada(null);
    setModo('camara');
  };

  /**
   * ============================================================
   * TERMINAR
   * ============================================================
   */

  const terminar = () => {
    detenerStream();
    setFotoSeleccionada(null);

    /**
     * No liberamos las previews aquí porque
     * solamente estamos cerrando la sesión.
     *
     * El padre ya tiene los File.
     */
    onCerrar();
  };

  /**
   * ============================================================
   * CANCELAR
   * ============================================================
   *
   * Si el usuario cancela, eliminamos del padre todas
   * las fotos capturadas durante esta sesión.
   */

  const cancelar = () => {
    detenerStream();

    /**
     * Quitamos del lote padre las fotos de esta sesión.
     */
    fotosSesion.forEach((foto) => {
      onEliminar?.(foto.archivo);
    });

    liberarPreviews(fotosSesion);

    setFotosSesion([]);
    setFotoSeleccionada(null);
    setModo('camara');
    setCapturando(false);

    onCerrar();
  };

  /**
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <Dialog
      open={abierto}
      onOpenChange={(open) => {
        if (!open) {
          terminar();
        }
      }}
    >
      <DialogContent
        showClose={false}
        className="
          max-w-4xl
          gap-0
          overflow-hidden
          p-0
        "
      >
        {/* ========================================================
            HEADER
        ======================================================== */}

        <DialogHeader
          className="
            flex-row
            items-center
            justify-between
            border-b
            border-border
            bg-background
            px-4
            py-3
          "
        >
          <div className="flex items-center gap-3">
            {modo === 'revision' && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={continuarTomando}
                title="Volver a la cámara"
              >
                <ChevronLeftIcon className="size-5" />
              </Button>
            )}

            <div>
              <DialogTitle className="text-base">
                {modo === 'camara'
                  ? 'Tomar fotografías'
                  : 'Revisar fotografías'}
              </DialogTitle>

              <p className="mt-0.5 text-xs text-muted-foreground">
                {cantidadFotos} / {limiteSesion}{' '}
                fotografías
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={cancelar}
            title="Cancelar"
          >
            <XIcon className="size-5" />
          </Button>
        </DialogHeader>

        {/* ========================================================
            MODO CÁMARA
        ======================================================== */}

        {modo === 'camara' && (
          <>
            <div className="relative bg-black">
              {/*
               * IMPORTANTE:
               *
               * El video SIEMPRE está montado mientras
               * estamos en modo cámara.
               *
               * El stream se inicia DESPUÉS de que
               * este elemento exista.
               */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`
                  block
                  aspect-video
                  w-full
                  object-contain
                  bg-black
                  transition-opacity
                  duration-200
                  ${
                    estado === 'lista'
                      ? 'opacity-100'
                      : 'opacity-0'
                  }
                `}
              />

              {/* Activando cámara */}
              {estado === 'iniciando' && (
                <div
                  className="
                    absolute
                    inset-0
                    flex
                    flex-col
                    items-center
                    justify-center
                    gap-3
                    bg-black
                    text-center
                    text-white
                  "
                >
                  <div
                    className="
                      size-8
                      animate-spin
                      rounded-full
                      border-2
                      border-white/20
                      border-t-white
                    "
                  />

                  <div>
                    <p className="text-sm font-medium">
                      Activando cámara…
                    </p>

                    <p className="mt-1 text-xs text-white/60">
                      Permite el acceso a la cámara
                      si el navegador lo solicita.
                    </p>
                  </div>
                </div>
              )}

              {/* Error cámara */}
              {(estado === 'sin-camara' ||
                estado === 'permiso-denegado') && (
                <div
                  className="
                    absolute
                    inset-0
                    flex
                    flex-col
                    items-center
                    justify-center
                    gap-3
                    bg-black
                    px-6
                    text-center
                    text-white
                  "
                >
                  <div
                    className="
                      flex
                      size-12
                      items-center
                      justify-center
                      rounded-full
                      bg-white/10
                    "
                  >
                    <AlertTriangleIcon
                      className="size-6 text-amber-400"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium">
                      {estado ===
                      'permiso-denegado'
                        ? 'No se pudo acceder a la cámara'
                        : 'No encontramos una cámara disponible'}
                    </p>

                    <p
                      className="
                        mx-auto
                        mt-1
                        max-w-md
                        text-xs
                        leading-relaxed
                        text-white/60
                      "
                    >
                      {estado ===
                      'permiso-denegado'
                        ? 'Revisa los permisos de cámara de este sitio en tu navegador e inténtalo nuevamente.'
                        : 'Puedes cerrar esta ventana y utilizar la opción "Elegir fotos".'}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      iniciarCamara(
                        modoFrontal,
                      )
                    }
                  >
                    Intentar nuevamente
                  </Button>
                </div>
              )}

              {/* Flash de captura */}
              {capturando && (
                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-white/25
                  "
                />
              )}

              {/* Contador */}
              {estado === 'lista' && (
                <div
                  className="
                    absolute
                    left-3
                    top-3
                    rounded-full
                    bg-black/60
                    px-3
                    py-1.5
                    text-xs
                    font-medium
                    text-white
                    backdrop-blur-sm
                  "
                >
                  {cantidadFotos} / {limiteSesion}
                </div>
              )}

              {/* Miniaturas */}
              {cantidadFotos > 0 &&
                estado === 'lista' && (
                  <div
                    className="
                      absolute
                      bottom-3
                      left-3
                      right-3
                      flex
                      items-end
                      justify-between
                      gap-3
                    "
                  >
                    <div
                      className="
                        flex
                        max-w-[70%]
                        gap-1.5
                        overflow-hidden
                      "
                    >
                      {fotosSesion
                        .slice(-5)
                        .map(
                          (foto, index) => (
                            <button
                              key={foto.id}
                              type="button"
                              onClick={() => {
                                setFotoSeleccionada(
                                  foto,
                                );
                                abrirRevision();
                              }}
                              className="
                                relative
                                size-12
                                shrink-0
                                overflow-hidden
                                rounded-md
                                border
                                border-white/70
                                bg-black
                                shadow-lg
                                transition-transform
                                hover:scale-105
                              "
                            >
                              <img
                                src={foto.preview}
                                alt={`Fotografía ${
                                  cantidadFotos -
                                  Math.min(
                                    4,
                                    cantidadFotos -
                                      1,
                                  ) +
                                  index
                                }`}
                                className="
                                  size-full
                                  object-cover
                                "
                              />
                            </button>
                          ),
                        )}
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={abrirRevision}
                      className="shrink-0 shadow-lg"
                    >
                      Ver {cantidadFotos}
                    </Button>
                  </div>
                )}
            </div>

            {/* ======================================================
                CONTROLES
            ====================================================== */}

            <div
              className="
                border-t
                border-border
                bg-background
                px-4
                py-4
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                {/* Izquierda */}
                <div
                  className="
                    flex
                    min-w-0
                    flex-1
                    items-center
                    gap-2
                  "
                >
                  {tieneVariasCamaras && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={cambiarCamara}
                      disabled={
                        estado !== 'lista'
                      }
                      title={
                        modoFrontal
                          ? 'Cambiar a cámara trasera'
                          : 'Cambiar a cámara frontal'
                      }
                    >
                      <RotateCcwIcon className="size-4" />
                    </Button>
                  )}

                  {cantidadFotos > 0 && (
                    <span
                      className="
                        hidden
                        text-xs
                        text-muted-foreground
                        sm:block
                      "
                    >
                      Puedes revisar las fotos
                      antes de utilizarlas.
                    </span>
                  )}
                </div>

                {/* Capturar */}
                <button
                  type="button"
                  onClick={capturar}
                  disabled={!puedeCapturar}
                  aria-label="Capturar fotografía"
                  className="
                    flex
                    size-16
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    border-4
                    border-background
                    bg-foreground
                    text-background
                    shadow-lg
                    ring-1
                    ring-border
                    transition
                    hover:scale-105
                    active:scale-95
                    disabled:pointer-events-none
                    disabled:opacity-40
                    sm:size-[72px]
                  "
                >
                  <CameraIcon className="size-7 sm:size-8" />
                </button>

                {/* Revisar */}
                <div
                  className="
                    flex
                    min-w-0
                    flex-1
                    justify-end
                  "
                >
                  {cantidadFotos > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={abrirRevision}
                    >
                      Revisar
                      <span className="ml-1">
                        ({cantidadFotos})
                      </span>
                    </Button>
                  ) : (
                    <div />
                  )}
                </div>
              </div>

              {/* Límite */}
              {sinCupo && (
                <div
                  className="
                    mt-3
                    rounded-md
                    bg-amber-50
                    px-3
                    py-2
                    text-center
                    text-xs
                    text-amber-800
                    dark:bg-amber-950/30
                    dark:text-amber-300
                  "
                >
                  Alcanzaste el máximo de
                  fotografías. Revisa las fotos
                  para eliminar alguna o termina
                  la captura.
                </div>
              )}

              {!sinCupo && (
                <p
                  className="
                    mt-3
                    text-center
                    text-xs
                    text-muted-foreground
                  "
                >
                  Pulsa el botón para tomar una
                  fotografía. Puedes continuar
                  tomando sin cerrar la cámara.
                </p>
              )}

              {/* Aviso GPS: nunca bloquea la cámara, solo informa */}
              {estado === 'lista' &&
                estadoGps === 'error' &&
                errorGps && (
                  <p
                    className="
                      mt-2
                      text-center
                      text-[11px]
                      text-muted-foreground
                    "
                  >
                    {errorGps} Las fotos se
                    guardarán sin ubicación GPS.
                  </p>
                )}
            </div>
          </>
        )}

        {/* ========================================================
            MODO REVISIÓN
        ======================================================== */}

        {modo === 'revision' && (
          <>
            <div
              className="
                max-h-[65vh]
                overflow-y-auto
                p-4
                sm:p-6
              "
            >
              {cantidadFotos === 0 ? (
                <div
                  className="
                    flex
                    min-h-[300px]
                    flex-col
                    items-center
                    justify-center
                    text-center
                  "
                >
                  <div
                    className="
                      mb-3
                      flex
                      size-12
                      items-center
                      justify-center
                      rounded-full
                      bg-muted
                    "
                  >
                    <CameraIcon
                      className="
                        size-5
                        text-muted-foreground
                      "
                    />
                  </div>

                  <p className="text-sm font-medium">
                    No hay fotografías todavía
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-muted-foreground
                    "
                  >
                    Regresa a la cámara para tomar
                    la primera.
                  </p>

                  <Button
                    type="button"
                    className="mt-4"
                    onClick={continuarTomando}
                  >
                    <CameraIcon />
                    Tomar fotografía
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-medium">
                      Fotografías capturadas
                    </h3>

                    <p
                      className="
                        mt-1
                        text-xs
                        text-muted-foreground
                      "
                    >
                      Revisa las fotografías y
                      elimina las que no necesites.
                    </p>
                  </div>

                  <div
                    className="
                      grid
                      grid-cols-2
                      gap-3
                      sm:grid-cols-3
                      md:grid-cols-4
                    "
                  >
                    {fotosSesion.map(
                      (foto, index) => (
                        <div
                          key={foto.id}
                          className="
                            group
                            relative
                            aspect-square
                            overflow-hidden
                            rounded-xl
                            border
                            border-border
                            bg-muted
                          "
                        >
                          <button
                            type="button"
                            className="
                              absolute
                              inset-0
                              z-0
                            "
                            onClick={() =>
                              setFotoSeleccionada(
                                foto,
                              )
                            }
                            aria-label={`Ver fotografía ${
                              index + 1
                            }`}
                          >
                            <img
                              src={foto.preview}
                              alt={`Fotografía ${
                                index + 1
                              }`}
                              className="
                                size-full
                                object-cover
                                transition-transform
                                duration-200
                                group-hover:scale-105
                              "
                            />
                          </button>

                          {/* Número */}
                          <span
                            className="
                              absolute
                              left-2
                              top-2
                              z-10
                              flex
                              size-7
                              items-center
                              justify-center
                              rounded-full
                              bg-black/65
                              text-xs
                              font-medium
                              text-white
                              backdrop-blur-sm
                            "
                          >
                            {index + 1}
                          </span>

                          {/* Eliminar */}
                          <button
                            type="button"
                            onClick={() =>
                              eliminarFoto(
                                foto,
                              )
                            }
                            aria-label={`Eliminar fotografía ${
                              index + 1
                            }`}
                            title="Eliminar fotografía"
                            className="
                              absolute
                              right-2
                              top-2
                              z-10
                              flex
                              size-8
                              items-center
                              justify-center
                              rounded-full
                              bg-black/65
                              text-white
                              backdrop-blur-sm
                              transition
                              hover:bg-destructive
                            "
                          >
                            <Trash2Icon className="size-4" />
                          </button>

                          <div
                            className="
                              pointer-events-none
                              absolute
                              inset-x-0
                              bottom-0
                              z-10
                              bg-gradient-to-t
                              from-black/70
                              to-transparent
                              px-2
                              pb-2
                              pt-6
                            "
                          >
                            <span className="text-[10px] text-white/90">
                              Fotografía{' '}
                              {index + 1}
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  <div
                    className="
                      rounded-lg
                      bg-muted/50
                      px-3
                      py-2.5
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        gap-3
                      "
                    >
                      <span className="text-xs text-muted-foreground">
                        Fotografías listas
                      </span>

                      <span
                        className="
                          text-sm
                          font-medium
                          tabular-nums
                        "
                      >
                        {cantidadFotos} /{' '}
                        {limiteSesion}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ======================================================
                FOOTER REVISIÓN
            ====================================================== */}

            <DialogFooter
              className="
                flex-col
                gap-2
                border-t
                border-border
                bg-background
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <Button
                type="button"
                variant="ghost"
                onClick={continuarTomando}
              >
                <CameraIcon />
                Continuar tomando
              </Button>

              <div
                className="
                  flex
                  w-full
                  gap-2
                  sm:w-auto
                "
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelar}
                >
                  <XIcon />
                  Cancelar
                </Button>

                <Button
                  type="button"
                  onClick={terminar}
                  disabled={cantidadFotos === 0}
                  className="
                    flex-1
                    sm:flex-none
                  "
                >
                  <CheckIcon />

                  Usar {cantidadFotos}{' '}
                  {cantidadFotos === 1
                    ? 'fotografía'
                    : 'fotografías'}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        <canvas
          ref={canvasRef}
          className="hidden"
        />

        {/* ========================================================
            VISOR DE FOTO
        ======================================================== */}

        {fotoSeleccionada && (
          <div
            className="
              fixed
              inset-0
              z-[100]
              flex
              items-center
              justify-center
              bg-black/90
              p-4
            "
            onClick={() =>
              setFotoSeleccionada(null)
            }
          >
            <button
              type="button"
              onClick={() =>
                setFotoSeleccionada(null)
              }
              className="
                absolute
                right-4
                top-4
                z-10
                flex
                size-10
                items-center
                justify-center
                rounded-full
                bg-white/10
                text-white
                backdrop-blur-sm
                transition
                hover:bg-white/20
              "
              aria-label="Cerrar vista previa"
            >
              <XIcon className="size-5" />
            </button>

            <img
              src={fotoSeleccionada.preview}
              alt="Vista previa"
              className="
                max-h-[90vh]
                max-w-[95vw]
                rounded-lg
                object-contain
                shadow-2xl
              "
              onClick={(event) =>
                event.stopPropagation()
              }
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}