import { create } from 'zustand';
import type { CloudflaredConfig, IngressRule, TunnelStatus } from '@common/types/electron';

interface ProxyItem {
    id: string;
    hostname: string;
    localHost: string;
    localPort: number;
    service: string;
    status: 'active' | 'error' | 'stopped';
    localStatus: 'active' | 'error' | 'checking';
    dnsStatus: 'configured' | 'pending' | 'error' | 'checking';
}

export type { ProxyItem };

interface AppState {
    // Tunnel status
    tunnelStatus: TunnelStatus;
    setTunnelStatus: (status: TunnelStatus) => void;

    // Config
    config: CloudflaredConfig | null;
    configRaw: string;
    configPath: string;
    setConfig: (config: CloudflaredConfig | null, raw: string, path: string) => void;

    // Proxy items (parsed from config ingress rules)
    proxyItems: ProxyItem[];
    setProxyItems: (items: ProxyItem[]) => void;
    addProxyItem: (item: Omit<ProxyItem, 'id' | 'status' | 'localStatus' | 'dnsStatus'>) => void;
    updateProxyItem: (id: string, item: Partial<ProxyItem>) => void;
    removeProxyItem: (id: string) => void;
    checkAllProxyPorts: () => Promise<void>;
    checkAllDnsStatus: () => Promise<void>;
    updateDnsStatus: (id: string, status: ProxyItem['dnsStatus']) => void;

    // Auth status
    isAuthenticated: boolean;
    setAuthenticated: (status: boolean) => void;

    // Loading states
    isLoading: boolean;
    setLoading: (loading: boolean) => void;

    // Logs
    logs: string[];
    addLog: (log: string) => void;
    clearLogs: () => void;
}

// Helper to parse service URL
const parseServiceUrl = (service: string): { host: string; port: number } => {
    try {
        const url = new URL(service);
        return {
            host: url.hostname,
            port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
        };
    } catch {
        // Try to parse as host:port
        const match = service.match(/^(?:https?:\/\/)?([^:]+):?(\d+)?/);
        if (match) {
            return {
                host: match[1] || 'localhost',
                port: parseInt(match[2]) || 80,
            };
        }
        return { host: 'localhost', port: 80 };
    }
};

// Convert ingress rules to proxy items
const ingressToProxyItems = (ingress: IngressRule[] | undefined, isRunning: boolean): ProxyItem[] => {
    if (!ingress) return [];

    return ingress
        .filter((rule) => rule.hostname) // Skip catch-all rules
        .map((rule, index) => {
            const { host, port } = parseServiceUrl(rule.service);
            return {
                id: `ingress-${index}`,
                hostname: rule.hostname || '',
                localHost: host,
                localPort: port,
                service: rule.service,
                status: isRunning ? 'active' : 'stopped',
                localStatus: 'checking',
                dnsStatus: 'checking',
            };
        });
};

// Convert proxy items back to ingress rules
export const proxyItemsToIngress = (items: ProxyItem[]): IngressRule[] => {
    const rules: IngressRule[] = items.map((item) => ({
        hostname: item.hostname,
        service: item.service || `http://${item.localHost}:${item.localPort}`,
    }));

    // Always add catch-all rule at the end
    rules.push({ service: 'http_status:404' });

    return rules;
};

export const useAppStore = create<AppState>((set, get) => ({
    // Tunnel status
    tunnelStatus: { running: false, pid: null },
    setTunnelStatus: (status) => {
        set({ tunnelStatus: status });
        // Update proxy items status based on tunnel status
        const { proxyItems, checkAllProxyPorts, checkAllDnsStatus } = get();
        set({
            proxyItems: proxyItems.map((item) => ({
                ...item,
                status: status.running ? 'active' : 'stopped',
            })),
        });
        // Check ports and DNS when tunnel starts
        if (status.running) {
            checkAllProxyPorts();
            // Delay DNS check slightly to ensure tunnel is fully connected
            setTimeout(() => {
                checkAllDnsStatus();
            }, 1000);
        }
    },

    // Config
    config: null,
    configRaw: '',
    configPath: '',
    setConfig: (config, raw, path) => {
        set({ config, configRaw: raw, configPath: path });
        // Parse ingress rules to proxy items
        if (config?.ingress) {
            const { tunnelStatus, checkAllProxyPorts } = get();
            const items = ingressToProxyItems(config.ingress, tunnelStatus.running);
            set({ proxyItems: items });
            checkAllProxyPorts();
        }
    },

    // Proxy items
    proxyItems: [],
    setProxyItems: (items) => set({ proxyItems: items }),
    addProxyItem: (item) => {
        const { proxyItems, tunnelStatus, checkAllProxyPorts } = get();
        const newItem: ProxyItem = {
            ...item,
            id: `ingress-${Date.now()}`,
            status: tunnelStatus.running ? 'active' : 'stopped',
            localStatus: 'checking',
            dnsStatus: 'pending',
        };
        set({ proxyItems: [...proxyItems, newItem] });
        checkAllProxyPorts();
    },
    updateProxyItem: (id, item) => {
        const { proxyItems, checkAllProxyPorts } = get();
        set({
            proxyItems: proxyItems.map((p) => (p.id === id ? { ...p, ...item } : p)),
        });
        checkAllProxyPorts();
    },
    removeProxyItem: (id) => {
        const { proxyItems } = get();
        set({ proxyItems: proxyItems.filter((p) => p.id !== id) });
    },
    checkAllProxyPorts: async () => {
        const { proxyItems, tunnelStatus } = get();
        // Only check ports when tunnel is running
        if (!tunnelStatus.running) {
            // Reset all to stopped status when tunnel is not running
            set({
                proxyItems: proxyItems.map((item) => ({
                    ...item,
                    localStatus: 'checking',
                    status: 'stopped',
                })),
            });
            return;
        }
        // Use lsof for faster port checking (parallel)
        const checkedItems = await Promise.all(
            proxyItems.map(async (item) => {
                const { listening } = await window.electronAPI.checkPortLsof(item.localPort);
                return {
                    ...item,
                    localStatus: listening ? 'active' : 'error',
                } as ProxyItem;
            })
        );
        set({ proxyItems: checkedItems });
    },
    checkAllDnsStatus: async () => {
        const { proxyItems, config, tunnelStatus } = get();
        // Only check DNS when tunnel is running
        if (!tunnelStatus.running || !config?.tunnel) {
            // Reset all DNS status when tunnel is not running
            set({
                proxyItems: proxyItems.map((item) => ({
                    ...item,
                    dnsStatus: 'pending',
                })),
            });
            return;
        }

        // Set all to checking first
        set({
            proxyItems: proxyItems.map((item) => ({
                ...item,
                dnsStatus: 'checking',
            })),
        });

        // Use cloudflared route dns with overwrite flag (-f)
        // Check each hostname sequentially and update status immediately
        for (const item of proxyItems) {
            try {
                // Use overwrite mode to ensure DNS is configured
                const routeResult = await window.electronAPI.routeDns(config.tunnel!, item.hostname, true);
                // Update this item's status immediately
                const { proxyItems: currentItems } = get();
                set({
                    proxyItems: currentItems.map((p) =>
                        p.id === item.id
                            ? { ...p, dnsStatus: routeResult.success ? 'configured' as const : 'error' as const }
                            : p
                    ),
                });
            } catch {
                // Update this item's status to error
                const { proxyItems: currentItems } = get();
                set({
                    proxyItems: currentItems.map((p) =>
                        p.id === item.id ? { ...p, dnsStatus: 'error' as const } : p
                    ),
                });
            }
        }
    },
    updateDnsStatus: (id, status) => {
        const { proxyItems } = get();
        set({
            proxyItems: proxyItems.map((p) => (p.id === id ? { ...p, dnsStatus: status } : p)),
        });
    },

    // Auth status
    isAuthenticated: false,
    setAuthenticated: (status) => set({ isAuthenticated: status }),

    // Loading states
    isLoading: false,
    setLoading: (loading) => set({ isLoading: loading }),

    // Logs
    logs: [],
    addLog: (log) => {
        const { logs } = get();
        set({ logs: [...logs.slice(-100), log] }); // Keep last 100 logs
    },
    clearLogs: () => set({ logs: [] }),
}));
