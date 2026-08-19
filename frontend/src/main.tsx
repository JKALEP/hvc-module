import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import './index.css';
import App from './App.tsx';

import { Toaster } from '@/shared/ui/sonner';
import { AuthProvider } from '@/modules/auth/context/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,

      retry: (intentos, error: unknown) => {
        const estado = (error as { response?: { status?: number } })?.response
          ?.status;

        if (estado !== undefined && estado >= 400 && estado < 500) {
          return false;
        }

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
        <AuthProvider>
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>

      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);