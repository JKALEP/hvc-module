import { useEffect, useState } from 'react';

/** Devuelve el valor tras `delay` ms sin cambios. Útil para el buscador en tiempo real. */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
