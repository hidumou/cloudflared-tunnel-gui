import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import Dashboard from '@/pages/Dashboard';
import Config from '@/pages/Config';
import Settings from '@/pages/Settings';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

function CloudflaredNotInstalled() {
    const { t } = useTranslation();

    const handleInstall = () => {
        window.electronAPI?.openExternal('https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-background/80">
            <div className="text-center space-y-4 p-8 max-w-md">
                <h2 className="text-2xl font-bold">{t('app.cloudflaredRequired')}</h2>
                <p className="text-muted-foreground">{t('app.cloudflaredNotInstalled')}</p>
                <Button onClick={handleInstall} className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {t('app.installCloudflared')}
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                    {t('app.installHint')}
                </p>
            </div>
        </div>
    );
}

function App() {
    const [cloudflaredInstalled, setCloudflaredInstalled] = useState<boolean | null>(null);

    useEffect(() => {
        const checkCloudflared = async () => {
            if (!window.electronAPI) return;
            try {
                const result = await window.electronAPI.checkCloudflared();
                setCloudflaredInstalled(result.installed);
            } catch (error) {
                console.error('Failed to check cloudflared:', error);
                setCloudflaredInstalled(false);
            }
        };
        checkCloudflared();
    }, []);

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full">
                <AppSidebar />
                <main className="relative flex-1 p-6">
                    <div className="drag-region absolute top-0 left-0 right-0 h-8 z-50" />
                    {cloudflaredInstalled === false && <CloudflaredNotInstalled />}
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/config" element={<Config />} />
                        <Route path="/settings" element={<Settings />} />
                    </Routes>
                </main>
            </div>
        </SidebarProvider>
    );
}

export default App;
