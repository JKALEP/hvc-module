
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  UserIcon,
  TriangleAlertIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { EmptyState } from '@/shared/components/EmptyState';

import {
  abrirInvitacion,
  activarInvitacion,
} from '@/modules/fotos/services/fotosService';

import {
  getErrorMessage,
  guardarToken,
} from '@/shared/services/api';

import { formatFechaCorta } from '@/shared/lib/format';

// Imágenes del login / invitación
import fondoLogin from '@/assets/fondo-login.png';
import logoHVC from '@/assets/hvc-logo.png';

const LARGO_MINIMO = 8;


// ============================================================
// INVITACIÓN
// ============================================================

export function Invitacion() {
  const { token } = useParams();
  const navegar = useNavigate();


  // ==========================================================
  // ESTADOS
  // ==========================================================

  const [nombreEditado, setNombreEditado] =
    useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');

  const [mostrarPassword, setMostrarPassword] =
    useState(false);

  const [mostrarRepetida, setMostrarRepetida] =
    useState(false);


  // ==========================================================
  // OBTENER INVITACIÓN
  // ==========================================================

  const invitacion = useQuery({
    queryKey: ['invitacion', token],
    queryFn: () => abrirInvitacion(token as string),
    enabled: Boolean(token),
    retry: false,
  });


  // ==========================================================
  // DATOS DE LA INVITACIÓN
  // ==========================================================

  const sugerencia =
    invitacion.data?.email.split('@')[0] ?? '';

  const nombre =
    nombreEditado ?? sugerencia;


  // ==========================================================
  // ACTIVAR INVITACIÓN
  // ==========================================================

  const activar = useMutation({
    mutationFn: () =>
      activarInvitacion(token as string, {
        nombre,
        password,
      }),

    onSuccess: (sesion) => {
      guardarToken(sesion.token);

      toast.success(
        `Bienvenido, ${sesion.usuario.nombre}`,
      );

      // Recarga entera para arrancar el contexto
      // de sesión completamente limpio.
      window.location.assign('/portal');
    },

    onError: (error) =>
      toast.error(
        getErrorMessage(
          error,
          'No se pudo activar la cuenta',
        ),
      ),
  });


  // ==========================================================
  // ESTADOS DE VALIDACIÓN
  // ==========================================================

  const passwordValida =
    password.length >= LARGO_MINIMO;

  const passwordsCoinciden =
    password !== '' &&
    repetida !== '' &&
    password === repetida;

  const passwordsNoCoinciden =
    repetida !== '' &&
    password !== repetida;

  const faltaAlgo =
    nombre.trim() === '' ||
    !passwordValida ||
    password !== repetida;


  // ==========================================================
  // CARGANDO INVITACIÓN
  // ==========================================================

  if (invitacion.isLoading) {
    return (
      <div
        className="
          relative
          flex
          min-h-screen
          w-full
          items-center
          justify-center
          overflow-hidden
        "
      >
        <div
          className="
            absolute
            inset-0
            bg-cover
            bg-center
          "
          style={{
            backgroundImage: `url(${fondoLogin})`,
          }}
        />

        <div className="absolute inset-0 bg-black/10" />

        <div className="relative z-10">
          <Spinner className="size-6 text-white" />
        </div>
      </div>
    );
  }


  // ==========================================================
  // INVITACIÓN INVÁLIDA / EXPIRADA
  // ==========================================================

  if (invitacion.isError || !invitacion.data) {
    return (
      <div
        className="
          relative
          min-h-screen
          w-full
          overflow-hidden
        "
      >

        <div
          className="
            absolute
            inset-0
            bg-cover
            bg-center
          "
          style={{
            backgroundImage: `url(${fondoLogin})`,
          }}
        />

        <div className="absolute inset-0 bg-black/10" />

        <div
          className="
            relative
            z-10
            flex
            min-h-screen
            items-center
            justify-center
            px-4
          "
        >

          <Card
            className="
              w-full
              max-w-[480px]
              rounded-2xl
              border-0
              bg-white
              p-8
              shadow-2xl
              sm:p-10
            "
          >

            <div className="text-center">

              <div className="flex justify-center">

                <img
                  src={logoHVC}
                  alt="HVC"
                  className="
                    h-28
                    w-auto
                    object-contain
                  "
                />

              </div>

              <div className="mt-2">

                <h1
                  className="
                    text-2xl
                    font-bold
                    tracking-tight
                    text-blue-950
                  "
                >
                  Invitación no disponible
                </h1>

                <p className="mt-1 text-sm text-muted-foreground">
                  Esta invitación ya no puede utilizarse.
                </p>

              </div>

            </div>

            <div className="mt-6">

              <EmptyState
                icon={TriangleAlertIcon}
                title="Esta invitación ya no sirve"
                description={getErrorMessage(
                  invitacion.error,
                  'Puede que ya la hayas usado, que haya caducado o que la hayan cancelado. Pídele una nueva a quien te la envió.',
                )}
              />

            </div>

            <Button
              type="button"
              className="
                mt-6
                h-11
                w-full
                bg-blue-950
                text-base
                hover:bg-blue-900
              "
              onClick={() => navegar('/login')}
            >
              Ir al inicio de sesión
            </Button>

          </Card>

        </div>

      </div>
    );
  }


  const datos = invitacion.data;


  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <div
      className="
        relative
        min-h-screen
        w-full
        overflow-hidden
      "
    >

      {/* ======================================================
          FONDO
          ====================================================== */}

      <div
        className="
          fixed
          inset-0
          bg-cover
          bg-center
        "
        style={{
          backgroundImage: `url(${fondoLogin})`,
        }}
      />

      <div className="fixed inset-0 bg-black/10" />


      {/* ======================================================
          CONTENIDO
          ====================================================== */}

      <div
        className="
          relative
          z-10
          flex
          min-h-screen
          items-center
          justify-center
          px-4
          py-8
          sm:py-10
        "
      >


        {/* ====================================================
            TARJETA
            ==================================================== */}

        <Card
          className="
            w-full
            max-w-[480px]
            rounded-2xl
            border-0
            bg-white
            p-8
            shadow-2xl
            sm:p-10
          "
        >

          <CardContent className="p-0">


            {/* ==================================================
                ENCABEZADO
                ================================================== */}

            <div className="text-center">

              <div className="flex justify-center">

                <img
                  src={logoHVC}
                  alt="HVC"
                  className="
                    h-32
                    w-auto
                    object-contain
                  "
                />

              </div>


              <div className="mt-1">

                <h1
                  className="
                    text-2xl
                    font-bold
                    tracking-tight
                    text-blue-950
                  "
                >
                  Bienvenido a HVC
                </h1>

                <p
                  className="
                    mt-1
                    text-sm
                    text-muted-foreground
                  "
                >
                  Completa tus datos para activar tu cuenta
                </p>

              </div>

            </div>


            {/* ==================================================
                INFORMACIÓN DE INVITACIÓN
                ================================================== */}

            <div
              className="
                mt-6
                rounded-xl
                border
                border-blue-100
                bg-blue-50/70
                px-4
                py-3.5
              "
            >

              <div className="flex items-start gap-3">

                <div
                  className="
                    mt-0.5
                    flex
                    size-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    bg-blue-100
                    text-blue-900
                  "
                >
                  <ShieldCheckIcon className="size-4" />
                </div>


                <div className="min-w-0">

                  <p
                    className="
                      text-sm
                      font-semibold
                      text-blue-950
                    "
                  >
                    Tienes una invitación
                  </p>

                  <p
                    className="
                      mt-0.5
                      text-xs
                      leading-5
                      text-blue-900/70
                    "
                  >
                    {datos.invitadoPor} compartió{' '}
                    <span className="font-medium">
                      «{datos.recurso}»
                    </span>{' '}
                    contigo.
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-blue-900/60
                    "
                  >
                    Esta invitación caduca el{' '}
                    <span className="font-medium">
                      {formatFechaCorta(datos.expiraEn)}
                    </span>.
                  </p>

                </div>

              </div>

            </div>


            {/* ==================================================
                FORMULARIO
                ================================================== */}

            <div className="mt-5 space-y-4">


              {/* =================================================
                  CORREO
                  ================================================= */}

              <div className="space-y-1.5">

                <label
                  htmlFor="email"
                  className="
                    block
                    text-sm
                    font-medium
                    text-foreground
                  "
                >
                  Correo electrónico
                </label>


                <div className="relative">

                  <MailIcon
                    className="
                      pointer-events-none
                      absolute
                      left-3
                      top-1/2
                      size-4
                      -translate-y-1/2
                      text-muted-foreground
                    "
                  />

                  <Input
                    id="email"
                    value={datos.email}
                    disabled
                    className="
                      h-11
                      bg-muted/40
                      pl-10
                      text-muted-foreground
                    "
                  />

                </div>

                <p className="text-xs text-muted-foreground">
                  Este correo está asociado a tu invitación.
                </p>

              </div>


              {/* =================================================
                  NOMBRE
                  ================================================= */}

              <div className="space-y-1.5">

                <label
                  htmlFor="nombre"
                  className="
                    block
                    text-sm
                    font-medium
                    text-foreground
                  "
                >
                  Tu nombre
                  <span className="ml-1 text-destructive">
                    *
                  </span>
                </label>


                <div className="relative">

                  <UserIcon
                    className="
                      pointer-events-none
                      absolute
                      left-3
                      top-1/2
                      size-4
                      -translate-y-1/2
                      text-muted-foreground
                    "
                  />

                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) =>
                      setNombreEditado(e.target.value)
                    }
                    placeholder="Ingresa tu nombre"
                    className="h-11 pl-10"
                  />

                </div>

              </div>


              {/* =================================================
                  CONTRASEÑA
                  ================================================= */}

              <div className="space-y-1.5">

                <label
                  htmlFor="password"
                  className="
                    block
                    text-sm
                    font-medium
                    text-foreground
                  "
                >
                  Contraseña
                  <span className="ml-1 text-destructive">
                    *
                  </span>
                </label>


                <div className="relative">

                  <LockIcon
                    className="
                      pointer-events-none
                      absolute
                      left-3
                      top-1/2
                      size-4
                      -translate-y-1/2
                      text-muted-foreground
                    "
                  />


                  <Input
                    id="password"
                    type={
                      mostrarPassword
                        ? 'text'
                        : 'password'
                    }
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder={`Mínimo ${LARGO_MINIMO} caracteres`}
                    className="h-11 pl-10 pr-10"
                  />


                  <button
                    type="button"
                    onClick={() =>
                      setMostrarPassword(
                        (v) => !v
                      )
                    }
                    className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      text-muted-foreground
                      transition-colors
                      hover:text-foreground
                    "
                    aria-label={
                      mostrarPassword
                        ? 'Ocultar contraseña'
                        : 'Mostrar contraseña'
                    }
                  >

                    {mostrarPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}

                  </button>

                </div>


                {/* Requisito de contraseña */}

                {password !== '' &&
                  !passwordValida && (

                    <p
                      className="
                        flex
                        items-center
                        gap-1.5
                        text-xs
                        font-medium
                        text-red-600
                      "
                    >
                      <TriangleAlertIcon className="size-3.5" />

                      La contraseña debe tener al menos{' '}
                      {LARGO_MINIMO} caracteres.
                    </p>

                  )}

              </div>


              {/* =================================================
                  REPETIR CONTRASEÑA
                  ================================================= */}

              <div className="space-y-1.5">

                <label
                  htmlFor="repetida"
                  className="
                    block
                    text-sm
                    font-medium
                    text-foreground
                  "
                >
                  Repite la contraseña
                  <span className="ml-1 text-destructive">
                    *
                  </span>
                </label>


                <div className="relative">

                  <LockIcon
                    className="
                      pointer-events-none
                      absolute
                      left-3
                      top-1/2
                      size-4
                      -translate-y-1/2
                      text-muted-foreground
                    "
                  />


                  <Input
                    id="repetida"
                    type={
                      mostrarRepetida
                        ? 'text'
                        : 'password'
                    }
                    value={repetida}
                    onChange={(e) =>
                      setRepetida(e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        !faltaAlgo
                      ) {
                        activar.mutate();
                      }
                    }}
                    placeholder="Repite tu contraseña"
                    className={`
                      h-11
                      pl-10
                      pr-10
                      ${
                        passwordsNoCoinciden
                          ? `
                            border-red-500
                            focus-visible:border-red-500
                            focus-visible:ring-red-500/20
                          `
                          : ''
                      }
                    `}
                    aria-invalid={
                      passwordsNoCoinciden
                    }
                  />


                  <button
                    type="button"
                    onClick={() =>
                      setMostrarRepetida(
                        (v) => !v
                      )
                    }
                    className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      text-muted-foreground
                      transition-colors
                      hover:text-foreground
                    "
                    aria-label={
                      mostrarRepetida
                        ? 'Ocultar contraseña'
                        : 'Mostrar contraseña'
                    }
                  >

                    {mostrarRepetida ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}

                  </button>

                </div>


                {/* Error de coincidencia */}

                {passwordsNoCoinciden && (

                  <p
                    className="
                      flex
                      items-center
                      gap-1.5
                      text-xs
                      font-medium
                      text-red-600
                    "
                  >

                    <TriangleAlertIcon className="size-3.5" />

                    Las contraseñas no coinciden.

                  </p>

                )}


                {/* Contraseñas correctas */}

                {passwordsCoinciden && (

                  <p
                    className="
                      text-xs
                      font-medium
                      text-green-600
                    "
                  >
                    Las contraseñas coinciden.
                  </p>

                )}

              </div>


              {/* =================================================
                  BOTÓN
                  ================================================= */}

              <Button
                type="button"
                className="
                  mt-2
                  h-11
                  w-full
                  bg-blue-950
                  text-base
                  hover:bg-blue-900
                "
                disabled={
                  faltaAlgo ||
                  activar.isPending
                }
                onClick={() =>
                  activar.mutate()
                }
              >

                {activar.isPending && (
                  <Spinner />
                )}

                {activar.isPending
                  ? 'Activando cuenta…'
                  : 'Crear mi cuenta y entrar'}

              </Button>

            </div>


            {/* ==================================================
                LOGIN
                ================================================== */}

            <button
              type="button"
              onClick={() => navegar('/login')}
              className="
                mx-auto
                mt-5
                block
                text-sm
                font-medium
                text-blue-900
                underline-offset-4
                hover:underline
              "
            >
              ¿Ya tienes cuenta? Inicia sesión
            </button>

          </CardContent>

        </Card>

      </div>

    </div>
  );
}
