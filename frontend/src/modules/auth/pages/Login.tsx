import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';

import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  LogInIcon,
  TriangleAlertIcon,
} from 'lucide-react';

import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';

import { useAuth } from '@/modules/auth/hooks/useAuth';
import { getErrorMessage } from '@/shared/services/api';
import { rutaInicial } from '@/shared/lib/modulos';

// Imágenes del login
import fondoLogin from '@/assets/fondo-login.png';
import logoHVC from '@/assets/hvc-logo.png';


// ============================================================
// ÍCONO DE OUTLOOK
// ============================================================

function LogoOutlook() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-5 shrink-0"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="4"
        width="20"
        height="24"
        rx="2"
        fill="#0364B8"
      />

      <path
        d="M22 8v16l8 4V4l-8 4Z"
        fill="#0A2767"
      />

      <circle
        cx="12"
        cy="16"
        r="6"
        fill="#fff"
      />

      <circle
        cx="12"
        cy="16"
        r="4.2"
        fill="#0364B8"
      />
    </svg>
  );
}


// ============================================================
// LOGIN
// ============================================================

export function Login() {
  const navigate = useNavigate();

  const {
    usuario,
    cargando,
    entrar,
  } = useAuth();


  // ==========================================================
  // ESTADOS
  // ==========================================================

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [recordarme, setRecordarme] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // NUEVO:
  // Indica si el usuario ya interactuó con el campo correo.
  const [emailTouched, setEmailTouched] = useState(false);


  // ==========================================================
  // VALIDACIÓN DEL CORREO
  // ==========================================================

  const emailLimpio = email.trim();

  const emailValido =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio);

  // El error visual solamente aparece cuando:
  // 1. El usuario ya salió/interactuó con el campo
  // 2. El correo tiene contenido
  // 3. El formato es incorrecto
  const mostrarErrorEmail =
    emailTouched &&
    emailLimpio !== '' &&
    !emailValido;


  // ==========================================================
  // SI YA EXISTE UNA SESIÓN
  // ==========================================================

  if (!cargando && usuario) {
    return (
      <Navigate
        to={rutaInicial(usuario)}
        replace
      />
    );
  }


  // ==========================================================
  // ENVIAR LOGIN
  // ==========================================================

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();

    // Marcamos el correo como tocado.
    // Esto permite mostrar el mensaje si intenta enviar
    // un correo con formato incorrecto.
    setEmailTouched(true);

    // Si el correo tiene formato incorrecto,
    // no enviamos la petición al backend.
    if (!emailValido) {
      return;
    }

    setError(null);
    setEnviando(true);

    try {
      const datos = await entrar(email, password);

      navigate(
        rutaInicial(datos),
        {
          replace: true,
        }
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'No se pudo iniciar sesión'
        )
      );
    } finally {
      setEnviando(false);
    }
  };


  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <div className="relative h-screen w-full overflow-hidden">

      {/* ======================================================
          FONDO
          ====================================================== */}

      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${fondoLogin})`,
        }}
      />

      <div className="absolute inset-0 bg-black/10" />


      {/* ======================================================
          CONTENIDO PRINCIPAL
          ====================================================== */}

      <div className="relative z-10 flex h-screen items-center justify-center px-4">


        {/* ====================================================
            TARJETA DEL LOGIN
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


          {/* ==================================================
              ENCABEZADO
              ================================================== */}

          <div className="text-center">

            <div className="flex justify-center">

              <img
                src={logoHVC}
                alt="HVC"
                className="
                  h-36
                  w-auto
                  object-contain
                "
              />

            </div>


            <div className="mt-0">

              <h1
                className="
                  text-2xl
                  font-bold
                  tracking-tight
                  text-blue-950
                "
              >
                Bienvenido
              </h1>

              <p className="mt-0 text-sm text-muted-foreground">
                Inicia sesión para continuar
              </p>

            </div>

          </div>


          {/* ==================================================
              FORMULARIO
              ================================================== */}

          <form
            onSubmit={enviar}
            className="mt-1 space-y-4"
          >


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
                  className={`
                    pointer-events-none
                    absolute
                    left-3
                    top-1/2
                    size-4
                    -translate-y-1/2
                    ${
                      mostrarErrorEmail
                        ? 'text-red-500'
                        : 'text-muted-foreground'
                    }
                  `}
                />


                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);

                    // Si el usuario ya había interactuado
                    // con el campo, la validación se actualiza
                    // inmediatamente al corregirlo.
                    if (!emailTouched) {
                      setEmailTouched(true);
                    }
                  }}
                  onBlur={() => {
                    setEmailTouched(true);
                  }}
                  placeholder="Ingresa tu correo"
                  className={`
                    h-11
                    pl-10
                    ${
                      mostrarErrorEmail
                        ? `
                          border-red-500
                          focus-visible:border-red-500
                          focus-visible:ring-red-500/20
                        `
                        : ''
                    }
                  `}
                  required
                  aria-invalid={mostrarErrorEmail}
                  aria-describedby={
                    mostrarErrorEmail
                      ? 'email-error'
                      : undefined
                  }
                />

              </div>


              {/* =================================================
                  ERROR DEL CORREO
                  ================================================= */}

              {mostrarErrorEmail && (

                <p
                  id="email-error"
                  className="
                    flex
                    items-center
                    gap-1.5
                    text-xs
                    font-medium
                    text-red-600
                  "
                >

                  <TriangleAlertIcon
                    className="size-3.5 shrink-0"
                  />

                  Formato de correo incorrecto

                </p>

              )}

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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Ingresa tu contraseña"
                  className="h-11 pl-10 pr-10"
                  required
                />


                {/* Mostrar / ocultar contraseña */}

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

            </div>


            {/* =================================================
                RECORDARME + OLVIDÉ CONTRASEÑA
                ================================================== */}

            <div
              className="
                flex
                items-center
                justify-between
                text-sm
              "
            >

              <label
                className="
                  flex
                  items-center
                  gap-2
                  text-foreground
                "
              >

                <input
                  type="checkbox"
                  checked={recordarme}
                  onChange={(e) =>
                    setRecordarme(
                      e.target.checked
                    )
                  }
                  className="
                    size-4
                    rounded
                    border-input
                    accent-blue-900
                  "
                />

                Recordarme

              </label>


              <Link
                to="/recuperar-contrasena"
                className="
                  font-medium
                  text-blue-900
                  hover:underline
                "
              >
                ¿Olvidaste tu contraseña?
              </Link>

            </div>


            {/* =================================================
                MENSAJE DE ERROR DEL BACKEND
                ================================================= */}

            {error && (

              <div
                className="
                  flex
                  items-start
                  gap-2
                  rounded-lg
                  border
                  border-destructive/25
                  bg-red-50
                  px-3
                  py-2
                  dark:border-destructive/30
                  dark:bg-red-500/10
                "
              >

                <TriangleAlertIcon
                  className="
                    mt-0.5
                    size-4
                    shrink-0
                    text-red-600
                    dark:text-red-400
                  "
                />


                <p
                  className="
                    whitespace-normal
                    text-sm
                    text-foreground
                  "
                >
                  {error}
                </p>

              </div>

            )}


            {/* =================================================
                BOTÓN INICIAR SESIÓN
                ================================================= */}

            <Button
              type="submit"
              className="
                h-11
                w-full
                bg-blue-950
                text-base
                hover:bg-blue-900
              "
              size="lg"
              disabled={
                enviando ||
                email === '' ||
                password === ''
              }
            >

              {enviando ? (
                <Spinner />
              ) : (
                <LogInIcon />
              )}

              {enviando
                ? 'Entrando…'
                : 'Iniciar sesión'}

            </Button>

          </form>


          {/* ==================================================
              SEPARADOR
              ================================================== */}

          <div className="my-0 flex items-center gap-3">

            <div className="h-px flex-1 bg-border" />

            <span className="text-xs text-muted-foreground">
              o continúa con
            </span>

            <div className="h-px flex-1 bg-border" />

          </div>


          {/* ==================================================
              OUTLOOK
              ================================================== */}

          <button
            type="button"
            className="
              flex
              h-11
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              border
              border-input
              text-sm
              font-medium
              text-blue-900
              transition-colors
              hover:bg-muted
            "
          >

            <LogoOutlook />

            Iniciar sesión con Outlook

          </button>

        </Card>

      </div>

    </div>
  );
}