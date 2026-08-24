import { useEffect, useRef, useState } from 'react';

export interface PosicionGPS {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export type EstadoGeolocalizacion =
  | 'inactivo'
  | 'buscando'
  | 'disponible'
  | 'error';

interface UseGeolocationResultado {
  estado: EstadoGeolocalizacion;
  error: string | null;
  /**
   * Referencia siempre actualizada con la última posición conocida.
   * Se lee directamente en el momento de capturar cada fotografía,
   * para que cada foto tenga su propio GPS (ver requisito de
   * "múltiples fotos" del proyecto).
   */
  posicionRef: React.MutableRefObject<PosicionGPS | null>;
}

/**
 * Observa la ubicación del dispositivo mientras `activo` sea true.
 *
 * Nunca bloquea: si el navegador no soporta geolocalización o el
 * usuario deniega el permiso, el estado pasa a 'error' y el resto
 * del flujo de cámara debe continuar generando la foto sin GPS.
 */
export function useGeolocation(activo: boolean): UseGeolocationResultado {
  const [estado, setEstado] = useState<EstadoGeolocalizacion>('inactivo');
  const [error, setError] = useState<string | null>(null);

  const posicionRef = useRef<PosicionGPS | null>(null);

  useEffect(() => {
    if (!activo) {
      setEstado('inactivo');
      return;
    }

    if (!navigator.geolocation) {
      setEstado('error');
      setError('Este navegador no soporta geolocalización.');
      return;
    }

    setEstado('buscando');
    setError(null);

    const watchId = navigator.geolocation.watchPosition(
      (posicionNavegador) => {
        posicionRef.current = {
          latitude: posicionNavegador.coords.latitude,
          longitude: posicionNavegador.coords.longitude,
          accuracy:
            typeof posicionNavegador.coords.accuracy === 'number'
              ? posicionNavegador.coords.accuracy
              : null,
          timestamp: posicionNavegador.timestamp,
        };

        setEstado('disponible');
        setError(null);
      },
      (err) => {
        setEstado('error');

        if (err.code === err.PERMISSION_DENIED) {
          setError('Permiso de ubicación denegado.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Ubicación no disponible.');
        } else {
          setError('No se pudo obtener la ubicación.');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activo]);

  return { estado, error, posicionRef };
}