// Terminal Management Module
// Tauri API will be accessed when needed to prevent loading issues
class TerminalManager {
    constructor(desktop) {
        this.desktop = desktop;
        this.terminals = new Map(); // Store terminal instances
        this.terminalCounter = 0;
        
        // Initialize Tauri API access
        this.invoke = null;
        this.initTauriAPI();
    }
    
    initTauriAPI() {
        try {
            if (window.__TAURI__ && window.__TAURI__.core) {
                this.invoke = window.__TAURI__.core.invoke;
                console.log('Tauri API initialized in TerminalManager');
            } else {
                console.warn('Tauri API not available yet, will retry when needed');
            }
        } catch (error) {
            console.error('Failed to initialize Tauri API:', error);
        }
    }
    
    getInvoke() {
        if (!this.invoke) {
            this.initTauriAPI();
        }
        return this.invoke;
    }

    async openServerTerminal(processId, modelName, host, port, modelPath, activeVersion) {
        console.log('OpenServerTerminal called with:', { processId, modelName, host, port, modelPath, activeVersion });
    
        const windowId = `server_${processId}`;
        console.log('Creating terminal window with ID:', windowId);
    
        const content = `
            <div class="server-terminal-container">
                <div class="server-info">
                    <span class="server-status starting"><span class="material-icons" style="color: #ffc107; font-size: 14px;">circle</span> Starting</span>
                    <span class="server-details">${modelName} - <span class="clickable" style="cursor: pointer; text-decoration: underline;" onclick="terminalManager.openUrl('http://${host}:${port}')">${host}:${port}</span><button class="copy-link-btn" style="background: none; border: none; cursor: pointer; margin-left: 5px; padding: 0; font-size: 14px; vertical-align: middle;" onclick="terminalManager.copyToClipboard('http://${host}:${port}', this)" title="Copy link"><span class="material-icons" style="font-size: 14px; color: var(--theme-text-muted);">content_copy</span></button></span>
                    <div class="server-controls">
                        <button class="server-btn" id="chat-btn-${windowId}"><span class="material-icons">chat</span> Chat</button>
                        <button class="server-btn stop-btn" id="stop-btn-${windowId}"><span class="material-icons">stop</span> Stop</button>
                    </div>
                </div>
                <div class="server-output" id="server-output-${windowId}"><div class="server-line server-system">Starting ${modelName}...</div><div class="server-line server-system">Process ID: ${processId}</div><div class="server-line server-system">Server will be available at: ${host}:${port}</span></div><div class="server-line server-system">Waiting for server output...</div></div>
            </div>
        `;
    
        console.log('Calling desktop.createWindow...');
        const window = this.desktop.createWindow(windowId, `Server - ${modelName} (Build: ${activeVersion})`, 'server-terminal-window', content);
        console.log('Desktop.createWindow returned:', window);
    
        // Ensure the window is visible and not hidden
        if (window) {
            console.log('Making window visible...');
            window.classList.remove('hidden');
            window.style.display = 'block';
            // Bring to front
            window.style.zIndex = this.desktop.windowZIndex + 1;
            this.desktop.windowZIndex += 1;
            
            console.log('Window after visibility setup:', {
                id: window.id,
                display: window.style.display,
                visibility: window.style.visibility,
                zIndex: window.style.zIndex,
                classList: Array.from(window.classList)
            });
        } else {
            console.error('Failed to create terminal window!');
            return null;
        }

        // Store model info for this terminal
        this.terminals.set(windowId, {
            processId,
            modelName,
            modelPath,
            host,
            port,
            status: 'starting',
            output: [], // Store terminal output lines
            activeVersion: activeVersion
        });

        console.log('Adding taskbar item...');
        // Add to taskbar
        this.desktop.addTaskbarItem(`Server - ${modelName}`, windowId, '<span class="material-icons">computer</span>');

        // Set up event listeners for buttons
        setTimeout(() => {
            const chatBtn = document.getElementById(`chat-btn-${windowId}`);
            const stopBtn = document.getElementById(`stop-btn-${windowId}`);
            
            if (chatBtn) {
                chatBtn.addEventListener('click', () => {
                    this.openChatForServer(windowId, modelName, host, port);
                });
            }
            
            if (stopBtn) {
                stopBtn.addEventListener('click', () => {
                    this.stopServer(processId, windowId, modelPath, modelName);
                });
            }
        }, 0);

        console.log('Starting output polling...');
        // Start polling for output
        this.startServerOutputPolling(processId, windowId);

        // Also add a status check after a few seconds to ensure we show something
        setTimeout(() => {
            console.log('Running server health check...');
            this.checkServerHealth(windowId, host, port, modelName);
        }, 3000);

        console.log('Terminal window creation completed successfully');
        return window;
    }

    startServerOutputPolling(processId, windowId) {
        const terminalInfo = this.terminals.get(windowId);
        if (!terminalInfo) return;

        // Track last scroll position to determine if user is scrolled up
        let isScrolledToBottom = true;
        
        // Batch updates to reduce DOM operations
        let outputBuffer = [];
        let updateTimer = null;
        let lastOutputTime = 0;
        const minUpdateInterval = 50; // ms

        const flushOutputBuffer = (outputDiv) => {
            if (outputBuffer.length > 0) {
                // Check if user has scrolled up
                const wasScrolledToBottom = isScrolledToBottom;
                
                // Create a document fragment to batch DOM operations
                const fragment = document.createDocumentFragment();
                outputBuffer.forEach(line => {
                    if (line !== null && line !== undefined) {
                        const lineDiv = document.createElement('div');
                        lineDiv.className = 'server-line';
                        // Handle special characters and escape sequences
                        lineDiv.textContent = line.toString();
                        fragment.appendChild(lineDiv);
                    }
                });
                
                outputDiv.appendChild(fragment);
                
                // Only scroll to bottom if user hasn't scrolled up
                if (wasScrolledToBottom) {
                    outputDiv.scrollTop = outputDiv.scrollHeight;
                }
                
                outputBuffer = [];
            }
        };

        const pollOutput = async () => {
            try {
                console.log(`Polling output for process ${processId}...`);
                // Use Tauri command instead of fetch
                const invoke = this.getInvoke();
                if (!invoke) {
                    console.error('Tauri invoke not available for output polling');
                    return;
                }
                const data = await invoke('get_process_output', { processId });
                console.log(`Output data received:`, data);

                const outputDiv = document.getElementById(`server-output-${windowId}`);

                if (!outputDiv) {
                    console.warn(`Output div not found for ${windowId}`);
                    return;
                }

                // Update scroll position tracking
                const scrollTop = outputDiv.scrollTop;
                const scrollHeight = outputDiv.scrollHeight;
                const clientHeight = outputDiv.clientHeight;
                isScrolledToBottom = (scrollTop + clientHeight >= scrollHeight - 5);

                // Add new output lines to buffer if they exist
                if (data.output && Array.isArray(data.output) && data.output.length > 0) {
                    console.log(`Adding ${data.output.length} output lines to buffer`);
                    outputBuffer.push(...data.output);
                    
                    // Check for server ready message and update status
                    const serverReadyMessage = "main: server is listening on http://";
                    const hasServerReadyMessage = data.output.some(line => 
                        line && line.toString().includes(serverReadyMessage)
                    );
                    
                    if (hasServerReadyMessage && terminalInfo.status === 'starting') {
                        console.log('Server ready message detected, updating status to running');
                        this.updateServerStatus(windowId, 'running');
                    }
                    
                    // Save output to terminal data (keep last 1000 lines)
                    const terminalData = this.terminals.get(windowId);
                    if (terminalData) {
                        if (!terminalData.output) terminalData.output = [];
                        terminalData.output.push(...data.output);
                        // Keep only last 1000 lines to prevent memory issues
                        if (terminalData.output.length > 1000) {
                            terminalData.output = terminalData.output.slice(-1000);
                        }
                        this.terminals.set(windowId, terminalData);
                    }
                    
                    // Throttle updates to prevent UI freezing but be more responsive
                    const now = Date.now();
                    if (now - lastOutputTime > minUpdateInterval || outputBuffer.length > 50) {
                        console.log('Flushing output buffer immediately');
                        flushOutputBuffer(outputDiv);
                        lastOutputTime = now;
                    } else if (!updateTimer) {
                        // Schedule buffer flush
                        updateTimer = setTimeout(() => {
                            console.log('Flushing output buffer (scheduled)');
                            flushOutputBuffer(outputDiv);
                            updateTimer = null;
                            lastOutputTime = Date.now();
                        }, minUpdateInterval);
                    }
                } else {
                    console.log('No new output data received');
                }

                // Check if process is still running
                if (data.is_running !== false && (terminalInfo.status === 'running' || terminalInfo.status === 'starting')) {
                    console.log('Process still running, continuing polling in 100ms');
                    // Continue polling if process is still running - faster polling for better responsiveness
                    setTimeout(pollOutput, 100);
                } else if (data.is_running === false) {
                    console.log('Process has stopped, finalizing output');
                    // Process has stopped, flush any remaining output
                    if (updateTimer) {
                        clearTimeout(updateTimer);
                    }
                    flushOutputBuffer(outputDiv);
                    this.updateServerStatus(windowId, 'stopped', data.return_code || 0);
                }
            } catch (error) {
                console.error('Error polling server output:', error);
                const terminalInfo = this.terminals.get(windowId);

                // If the server is gone or another error, stop polling.
                this.updateServerStatus(windowId, 'stopped', -1);
                const outputDiv = document.getElementById(`server-output-${windowId}`);
                if (outputDiv) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'server-line server-error';
                    errorDiv.textContent = `Connection to server lost. Polling stopped. Error: ${error.message}`;
                    outputDiv.appendChild(errorDiv);
                    outputDiv.scrollTop = outputDiv.scrollHeight;
                }
                return; // Stop polling
            }
        };

        // Start polling immediately
        pollOutput();
    }

    async checkServerHealth(windowId, host, port, modelName) {
        const outputDiv = document.getElementById(`server-output-${windowId}`);
        if (!outputDiv) return;

        try {
            const response = await fetch(`http://${host}:${port}/v1/models`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const models = await response.json();
                const lineDiv = document.createElement('div');
                lineDiv.className = 'server-line server-success';
                lineDiv.textContent = `Server is responding! Available models: ${models.data?.length || 'Unknown'}`;
                outputDiv.appendChild(lineDiv);
                outputDiv.scrollTop = outputDiv.scrollHeight;
            } else {
                throw new Error(`Server responded with status ${response.status}`);
            }
        } catch (error) {
            const lineDiv = document.createElement('div');
            lineDiv.className = 'server-line server-warning';
            lineDiv.textContent = `Warning: Server health check failed: ${error.message}`;
            outputDiv.appendChild(lineDiv);
            outputDiv.scrollTop = outputDiv.scrollHeight;
        }
    }

    updateServerStatus(windowId, status, returnCode = null) {
        const window = this.desktop.windows.get(windowId);
        const terminalInfo = this.terminals.get(windowId);

        if (window && terminalInfo) {
            const statusElement = window.querySelector('.server-status');
            const stopBtn = window.querySelector('.stop-btn');

            if (statusElement) {
                if (status === 'starting') {
                    statusElement.innerHTML = '<span class="material-icons" style="color: #ffc107; font-size: 14px;">circle</span> Starting';
                    statusElement.className = 'server-status starting';
                    terminalInfo.status = 'starting';
                } else if (status === 'running') {
                    statusElement.innerHTML = '<span class="material-icons" style="color: #4caf50; font-size: 14px;">circle</span> Running';
                    statusElement.className = 'server-status running';
                    terminalInfo.status = 'running';
                } else if (status === 'stopped') {
                    statusElement.textContent = 'Stopped';
                    statusElement.className = 'server-status stopped';

                    // Update terminal info
                    terminalInfo.status = 'stopped';

                                    // Disconnect any chat sessions connected to this server when it stops unexpectedly
                if (window.chatApp && terminalInfo.host && terminalInfo.port) {
                    window.chatApp.disconnectChatsForServer(terminalInfo.host, terminalInfo.port);
                }

                    // Change stop button to start button
                    if (stopBtn) {
                        stopBtn.textContent = 'Start';
                        stopBtn.className = 'server-btn start-btn';
                        stopBtn.id = `start-btn-${windowId}`;
                        // Remove any existing event listeners
                        const newStopBtn = stopBtn.cloneNode(true);
                        stopBtn.parentNode.replaceChild(newStopBtn, stopBtn);
                        // Add event listener
                        newStopBtn.addEventListener('click', () => {
                            this.restartServer(windowId, terminalInfo.modelPath, terminalInfo.modelName);
                        });
                    }

                    // Add final message
                    const outputDiv = window.querySelector(`[id^="server-output-"]`);
                    if (outputDiv) {
                        const lineDiv = document.createElement('div');
                        lineDiv.className = 'server-line server-exit';
                        lineDiv.textContent = `Process exited with code ${returnCode || 0}`;
                        outputDiv.appendChild(lineDiv);
                        outputDiv.scrollTop = outputDiv.scrollHeight;
                    }
                }
            }
        }
    }

    async stopServer(processId, windowId, modelPath, modelName) {
        try {
            // Use Tauri command instead of fetch
            const invoke = this.getInvoke();
            if (!invoke) {
                console.error('Tauri invoke not available for process termination');
                return;
            }
            await invoke('kill_process', { processId });
            
            this.updateServerStatus(windowId, 'stopped', 0);
            this.desktop.showNotification(`${modelName} stopped`, 'info');
            
            // Disconnect any chat sessions connected to this server
            const terminalInfo = this.terminals.get(windowId);
            if (terminalInfo && window.chatApp && terminalInfo.host && terminalInfo.port) {
                window.chatApp.disconnectChatsForServer(terminalInfo.host, terminalInfo.port);
            }
        } catch (error) {
            console.error('Error stopping server:', error);
            this.desktop.showNotification(`Error stopping server: ${error.message}`, 'error');
        }
    }

    async startServer(windowId, modelPath, modelName) {
        const terminalInfo = this.terminals.get(windowId);
        if (!terminalInfo) return;

        try {
            // Use Tauri command instead of fetch
            const invoke = this.getInvoke();
            if (!invoke) {
                console.error('Tauri invoke not available for model restart');
                return;
            }
            const result = await invoke('launch_model', { modelPath });

            if (result.success) {
                // Update terminal info with new process ID
                terminalInfo.processId = result.process_id;
                terminalInfo.host = result.server_host;
                terminalInfo.port = result.server_port;
                terminalInfo.status = 'starting';

                // Update UI
                const window = this.desktop.windows.get(windowId);
                if (window) {
                    const statusElement = window.querySelector('.server-status');
                    const startBtn = window.querySelector('.start-btn');
                    const serverDetails = window.querySelector('.server-details');

                    if (statusElement) {
                        statusElement.innerHTML = '<span class="material-icons" style="color: #ffc107; font-size: 14px;">circle</span> Starting';
                        statusElement.className = 'server-status starting';
                    }

                    if (serverDetails) {
                        serverDetails.innerHTML = `${modelName} - <span class="clickable" style="cursor: pointer; text-decoration: underline;" onclick="terminalManager.openUrl('http://${result.server_host}:${result.server_port}')">${result.server_host}:${result.server_port}</span><button class="copy-link-btn" style="background: none; border: none; cursor: pointer; margin-left: 5px; padding: 0; font-size: 14px; vertical-align: middle;" onclick="terminalManager.copyToClipboard('http://${result.server_host}:${result.server_port}', this)" title="Copy link"><span class="material-icons" style="font-size: 14px; color: var(--theme-text-muted);">content_copy</span></button>`;
                    }

                    // Change start button back to stop button
                    if (startBtn) {
                        startBtn.textContent = 'Stop';
                        startBtn.className = 'server-btn stop-btn';
                        startBtn.id = `stop-btn-${windowId}`;
                        // Remove any existing event listeners
                        const newStartBtn = startBtn.cloneNode(true);
                        startBtn.parentNode.replaceChild(newStartBtn, startBtn);
                        // Add event listener
                        newStartBtn.addEventListener('click', () => {
                            this.stopServer(result.process_id, windowId, modelPath, modelName);
                        });
                    }

                    // Add restart message to output
                    const outputDiv = window.querySelector(`[id^="server-output-"]`);
                    if (outputDiv) {
                        const separator = document.createElement('div');
                        separator.className = 'server-line server-separator';
                        separator.textContent = '--- Restarting Server ---';
                        outputDiv.appendChild(separator);

                        const restartDiv = document.createElement('div');
                        restartDiv.className = 'server-line server-system';
                        restartDiv.textContent = `Restarting ${modelName}...`;
                        outputDiv.appendChild(restartDiv);

                        const processDiv = document.createElement('div');
                        processDiv.className = 'server-line server-system';
                        processDiv.textContent = `New Process ID: ${result.process_id}`;
                        outputDiv.appendChild(processDiv);

                        const serverDiv = document.createElement('div');
                        serverDiv.className = 'server-line server-system';
                        serverDiv.textContent = `Server: ${result.server_host}:${result.server_port}`;
                        outputDiv.appendChild(serverDiv);

                        outputDiv.scrollTop = outputDiv.scrollHeight;
                    }
                }

                // Start polling for new output
                this.startServerOutputPolling(result.process_id, windowId);
                this.desktop.showNotification(`${modelName} restarted`, 'success');
            } else {
                throw new Error(result.error || 'Failed to launch model');
            }
        } catch (error) {
            console.error('Error restarting server:', error);
            this.desktop.showNotification(`Failed to restart ${modelName}: ${error.message}`, 'error');
        }
    }

    // Proper restart functionality that stops then starts
    async restartServer(windowId, modelPath, modelName) {
        console.log(`🔄 [INDIVIDUAL SERVER RESTART] Starting restart for ${modelName} (window: ${windowId})`);
        
        const terminalInfo = this.terminals.get(windowId);
        if (!terminalInfo) {
            console.warn(`No terminal info found for window ${windowId}`);
            console.log(`🆕 [NEW SERVER START] No existing terminal, starting fresh server for ${modelName}`);
            return this.startServer(windowId, modelPath, modelName);
        }

        try {
            console.log(`🔄 [RESTART SEQUENCE] Restarting server for ${modelName}...`);
            
            // First, stop the existing process if it's running or starting
            if (terminalInfo.processId && (terminalInfo.status === 'running' || terminalInfo.status === 'starting')) {
                console.log(`🛑 [STOP PHASE] Stopping existing process ${terminalInfo.processId}`);
                await this.stopServer(terminalInfo.processId, windowId, modelPath, modelName);
                
                // Wait a moment for the process to fully stop
                console.log(`⏱️ [WAIT PHASE] Waiting 500ms for process cleanup...`);
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log(`✅ [WAIT COMPLETE] Ready to start new process`);
            } else {
                console.log(`ℹ️ [SKIP STOP] Process not running, proceeding to start`);
            }
            
            // Then start a new instance
            console.log(`▶️ [START PHASE] Starting new instance of ${modelName}`);
            const result = await this.startServer(windowId, modelPath, modelName);
            console.log(`🎉 [RESTART COMPLETE] Successfully restarted ${modelName}`);
            return result;
            
        } catch (error) {
            console.error('❌ [RESTART ERROR] Error in restart sequence:', error);
            this.desktop.showNotification(`Failed to restart ${modelName}: ${error.message}`, 'error');
        }
    }

    openChatForServer(serverWindowId, modelName, host, port) {
        // Open chat application and create a new chat for this server
        if (chatApp) {
            chatApp.show();
            // Auto-create a chat for this server
            setTimeout(() => {
                chatApp.showNewChatDialog();
                // Pre-fill the form with server details
                const nameInput = document.getElementById('chat-name-input');
                const hostInput = document.getElementById('chat-host-input');
                const portInput = document.getElementById('chat-port-input');
                
                if (nameInput) nameInput.value = modelName;
                if (hostInput) hostInput.value = host;
                if (portInput) portInput.value = port;
            }, 100);
        }
    }

    // Session management methods
    async saveTerminalState(windowId, terminalData) {
        try {
            const response = await fetch('/api/session/terminal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    windowId: windowId,
                    processId: terminalData.processId,
                    modelName: terminalData.modelName,
                    modelPath: terminalData.modelPath,
                    host: terminalData.host,
                    port: terminalData.port,
                    status: terminalData.status,
                    output: terminalData.output || [],
                    activeVersion: terminalData.activeVersion || ''
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save terminal state');
            }
        } catch (error) {
            console.error('Error saving terminal state:', error);
        }
    }

    // Check for existing terminal for a model
    getExistingTerminal(modelPath) {
        return Array.from(this.terminals.entries()).find(([windowId, terminalInfo]) =>
            terminalInfo.modelPath === modelPath
        );
    }

    // Get terminal data for session restoration
    getTerminalData(windowId) {
        return this.terminals.get(windowId);
    }

    // Remove terminal from tracking
    removeTerminal(windowId) {
        this.terminals.delete(windowId);
    }

    // Get all terminals for session management
    getAllTerminals() {
        return this.terminals;
    }
    
    // Get active terminal IDs for cleanup
    getActiveTerminals() {
        const activeTerminals = [];
        for (const [windowId, terminalInfo] of this.terminals.entries()) {
            if ((terminalInfo.status === 'running' || terminalInfo.status === 'starting') && terminalInfo.processId) {
                activeTerminals.push(windowId);
            }
        }
        return activeTerminals;
    }
    
    // Close a specific terminal and its process
    async closeTerminal(windowId) {
        const terminalInfo = this.terminals.get(windowId);
        if (terminalInfo && terminalInfo.processId && (terminalInfo.status === 'running' || terminalInfo.status === 'starting')) {
            console.log(`📺 Closing terminal ${windowId} with process ${terminalInfo.processId}`);
            try {
                await this.stopServer(terminalInfo.processId, windowId, terminalInfo.modelPath, terminalInfo.modelName);
                console.log(`✅ Successfully closed terminal ${windowId}`);
                
                // Disconnect any chat sessions connected to this server
                if (window.chatApp && terminalInfo.host && terminalInfo.port) {
                    window.chatApp.disconnectChatsForServer(terminalInfo.host, terminalInfo.port);
                }
            } catch (error) {
                console.error(`❌ Failed to close terminal ${windowId}:`, error);
            }
        }
        this.terminals.delete(windowId);
    }
    
    // Method to open URL in default browser
    async openUrl(url) {
        try {
            // Use desktop manager's openUrl method
            await this.desktop.openUrl(url);
        } catch (error) {
            console.error('Error opening URL:', error);
        }
    }
    
    // Method to copy text to clipboard
    async copyToClipboard(text, buttonElement) {
        try {
            await navigator.clipboard.writeText(text);
            // Show visual feedback
            const originalIcon = buttonElement.innerHTML;
            buttonElement.innerHTML = '<span class="material-icons" style="font-size: 14px; color: #4caf50;">check</span>';
            setTimeout(() => {
                buttonElement.innerHTML = originalIcon;
            }, 2000);
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            // Show error feedback
            const originalIcon = buttonElement.innerHTML;
            buttonElement.innerHTML = '<span class="material-icons" style="font-size: 14px; color: #f44336;">error</span>';
            setTimeout(() => {
                buttonElement.innerHTML = originalIcon;
            }, 2000);
        }
    }

    // Terminal restoration and session management methods
    async restoreTerminalsAndWindows() {
        if (!this.desktop.sessionData) {
            console.log('No session data available for restoration');
            return;
        }
        
        if (this.desktop.restorationInProgress) {
            console.log('Restoration already in progress, skipping duplicate call');
            return;
        }
        
        this.desktop.restorationInProgress = true;
        console.log('Starting terminal and window restoration...');
        console.log('Session data terminals:', this.desktop.sessionData.terminals);
        console.log('Session data windows:', this.desktop.sessionData.windows);

        // First restore terminals data
        for (const [windowId, terminalData] of Object.entries(this.desktop.sessionData.terminals || {})) {
            console.log('Loading terminal data for', windowId, ':', terminalData);
            console.log('Terminal output length:', terminalData.output ? terminalData.output.length : 'no output');
            
            this.terminals.set(windowId, terminalData);
            // Check if process is still running - this will update the status
            await this.checkTerminalProcess(windowId, terminalData);
        }

        // Then restore windows - restore terminals regardless of visibility, other windows only if visible
        for (const [windowId, windowData] of Object.entries(this.desktop.sessionData.windows || {})) {
            console.log('Processing window restoration for:', windowId, windowData);
            
            if (windowData.type === 'terminal') {
                // Always restore terminal windows (whether they were visible or minimized)
                const terminalData = this.getTerminalData(windowId);
                console.log('Terminal data for window restoration:', terminalData);
                if (terminalData && (terminalData.status === 'running' || terminalData.status === 'starting')) {
                    console.log('Restoring terminal window for running/starting process:', windowId, windowData);
                    this.desktop.restoreWindow(windowId, windowData);
                } else {
                    console.log('Skipping terminal window restoration - process not running:', windowId, 
                              terminalData ? `status: ${terminalData.status}` : 'no terminal data');
                    // Remove the non-running terminal from session
                    await this.desktop.removeWindowFromSession(windowId);
                }
            }
        }

        console.log('Terminal and window restoration complete');
        this.desktop.restorationInProgress = false;
    }

    async checkTerminalProcess(windowId, terminalData) {
        if (!terminalData.processId) {
            terminalData.status = 'stopped';
            this.terminals.set(windowId, terminalData);
            console.log(`Terminal ${windowId} has no processId, marked as stopped`);
            return;
        }
        
        try {
            console.log(`Checking process status for ${windowId} with processId: ${terminalData.processId}`);
            // Use Tauri command instead of fetch API
            const invoke = this.getInvoke();
            const result = await invoke('get_process_output', { processId: terminalData.processId });
            const newStatus = result.is_running ? (terminalData.status === 'starting' ? 'starting' : 'running') : 'stopped';
            console.log(`Process ${terminalData.processId} status: ${newStatus}`);
            terminalData.status = newStatus;
            this.terminals.set(windowId, terminalData);
        } catch (error) {
            console.warn(`Error checking terminal process ${terminalData.processId}:`, error);
            // If the process is not found or another error, mark as stopped
            terminalData.status = 'stopped';
            this.terminals.set(windowId, terminalData);
        }
    }

    restoreTerminalWindow(windowId, terminalData, windowData) {
        console.log('Restoring terminal window with data:', terminalData);
        console.log('Terminal output length:', terminalData.output ? terminalData.output.length : 'no output');
        
        const content = `
            <div class="server-terminal-container">
                <div class="server-info">
                    <span class="server-status ${terminalData.status}">
                        <span class="material-icons" style="color: ${terminalData.status === 'running' ? '#4caf50' : terminalData.status === 'starting' ? '#ffc107' : '#f44336'}; font-size: 14px;">circle</span> 
                        ${terminalData.status}
                    </span>
                    <span class="server-details">${terminalData.modelName} - <span class="clickable" style="cursor: pointer; text-decoration: underline;" onclick="terminalManager.openUrl('http://${terminalData.host}:${terminalData.port}')">${terminalData.host}:${terminalData.port}</span><button class="copy-link-btn" style="background: none; border: none; cursor: pointer; margin-left: 5px; padding: 0; font-size: 14px; vertical-align: middle;" onclick="terminalManager.copyToClipboard('http://${terminalData.host}:${terminalData.port}', this)" title="Copy link"><span class="material-icons" style="font-size: 14px; color: var(--theme-text-muted);">content_copy</span></button></span>
                    <div class="server-controls">
                        <button class="server-btn" onclick="terminalManager.openChatForServer('${windowId}', '${terminalData.modelName}', '${terminalData.host}', ${terminalData.port})"><span class="material-icons">chat</span> Chat</button>
                        ${terminalData.status === 'running' || terminalData.status === 'starting' ? 
                            `<button class="server-btn stop-btn" onclick="terminalManager.stopServer('${terminalData.processId}', '${windowId}', '${terminalData.modelPath}', '${terminalData.modelName}')"><span class="material-icons">stop</span> Stop</button>` :
                            `<button class="server-btn start-btn" onclick="terminalManager.restartServer('${windowId}', '${terminalData.modelPath}', '${terminalData.modelName}')"><span class="material-icons">play_arrow</span> Start</button>`
                        }
                    </div>
                </div>
                <div class="server-output" id="server-output-${windowId}">
                    <div class="server-line">Restored ${terminalData.modelName} session</div>
                    <div class="server-line">Process ID: ${terminalData.processId}</div>
                    <div class="server-line">Server: <span class="clickable" style="cursor: pointer; text-decoration: underline;" onclick="terminalManager.openUrl('http://${terminalData.host}:${terminalData.port}')">${terminalData.host}:${terminalData.port}</span><button class="copy-link-btn" style="background: none; border: none; cursor: pointer; margin-left: 5px; padding: 0; font-size: 14px; vertical-align: middle;" onclick="terminalManager.copyToClipboard('http://${terminalData.host}:${terminalData.port}', this)" title="Copy link"><span class="material-icons" style="font-size: 14px; color: var(--theme-text-muted);">content_copy</span></button></div>
                    <div class="server-line">Output lines: ${terminalData.output ? terminalData.output.length : 0}</div>
                    ${terminalData.output && terminalData.output.length > 0 ? terminalData.output.map(line => 
                        `<div class="server-line">${line.toString().replace(/ /g, '&nbsp;')}</div>`
                    ).join('') : '<div class="server-line">No saved output found</div>'}
                </div>
            </div>
        `;

        const window = this.desktop.createWindow(windowId, `Server - ${terminalData.modelName}`, 'server-terminal-window', content);
        this.desktop.addTaskbarItem(`Server - ${terminalData.modelName}`, windowId, '<span class="material-icons">computer</span>');
        
        // Restore window position and size
        if (windowData.position) {
            window.style.left = windowData.position.x + 'px';
            window.style.top = windowData.position.y + 'px';
        }
        if (windowData.size) {
            window.style.width = windowData.size.width + 'px';
            window.style.height = windowData.size.height + 'px';
            // Store the dimensions for proper size saving when minimized
            window.dataset.savedWidth = windowData.size.width.toString();
            window.dataset.savedHeight = windowData.size.height.toString();
        }
        if (windowData.zIndex) {
            window.style.zIndex = windowData.zIndex;
            this.desktop.windowZIndex = Math.max(this.desktop.windowZIndex, windowData.zIndex);
        }
        
        // Always start minimized during restoration
        this.desktop.minimizeWindow(windowId);
        
        // Scroll terminal to bottom after restoration
        setTimeout(() => {
            const outputDiv = document.getElementById(`server-output-${windowId}`);
            if (outputDiv) {
                outputDiv.scrollTop = outputDiv.scrollHeight;
            }
        }, 100);
        
        // Resume output polling if process is still running or starting
        if ((terminalData.status === 'running' || terminalData.status === 'starting') && terminalData.processId) {
            this.startServerOutputPolling(terminalData.processId, windowId);
        }
    }

    async closeAllTerminalSessions() {
        try {
            // Get all terminal windows from session state
            const terminalWindows = Object.values(this.desktop.windows).filter(window => 
                window && (window.type === 'terminal' || window.id.includes('terminal'))
            );
            
            // Get all active terminals from terminal manager
            const activeTerminals = this.getActiveTerminals();
            
            console.log(`Found ${terminalWindows.length} terminal windows and ${activeTerminals.length} active terminals`);
            
            // Close all terminal processes
            const closePromises = [];
            
            // Close terminals via terminal manager if available
            if (activeTerminals.length > 0) {
                for (const terminalId of activeTerminals) {
                    try {
                        const promise = this.closeTerminal(terminalId);
                        if (promise && typeof promise.then === 'function') {
                            closePromises.push(promise);
                        }
                    } catch (error) {
                        console.error(`Error closing terminal ${terminalId}:`, error);
                    }
                }
            }
            
            // Also close terminal windows via window manager
            for (const window of terminalWindows) {
                try {
                    if (window.processId) {
                        // Kill the process via API
                        const killPromise = fetch(`/api/process/${window.processId}/kill`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }).catch(error => console.error(`Error killing process ${window.processId}:`, error));
                        
                        closePromises.push(killPromise);
                    }
                    
                    // Close the window
                    this.desktop.closeWindow(window.id);
                } catch (error) {
                    console.error(`Error closing terminal window ${window.id}:`, error);
                }
            }
            
            // Wait for all close operations to complete (with timeout)
            if (closePromises.length > 0) {
                await Promise.allSettled(closePromises);
                // Give processes a moment to fully terminate
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            console.log('All terminal sessions closed successfully');
            
        } catch (error) {
            console.error('Error closing terminal sessions:', error);
            // Don't throw - we want restart to continue even if terminal cleanup fails
        }
    }
}

// Debug: Confirm TerminalManager class is loaded
console.log('TerminalManager class loaded successfully');
window.TerminalManager = TerminalManager;