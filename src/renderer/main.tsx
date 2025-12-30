import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import App from './App';
import './i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <HashRouter>
            <ThemeProvider defaultTheme="dark" storageKey="cloudflared-ui-theme">
                <App />
                <Toaster />
            </ThemeProvider>
        </HashRouter>
    </React.StrictMode>
);
