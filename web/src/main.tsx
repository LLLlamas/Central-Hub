import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppStateProvider } from './state/AppState';
import { PdfViewerProvider } from './components/PdfViewer';
import { router } from './router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider>
      <PdfViewerProvider>
        <RouterProvider router={router} />
      </PdfViewerProvider>
    </AppStateProvider>
  </StrictMode>,
);
