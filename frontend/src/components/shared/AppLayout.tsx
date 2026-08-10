import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';

// Layout general: sidebar fijo + área de contenido.
export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-60">
        <div className="mx-auto max-w-[1600px] px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
