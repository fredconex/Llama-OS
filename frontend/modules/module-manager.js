// Module Management System
class ModuleManager {
    constructor(desktop) {
        this.desktop = desktop;
        this.debugConsole = null;
        this.consoleHoldTimer = null;
        this.originalConsole = null;
        
        this.setupDebugConsole();
    }
    
    setupDebugConsole() {
        // Listen for Ctrl+Shift+D to open debug console
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.createDebugConsole();
            }
        });
        
        // Listen for long press on about button
        const aboutButton = document.getElementById('about-btn');
        if (aboutButton) {
            aboutButton.addEventListener('mousedown', () => {
                this.consoleHoldTimer = setTimeout(() => {
                    this.createDebugConsole();
                }, 2000);
            });
            
            aboutButton.addEventListener('mouseup', () => {
                if (this.consoleHoldTimer) {
                    clearTimeout(this.consoleHoldTimer);
                    this.consoleHoldTimer = null;
                }
            });
            
            aboutButton.addEventListener('mouseleave', () => {
                if (this.consoleHoldTimer) {
                    clearTimeout(this.consoleHoldTimer);
                    this.consoleHoldTimer = null;
                }
            });
        }
    }

    createDebugConsole() {
        if (this.debugConsole) {
            this.toggleDebugConsole();
            return;
        }

        console.log('Creating debug console...');
        
        this.debugConsole = document.createElement('div');
        this.debugConsole.id = 'debug-console';
        this.debugConsole.className = 'debug-console';
        this.debugConsole.innerHTML = `
            <div class="debug-console-header">
                <span class="debug-console-title"><span class="material-icons">bug_report</span> Debug Console</span>
                <div class="debug-console-controls">
                    <button class="debug-console-btn" onclick="moduleManager.clearDebugConsole()" title="Clear">
                        <span class="material-icons">clear</span>
                    </button>
                    <button class="debug-console-btn" onclick="moduleManager.toggleDebugConsole()" title="Hide">
                        <span class="material-icons">close</span>
                    </button>
                </div>
            </div>
            <div class="debug-console-content" id="debug-console-content">
                <div class="debug-line info">Debug console activated</div>
                <div class="debug-line info">Press Ctrl+Shift+D to toggle</div>
                <div class="debug-line info">Terminal Manager Status: ${window.terminalManager ? 'Initialized' : 'Not Initialized'}</div>
                <div class="debug-line info">Properties Manager Status: ${window.propertiesManager ? 'Initialized' : 'Not Initialized'}</div>
                <div class="debug-line info">Download Manager Status: ${window.downloadManager ? 'Initialized' : 'Not Initialized'}</div>
                <div class="debug-line info">HuggingFace App Status: ${window.huggingFaceApp ? 'Initialized' : 'Not Initialized'}</div>
                <div class="debug-line info">Llama.cpp Releases Manager Status: ${window.llamacppReleasesManager ? 'Initialized' : 'Not Initialized'}</div>
            </div>
        `;
        
        // Apply styles
        this.debugConsole.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            width: 400px;
            height: 300px;
            background: var(--theme-bg-primary);
            border: 1px solid var(--theme-border);
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            color: var(--theme-text-primary);
        `;
        
        document.body.appendChild(this.debugConsole);
        
        // Override console methods to capture output
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn
        };
        
        console.log = (...args) => {
            this.originalConsole.log(...args);
            this.addToDebugConsole('log', args.join(' '));
        };
        
        console.error = (...args) => {
            this.originalConsole.error(...args);
            this.addToDebugConsole('error', args.join(' '));
        };
        
        console.warn = (...args) => {
            this.originalConsole.warn(...args);
            this.addToDebugConsole('warn', args.join(' '));
        };
        
        this.desktop.showNotification('Debug console activated', 'info');
    }

    addToDebugConsole(type, message) {
        if (!this.debugConsole) return;
        
        const content = document.getElementById('debug-console-content');
        if (content) {
            const line = document.createElement('div');
            line.className = `debug-line ${type}`;
            line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            content.appendChild(line);
            content.scrollTop = content.scrollHeight;
            
            // Limit to 100 lines
            while (content.children.length > 100) {
                content.removeChild(content.firstChild);
            }
        }
    }

    toggleDebugConsole() {
        if (this.debugConsole) {
            if (this.debugConsole.style.display === 'none') {
                this.debugConsole.style.display = 'block';
            } else {
                this.debugConsole.style.display = 'none';
            }
        }
    }

    clearDebugConsole() {
        const content = document.getElementById('debug-console-content');
        if (content) {
            content.innerHTML = '<div class="debug-line info">Debug console cleared</div>';
        }
    }

    destroyDebugConsole() {
        if (this.debugConsole) {
            // Restore original console methods
            if (this.originalConsole) {
                console.log = this.originalConsole.log;
                console.error = this.originalConsole.error;
                console.warn = this.originalConsole.warn;
            }
            
            this.debugConsole.remove();
            this.debugConsole = null;
            this.desktop.showNotification('Debug console deactivated', 'info');
        }
    }

    getModuleStatus() {
        return {
            terminalManager: !!window.terminalManager,
            propertiesManager: !!window.propertiesManager,
            downloadManager: !!window.downloadManager,
            huggingFaceApp: !!window.huggingFaceApp,
            llamacppReleasesManager: !!window.llamacppReleasesManager,
            globalStatus: 'All modules loaded'
        };
    }
    
    forceReinitializeModule(moduleName) {
        console.log(`Force reinitializing ${moduleName}...`);
        
        try {
            let ManagerClass;
            let success = false;
            
            switch (moduleName) {
                case 'terminalManager':
                    ManagerClass = window.TerminalManager;
                    if (ManagerClass) {
                        window.terminalManager = new ManagerClass(this.desktop);
                        success = !!window.terminalManager;
                        if (success) {
                            console.log('✓ Terminal manager reinitialized successfully');
                        }
                    }
                    break;
                case 'downloadManager':
                    ManagerClass = window.DownloadManager;
                    if (ManagerClass) {
                        window.downloadManager = new ManagerClass(this.desktop);
                        success = !!window.downloadManager;
                        if (success) {
                            console.log('✓ Download manager reinitialized successfully');
                        }
                    }
                    break;
                case 'propertiesManager':
                    ManagerClass = window.PropertiesManager;
                    if (ManagerClass) {
                        window.propertiesManager = new ManagerClass(this.desktop);
                        success = !!window.propertiesManager;
                        if (success) {
                            console.log('✓ Properties manager reinitialized successfully');
                        }
                    }
                    break;
                default:
                    console.error(`Unknown module: ${moduleName}`);
                    return false;
            }
            
            return success;
        } catch (error) {
            console.error(`Error reinitializing ${moduleName}:`, error);
            return false;
        }
    }
}

// Global debugging functions
window.checkModuleStatus = () => {
    if (window.moduleManager && typeof window.moduleManager.getModuleStatus === 'function') {
        const status = window.moduleManager.getModuleStatus();
        console.log('=== Module Status ===');
        console.log('Terminal Manager:', status.terminalManager ? '✓ Ready' : '✗ Not Ready');
        console.log('Properties Manager:', status.propertiesManager ? '✓ Ready' : '✗ Not Ready');
        console.log('Download Manager:', status.downloadManager ? '✓ Ready' : '✗ Not Ready');
        console.log('Llama.cpp Releases Manager:', status.llamacppReleasesManager ? '✓ Ready' : '✗ Not Ready');
        console.log('HuggingFace App:', status.huggingFaceApp ? '✓ Ready' : '✗ Not Ready');
        console.log('Global Status:', status.globalStatus);
        console.log('===================');
        return status;
    } else {
        console.error('Module manager not ready or getModuleStatus method not available');
        return null;
    }
};

window.forceReinitModule = (moduleName) => {
    if (window.moduleManager && typeof window.moduleManager.forceReinitializeModule === 'function') {
        return window.moduleManager.forceReinitializeModule(moduleName);
    } else {
        console.error('Module manager not ready or forceReinitializeModule method not available');
        return false;
    }
};

// Debug: Confirm ModuleManager class is loaded
console.log('ModuleManager class loaded successfully');
window.ModuleManager = ModuleManager;
