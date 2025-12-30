import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, RefreshCw, FolderOpen } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/app-store';
import { useTheme } from '@/components/theme-provider';
import { toast } from 'sonner';

export default function Config() {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const [configText, setConfigText] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const { configRaw, configPath, setConfig, setLoading } = useAppStore();

    useEffect(() => {
        setConfigText(configRaw);
    }, [configRaw]);

    const handleRefresh = async () => {
        if (!window.electronAPI) return;

        setLoading(true);
        try {
            const configResult = await window.electronAPI.getConfig();
            if (configResult.success) {
                setConfig(configResult.config || null, configResult.raw || '', configResult.path);
                setConfigText(configResult.raw || '');
                toast.success('Config reloaded');
            } else {
                toast.error(configResult.error || 'Failed to load config');
            }
        } catch (error) {
            toast.error('Failed to load config');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!window.electronAPI) return;

        setIsSaving(true);
        try {
            const result = await window.electronAPI.saveConfig({ raw: configText });
            if (result.success) {
                toast.success(t('config.saved'));
                // Reload config to update state
                await handleRefresh();
            } else {
                toast.error(result.error || t('config.error'));
            }
        } catch (error) {
            toast.error(t('config.error'));
        } finally {
            setIsSaving(false);
        }
    };

    const isDarkTheme = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const handleOpenFolder = async () => {
        if (!window.electronAPI || !configPath) return;
        try {
            await window.electronAPI.openPath(configPath);
        } catch (error) {
            toast.error('Failed to open folder');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{t('config.title')}</h1>
                    <p className="text-muted-foreground">{t('config.description')}</p>
                </div>
            </div>

            {/* Config Editor */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">config.yml</CardTitle>
                            <CardDescription className="flex items-center gap-2">
                                {configPath}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={handleOpenFolder}
                                    title={t('config.openFolder')}
                                >
                                    <FolderOpen className="h-3.5 w-3.5" />
                                </Button>
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleRefresh} variant="outline" size="sm">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                {t('config.reload')}
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving} size="sm">
                                <Save className="h-4 w-4 mr-2" />
                                {t('config.save')}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-hidden">
                        <CodeMirror
                            value={configText}
                            height="500px"
                            extensions={[yaml()]}
                            theme={isDarkTheme ? oneDark : undefined}
                            onChange={(value) => setConfigText(value)}
                            basicSetup={{
                                lineNumbers: true,
                                foldGutter: true,
                                highlightActiveLine: true,
                            }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
