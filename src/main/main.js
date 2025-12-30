const { app, BrowserWindow, ipcMain, shell } = require('electron');
const net = require('net');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const yaml = require('js-yaml');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;
let tunnelProcess = null;

// Get cloudflared config path
const getConfigPath = () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  return path.join(homeDir, '.cloudflared', 'config.yml');
};

const getCloudflaredDir = () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  return path.join(homeDir, '.cloudflared');
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../../dist/renderer/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==================== IPC Handlers ====================

// Check if cloudflared is installed
ipcMain.handle('cloudflared:check', async () => {
  return new Promise((resolve) => {
    exec('which cloudflared || where cloudflared', (error, stdout) => {
      resolve({
        installed: !error && stdout.trim().length > 0,
        path: stdout.trim(),
      });
    });
  });
});

// Get tunnel status
ipcMain.handle('tunnel:status', async () => {
  return {
    running: tunnelProcess !== null && !tunnelProcess.killed,
    pid: tunnelProcess?.pid || null,
  };
});

// List tunnels
ipcMain.handle('tunnel:list', async () => {
  return new Promise((resolve) => {
    exec('cloudflared tunnel list --output json', (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message, tunnels: [] });
        return;
      }
      try {
        const tunnels = JSON.parse(stdout);
        resolve({ success: true, tunnels });
      } catch {
        resolve({ success: false, error: 'Failed to parse tunnel list', tunnels: [] });
      }
    });
  });
});

// Start tunnel
ipcMain.handle('tunnel:start', async (_, tunnelName) => {
  // Ensure previous process is fully cleaned up
  if (tunnelProcess) {
    if (!tunnelProcess.killed) {
      return { success: false, error: 'Tunnel is already running' };
    }
    // Clean up killed but not nullified process
    tunnelProcess = null;
  }

  return new Promise((resolve) => {
    const configPath = getConfigPath();
    const args = ['tunnel'];

    if (fs.existsSync(configPath)) {
      args.push('--config', configPath);
    }

    args.push('run');
    if (tunnelName) {
      args.push(tunnelName);
    }

    const proc = spawn('cloudflared', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    tunnelProcess = proc;
    let startupError = null;
    let resolved = false;

    const handleStartupError = (err) => {
      startupError = err.message;
    };

    const handleStartupExit = (code) => {
      if (startupError) return;
      startupError = `Process exited with code ${code}`;
    };

    // Temporary listeners for startup detection
    proc.once('error', handleStartupError);
    proc.on('exit', handleStartupExit);

    // Permanent listeners for logging
    proc.on('error', (err) => {
      mainWindow?.webContents.send('tunnel:log', { type: 'error', message: err.message });
    });

    proc.stdout?.on('data', (data) => {
      mainWindow?.webContents.send('tunnel:log', { type: 'stdout', message: data.toString() });
    });

    proc.stderr?.on('data', (data) => {
      mainWindow?.webContents.send('tunnel:log', { type: 'stderr', message: data.toString() });
    });

    // Handle process exit - only clean up if this is still the active process
    proc.on('exit', (code) => {
      mainWindow?.webContents.send('tunnel:exit', { code });
      // Only nullify if this process is still the current one
      if (tunnelProcess === proc) {
        tunnelProcess = null;
      }
    });

    // Give it a moment to start
    setTimeout(() => {
      if (resolved) return;
      resolved = true;

      proc.removeListener('error', handleStartupError);
      proc.removeListener('exit', handleStartupExit);

      if (proc && !proc.killed && tunnelProcess === proc) {
        resolve({
          success: true,
          pid: proc.pid,
        });
      } else {
        resolve({
          success: false,
          error: startupError || 'Process exited immediately',
        });
      }
    }, 1000);
  });
});

// Stop tunnel
ipcMain.handle('tunnel:stop', async () => {
  if (!tunnelProcess || tunnelProcess.killed) {
    tunnelProcess = null;
    return { success: true };
  }

  return new Promise((resolve) => {
    const proc = tunnelProcess;
    let resolved = false;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      tunnelProcess = null;
      resolve({ success: true });
    };

    // Use once to ensure we only handle exit once
    proc.once('exit', cleanup);

    proc.kill('SIGTERM');

    // Force kill after timeout
    setTimeout(() => {
      if (proc && !proc.killed) {
        proc.kill('SIGKILL');
      }
      cleanup();
    }, 5000);
  });
});

// Login to cloudflared
ipcMain.handle('auth:login', async () => {
  return new Promise((resolve) => {
    exec('cloudflared tunnel login', (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      resolve({ success: true, message: stdout });
    });
  });
});

// Check auth status
ipcMain.handle('auth:check', async () => {
  const certPath = path.join(getCloudflaredDir(), 'cert.pem');
  return {
    authenticated: fs.existsSync(certPath),
  };
});

// Logout (remove cert.pem)
ipcMain.handle('auth:logout', async () => {
  const certPath = path.join(getCloudflaredDir(), 'cert.pem');
  try {
    if (fs.existsSync(certPath)) {
      fs.unlinkSync(certPath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get config
ipcMain.handle('config:get', async () => {
  const configPath = getConfigPath();
  try {
    if (!fs.existsSync(configPath)) {
      return {
        success: true,
        config: null,
        raw: '',
        path: configPath,
      };
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(raw);
    return {
      success: true,
      config,
      raw,
      path: configPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      path: configPath,
    };
  }
});

// Save config
ipcMain.handle('config:save', async (_, { config, raw }) => {
  const configPath = getConfigPath();
  const configDir = getCloudflaredDir();

  try {
    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Backup existing config
    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.backup.${Date.now()}`;
      fs.copyFileSync(configPath, backupPath);
    }

    // Write new config
    const content = raw || yaml.dump(config);
    fs.writeFileSync(configPath, content, 'utf-8');

    return { success: true, path: configPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open external URL
ipcMain.handle('shell:openExternal', async (_, url) => {
  await shell.openExternal(url);
  return { success: true };
});

// Open path in file manager
ipcMain.handle('shell:openPath', async (_, filePath) => {
  try {
    await shell.openPath(path.dirname(filePath));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Route DNS for hostname (create CNAME record pointing to tunnel)
ipcMain.handle('tunnel:route-dns', async (_, { tunnelId, hostname, overwrite }) => {
  return new Promise((resolve) => {
    const args = ['tunnel', 'route', 'dns'];
    if (overwrite) {
      args.push('-f');
    }
    args.push(tunnelId, hostname);

    exec(`cloudflared ${args.join(' ')}`, (error, stdout, stderr) => {
      // cloudflared outputs to stderr for info messages
      const output = stderr || stdout || '';

      // Check for "already configured" message
      // e.g., "INF aa.followto.us is already configured to route to your tunnel"
      if (output.includes('is already configured to route to your tunnel')) {
        resolve({
          success: true,
          message: 'DNS record already configured',
          alreadyExists: true,
          status: 'configured'
        });
        return;
      }

      // Check for "Added CNAME" message
      // e.g., "INF Added CNAME bb.followto.us which will route to this tunnel"
      if (output.includes('Added CNAME') && output.includes('which will route to this tunnel')) {
        resolve({
          success: true,
          message: 'DNS CNAME record added successfully',
          alreadyExists: false,
          status: 'configured'
        });
        return;
      }

      // If there's an error
      if (error) {
        resolve({
          success: false,
          error: output || error.message,
          status: 'error'
        });
        return;
      }

      // Default success case
      resolve({
        success: true,
        message: output || 'DNS route configured',
        status: 'configured'
      });
    });
  });
});

// Delete DNS route for hostname
ipcMain.handle('tunnel:delete-dns', async (_, { hostname }) => {
  return new Promise((resolve) => {
    // cloudflared doesn't have a direct delete command, but we can use the Cloudflare API
    // For now, we'll just inform the user they need to manually delete from dashboard
    resolve({
      success: false,
      error: 'DNS record deletion requires manual action in Cloudflare Dashboard',
      manual: true
    });
  });
});

// Restart tunnel with retry logic
ipcMain.handle('tunnel:restart', async (_, { maxRetries = 3, retryDelay = 2000 }) => {
  const configPath = getConfigPath();

  // First, stop existing tunnel if running
  if (tunnelProcess && !tunnelProcess.killed) {
    const oldProc = tunnelProcess;
    tunnelProcess = null; // Clear reference before killing to prevent race conditions
    oldProc.kill('SIGTERM');
    // Wait for process to fully terminate
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (oldProc.killed || oldProc.exitCode !== null) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!oldProc.killed) {
          oldProc.kill('SIGKILL');
        }
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });
  }

  // Wait a bit for port to be released
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Try to start with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await new Promise((resolve) => {
      const args = ['tunnel'];
      if (fs.existsSync(configPath)) {
        args.push('--config', configPath);
      }
      args.push('run');

      const proc = spawn('cloudflared', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      tunnelProcess = proc;
      let startupError = null;
      let hasStarted = false;
      let resolved = false;

      const errorHandler = (err) => {
        startupError = err.message;
      };

      const exitHandler = (code) => {
        if (!hasStarted) {
          startupError = `Process exited with code ${code}`;
        }
      };

      proc.on('error', errorHandler);
      proc.once('exit', exitHandler);

      proc.on('error', (err) => {
        mainWindow?.webContents.send('tunnel:log', { type: 'error', message: err.message });
      });

      proc.stdout?.on('data', (data) => {
        const msg = data.toString();
        mainWindow?.webContents.send('tunnel:log', { type: 'stdout', message: msg });
        // Check for successful connection indicators
        if (msg.includes('Registered tunnel connection') || msg.includes('Connection registered')) {
          hasStarted = true;
        }
      });

      proc.stderr?.on('data', (data) => {
        const msg = data.toString();
        mainWindow?.webContents.send('tunnel:log', { type: 'stderr', message: msg });
        // Also check stderr for connection success (cloudflared logs to stderr)
        if (msg.includes('Registered tunnel connection') || msg.includes('Connection registered')) {
          hasStarted = true;
        }
      });

      // Handle process exit - only clean up if this is still the active process
      proc.on('exit', (code) => {
        mainWindow?.webContents.send('tunnel:exit', { code });
        if (tunnelProcess === proc) {
          tunnelProcess = null;
        }
      });

      // Give it time to start and establish connection
      setTimeout(() => {
        if (resolved) return;
        resolved = true;

        proc.removeListener('error', errorHandler);
        proc.removeListener('exit', exitHandler);

        if (proc && !proc.killed && tunnelProcess === proc) {
          resolve({
            success: true,
            pid: proc.pid,
          });
        } else {
          resolve({
            success: false,
            error: startupError || 'Process exited immediately',
          });
        }
      }, 2000);
    });

    if (result.success) {
      return { ...result, attempt };
    }

    // Log retry attempt
    mainWindow?.webContents.send('tunnel:log', {
      type: 'stderr',
      message: `Restart attempt ${attempt}/${maxRetries} failed: ${result.error}. ${attempt < maxRetries ? 'Retrying...' : 'Giving up.'}`
    });

    if (attempt < maxRetries) {
      // Clear tunnelProcess if failed, to allow retry
      tunnelProcess = null;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } else {
      return { success: false, error: `Failed after ${maxRetries} attempts: ${result.error}` };
    }
  }

  return { success: false, error: 'Unexpected error during restart' };
});

// Check local port
ipcMain.handle('network:check-port', async (_, { host, port }) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const cleanup = () => {
      socket.removeAllListeners('connect');
      socket.removeAllListeners('error');
      socket.removeAllListeners('timeout');
      socket.destroy();
    };

    socket.setTimeout(1000); // 1s timeout

    socket.once('connect', () => {
      cleanup();
      resolve({ reachable: true });
    });

    socket.once('error', () => {
      cleanup();
      resolve({ reachable: false });
    });

    socket.once('timeout', () => {
      cleanup();
      resolve({ reachable: false });
    });

    socket.connect(port, host);
  });
});

// Check if port is being listened on using lsof (faster than socket connect)
ipcMain.handle('network:check-port-lsof', async (_, { port }) => {
  return new Promise((resolve) => {
    // Use lsof to check if any process is listening on the port
    exec(`lsof -i :${port} -sTCP:LISTEN -P -n | grep LISTEN`, { timeout: 2000 }, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve({ listening: false, process: null });
        return;
      }
      // Parse process info from lsof output
      const lines = stdout.trim().split('\n');
      if (lines.length > 0) {
        const parts = lines[0].split(/\s+/);
        resolve({
          listening: true,
          process: parts[0] || 'unknown',
          pid: parts[1] || null
        });
      } else {
        resolve({ listening: false, process: null });
      }
    });
  });
});

// Check DNS resolution for hostname (fast method using dig)
ipcMain.handle('dns:check', async (_, { hostname }) => {
  return new Promise((resolve) => {
    // Use dig for fast DNS lookup with short timeout
    exec(`dig +short +time=2 +tries=1 ${hostname}`, { timeout: 3000 }, (error, stdout) => {
      if (error) {
        resolve({ resolved: false, error: error.message });
        return;
      }
      const result = stdout.trim();
      if (result && result.length > 0) {
        // Check if it resolves to cloudflare tunnel
        const isCloudflareTunnel = result.includes('cfargotunnel.com') ||
          result.includes('cloudflare') ||
          result.match(/^\d+\.\d+\.\d+\.\d+$/);
        resolve({
          resolved: true,
          addresses: result.split('\n').filter(a => a),
          isCloudflareTunnel
        });
      } else {
        resolve({ resolved: false, error: 'No DNS records found' });
      }
    });
  });
});

// ==================== App Lifecycle ====================

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Stop tunnel before quitting
  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill('SIGTERM');
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill('SIGTERM');
  }
});
