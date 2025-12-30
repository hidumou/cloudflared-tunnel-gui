import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Square, RefreshCw, Plus, Circle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore, proxyItemsToIngress } from '@/store/app-store';
import { ProxyTable } from '@/components/proxy-table';
import { ProxyFormDialog } from '@/components/proxy-form-dialog';
import { toast } from 'sonner';

function LogViewer() {
    const logs = useAppStore(state => state.logs);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div ref={scrollRef} className="bg-black/90 text-white p-4 rounded-md h-64 overflow-y-auto font-mono text-xs whitespace-pre-wrap">
            {logs.length === 0 ? (
                <span className="text-gray-500">No logs yet...</span>
            ) : (
                logs.map((log, i) => (
                    <div key={i} className="border-b border-gray-800 last:border-0 pb-0.5 mb-0.5 break-all">
                        {log}
                    </div>
                ))
            )}
        </div>
    );
}

export default function Dashboard() {
    const { t } = useTranslation();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const {
        tunnelStatus,
        setTunnelStatus,
        proxyItems,
        configPath,
        setConfig,
        addProxyItem,
        updateProxyItem,
        removeProxyItem,
        isLoading,
        setLoading,
        addLog,
        checkAllDnsStatus,
    } = useAppStore();

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            if (!window.electronAPI) return;

            setLoading(true);
            try {
                // Get tunnel status
                const status = await window.electronAPI.getTunnelStatus();
                setTunnelStatus(status);

                // Get config
                const configResult = await window.electronAPI.getConfig();
                if (configResult.success) {
                    setConfig(configResult.config || null, configResult.raw || '', configResult.path);
                }
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [setTunnelStatus, setConfig, setLoading]);

    // Subscribe to tunnel logs
    useEffect(() => {
        if (!window.electronAPI) return;

        const unsubLog = window.electronAPI.onTunnelLog((data) => {
            addLog(`[${data.type}] ${data.message}`);
        });

        const unsubExit = window.electronAPI.onTunnelExit((data) => {
            addLog(`[exit] Tunnel exited with code ${data.code}`);
            setTunnelStatus({ running: false, pid: null });
        });

        return () => {
            unsubLog();
            unsubExit();
        };
    }, [addLog, setTunnelStatus]);

    const handleStartTunnel = async () => {
        if (!window.electronAPI) return;

        setLoading(true);
        try {
            const result = await window.electronAPI.startTunnel();
            if (result.success) {
                setTunnelStatus({ running: true, pid: result.pid || null });
                toast.success(t('dashboard.running'));
            } else {
                toast.error(result.error || 'Failed to start tunnel');
            }
        } catch (error) {
            toast.error('Failed to start tunnel');
        } finally {
            setLoading(false);
        }
    };

    const handleStopTunnel = async () => {
        if (!window.electronAPI) return;

        setLoading(true);
        try {
            const result = await window.electronAPI.stopTunnel();
            if (result.success) {
                setTunnelStatus({ running: false, pid: null });
                toast.success(t('dashboard.stopped'));
            } else {
                toast.error(result.error || 'Failed to stop tunnel');
            }
        } catch (error) {
            toast.error('Failed to stop tunnel');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        if (!window.electronAPI) return;

        setLoading(true);
        try {
            const status = await window.electronAPI.getTunnelStatus();
            setTunnelStatus(status);

            const configResult = await window.electronAPI.getConfig();
            if (configResult.success) {
                setConfig(configResult.config || null, configResult.raw || '', configResult.path);
            }
            toast.success('Refreshed');
        } catch (error) {
            toast.error('Failed to refresh');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!window.electronAPI) return;

        // Get fresh state
        const { config, proxyItems, tunnelStatus, updateDnsStatus } = useAppStore.getState();
        if (!config) return;

        const newIngress = proxyItemsToIngress(proxyItems);
        const newConfig = { ...config, ingress: newIngress };

        try {
            const result = await window.electronAPI.saveConfig({ config: newConfig });
            if (result.success) {
                toast.success(t('config.saved'));

                // Route DNS for ALL hostnames if tunnel ID is available
                if (config.tunnel && proxyItems.length > 0) {
                    toast.info(t('dns.configuringAll'));

                    // Set all to checking state
                    for (const item of proxyItems) {
                        updateDnsStatus(item.id, 'checking');
                    }

                    // Configure DNS for each hostname
                    for (const item of proxyItems) {
                        try {
                            const dnsResult = await window.electronAPI.routeDns(config.tunnel, item.hostname);
                            if (dnsResult.success) {
                                updateDnsStatus(item.id, 'configured');
                                addLog(`[dns] ${item.hostname}: ${dnsResult.alreadyExists ? 'already configured' : 'configured successfully'}`);
                            } else {
                                updateDnsStatus(item.id, 'error');
                                addLog(`[dns] ${item.hostname}: failed - ${dnsResult.error}`);
                            }
                        } catch (dnsError) {
                            updateDnsStatus(item.id, 'error');
                            addLog(`[dns] ${item.hostname}: error - ${dnsError}`);
                        }
                    }
                    toast.success(t('dns.configuredAll'));
                }

                // Reload tunnel if running using improved restart logic
                if (tunnelStatus.running) {
                    toast.info('Restarting tunnel to apply changes...');
                    const restartResult = await window.electronAPI.restartTunnel({
                        maxRetries: 3,
                        retryDelay: 2000
                    });
                    if (restartResult.success) {
                        setTunnelStatus({ running: true, pid: restartResult.pid || null });
                        if (restartResult.attempt && restartResult.attempt > 1) {
                            toast.success(`Tunnel restarted (attempt ${restartResult.attempt})`);
                        } else {
                            toast.success(t('dashboard.running'));
                        }
                    } else {
                        setTunnelStatus({ running: false, pid: null });
                        toast.error(restartResult.error || 'Failed to restart tunnel');
                    }
                }
            } else {
                toast.error(result.error || t('config.error'));
            }
        } catch (error) {
            toast.error(t('config.error'));
        }
    };

    const handleAddItem = (data: { hostname: string; localHost: string; localPort: number }) => {
        addProxyItem({
            hostname: data.hostname,
            localHost: data.localHost,
            localPort: data.localPort,
            service: `http://${data.localHost}:${data.localPort}`,
        });
        setIsFormOpen(false);
        // Save config and route DNS for all hostnames
        handleSaveConfig();
    };

    const handleEditItem = (data: { hostname: string; localHost: string; localPort: number }) => {
        if (!editingId) return;

        updateProxyItem(editingId, {
            hostname: data.hostname,
            localHost: data.localHost,
            localPort: data.localPort,
            service: `http://${data.localHost}:${data.localPort}`,
        });
        setEditingId(null);
        setIsFormOpen(false);
        // Save config and route DNS for all hostnames
        handleSaveConfig();
    };

    const handleDeleteItem = (id: string) => {
        removeProxyItem(id);
        // No new hostnames when deleting
        handleSaveConfig();
    };

    const handleOpenEdit = (id: string) => {
        setEditingId(id);
        setIsFormOpen(true);
    };

    const editingItem = editingId ? proxyItems.find((p) => p.id === editingId) : undefined;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
                    <p className="text-muted-foreground">{t('dashboard.description')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={tunnelStatus.running ? 'default' : 'secondary'} className="gap-1">
                        <Circle className={`h-2 w-2 fill-current ${tunnelStatus.running ? 'text-green-500' : 'text-gray-400'}`} />
                        {tunnelStatus.running ? t('dashboard.running') : t('dashboard.stopped')}
                    </Badge>
                </div>
            </div>

            {/* Controls */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t('dashboard.status')}</CardTitle>
                    <CardDescription>
                        {configPath && `Config: ${configPath}`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        {tunnelStatus.running ? (
                            <Button onClick={handleStopTunnel} disabled={isLoading} variant="destructive">
                                <Square className="h-4 w-4 mr-2" />
                                {t('dashboard.stop')}
                            </Button>
                        ) : (
                            <Button onClick={handleStartTunnel} disabled={isLoading}>
                                <Play className="h-4 w-4 mr-2" />
                                {t('dashboard.start')}
                            </Button>
                        )}
                        {
                            tunnelStatus.running && (
                                <Button onClick={handleRefresh} disabled={isLoading} variant="outline">
                                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                    {t('dashboard.refresh')}
                                </Button>
                            )
                        }
                        <Button onClick={() => useAppStore.getState().clearLogs()} variant="outline" size="icon" title="Clear Logs">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Proxy List */}
            <Card className="relative">
                {/* Blur overlay when tunnel is not running */}
                {!tunnelStatus.running && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm bg-background/50 rounded-lg">
                        <p className="text-muted-foreground font-medium">{t('dashboard.tunnelNotRunning')}</p>
                    </div>
                )}
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{t('dashboard.title')}</CardTitle>
                        <Button onClick={() => { setEditingId(null); setIsFormOpen(true); }} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            {t('dashboard.addRule')}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <ProxyTable
                        items={proxyItems}
                        onEdit={handleOpenEdit}
                        onDelete={handleDeleteItem}
                    />
                </CardContent>
            </Card>

            {/* Logs */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    <LogViewer />
                </CardContent>
            </Card>

            {/* Form Dialog */}
            <ProxyFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSubmit={editingId ? handleEditItem : handleAddItem}
                defaultValues={editingItem}
                isEditing={!!editingId}
            />
        </div>
    );
}
