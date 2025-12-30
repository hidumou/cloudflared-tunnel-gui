// Type definitions for the Electron API exposed via preload

export interface TunnelStatus {
    running: boolean;
    pid: number | null;
}

export interface Tunnel {
    id: string;
    name: string;
    created_at: string;
    deleted_at?: string;
    connections?: TunnelConnection[];
}

export interface TunnelConnection {
    colo_name: string;
    id: string;
    is_pending_reconnect: boolean;
    origin_ip: string;
    opened_at: string;
}

export interface TunnelListResult {
    success: boolean;
    error?: string;
    tunnels: Tunnel[];
}

export interface IngressRule {
    hostname?: string;
    path?: string;
    service: string;
    originRequest?: {
        connectTimeout?: string;
        noTLSVerify?: boolean;
        httpHostHeader?: string;
    };
}

export interface CloudflaredConfig {
    tunnel?: string;
    'credentials-file'?: string;
    logDirectory?: string;
    loglevel?: string;
    ingress?: IngressRule[];
    'warp-routing'?: {
        enabled?: boolean;
    };
}

export interface ConfigResult {
    success: boolean;
    config?: CloudflaredConfig | null;
    raw?: string;
    path: string;
    error?: string;
}

export interface CloudflaredCheckResult {
    installed: boolean;
    path: string;
}

export interface AuthCheckResult {
    authenticated: boolean;
}

export interface OperationResult {
    success: boolean;
    error?: string;
    message?: string;
    pid?: number;
    path?: string;
    attempt?: number;
}

export interface DnsRouteResult {
    success: boolean;
    error?: string;
    message?: string;
    alreadyExists?: boolean;
    manual?: boolean;
    status?: 'configured' | 'error';
}

export interface TunnelLogData {
    type: 'stdout' | 'stderr' | 'error';
    message: string;
}

export interface TunnelExitData {
    code: number | null;
}

export interface ElectronAPI {
    // Cloudflared check
    checkCloudflared: () => Promise<CloudflaredCheckResult>;

    // Tunnel operations
    getTunnelStatus: () => Promise<TunnelStatus>;
    listTunnels: () => Promise<TunnelListResult>;
    startTunnel: (tunnelName?: string) => Promise<OperationResult>;
    stopTunnel: () => Promise<OperationResult>;

    // Auth operations
    login: () => Promise<OperationResult>;
    checkAuth: () => Promise<AuthCheckResult>;
    logout: () => Promise<OperationResult>;

    // Config operations
    getConfig: () => Promise<ConfigResult>;
    saveConfig: (data: { config?: CloudflaredConfig; raw?: string }) => Promise<OperationResult>;

    // Shell operations
    openExternal: (url: string) => Promise<OperationResult>;
    openPath: (filePath: string) => Promise<OperationResult>;

    // Network operations
    checkPort: (host: string, port: number) => Promise<{ reachable: boolean }>;
    checkPortLsof: (port: number) => Promise<{ listening: boolean; process: string | null; pid?: string | null }>;

    // DNS check (fast)
    checkDns: (hostname: string) => Promise<{ resolved: boolean; addresses?: string[]; isCloudflareTunnel?: boolean; error?: string }>;

    // DNS route operations
    routeDns: (tunnelId: string, hostname: string, overwrite?: boolean) => Promise<DnsRouteResult>;
    deleteDns: (hostname: string) => Promise<DnsRouteResult>;

    // Restart with retry
    restartTunnel: (options?: { maxRetries?: number; retryDelay?: number }) => Promise<OperationResult>;

    // Event listeners
    onTunnelLog: (callback: (data: TunnelLogData) => void) => () => void;
    onTunnelExit: (callback: (data: TunnelExitData) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

export { };
