import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Ningún 4xx se reintenta: son errores del cliente y el resultado
      // sería idéntico. Con un 401/403 el token no va a mejorar solo y
      // reintentar retrasa la redirección al login; con un 404 el recurso
      // no va a aparecer. Además el reintento puede quedarse *pausado* si
      // el navegador se cree sin red, y entonces la consulta nunca llega a
      // estado de error y la pantalla se queda esperando para siempre.
      retry: (intentos, error: unknown) => {
        const estado = (error as { response?: { status?: number } })?.response
          ?.status;
        if (estado !== undefined && estado >= 400 && estado < 500) return false;
        return intentos < 1;
      },
      staleTime: 10_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* AuthProvider usa useQueryClient, así que va dentro del provider
            de Query y dentro del router. */}
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
