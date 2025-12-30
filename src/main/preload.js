const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Cloudflared check
    checkCloudflared: () => ipcRenderer.invoke('cloudflared:check'),

    // Tunnel operations
    getTunnelStatus: () => ipcRenderer.invoke('tunnel:status'),
    listTunnels: () => ipcRenderer.invoke('tunnel:list'),
    startTunnel: (tunnelName) => ipcRenderer.invoke('tunnel:start', tunnelName),
    stopTunnel: () => ipcRenderer.invoke('tunnel:stop'),

    // Auth operations
    login: () => ipcRenderer.invoke('auth:login'),
    checkAuth: () => ipcRenderer.invoke('auth:check'),
    logout: () => ipcRenderer.invoke('auth:logout'),

    // Config operations
    getConfig: () => ipcRenderer.invoke('config:get'),
    saveConfig: (data) => ipcRenderer.invoke('config:save', data),

    // Shell operations
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),

    // Network operations
    checkPort: (host, port) => ipcRenderer.invoke('network:check-port', { host, port }),
    checkPortLsof: (port) => ipcRenderer.invoke('network:check-port-lsof', { port }),

    // DNS operations
    checkDns: (hostname) => ipcRenderer.invoke('dns:check', { hostname }),

    // DNS route operations
    routeDns: (tunnelId, hostname, overwrite = false) =>
        ipcRenderer.invoke('tunnel:route-dns', { tunnelId, hostname, overwrite }),
    deleteDns: (hostname) => ipcRenderer.invoke('tunnel:delete-dns', { hostname }),

    // Restart with retry
    restartTunnel: (options) => ipcRenderer.invoke('tunnel:restart', options || {}),

    // Event listeners
    onTunnelLog: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on('tunnel:log', subscription);
        return () => ipcRenderer.removeListener('tunnel:log', subscription);
    },
    onTunnelExit: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on('tunnel:exit', subscription);
        return () => ipcRenderer.removeListener('tunnel:exit', subscription);
    },
});
