import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './state/AuthProvider';
import { AuthGate } from './components/auth/AuthGate';
import { PdfViewerProvider } from './components/PdfViewer';
import { MigrationGate } from './components/MigrationGate';
import { router } from './router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MigrationGate>
      <AuthProvider>
        <AuthGate>
          <PdfViewerProvider>
            <RouterProvider router={router} />
          </PdfViewerProvider>
        </AuthGate>
      </AuthProvider>
    </MigrationGate>
  </StrictMode>,
);
