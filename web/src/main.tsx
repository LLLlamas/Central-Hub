import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppStateProvider } from './state/AppState';
import { AuthProvider } from './state/AuthProvider';
import { AuthGate } from './components/auth/AuthGate';
import { PdfViewerProvider } from './components/PdfViewer';
import { router } from './router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <AppStateProvider>
          <PdfViewerProvider>
            <RouterProvider router={router} />
          </PdfViewerProvider>
        </AppStateProvider>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
);
