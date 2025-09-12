// Chat Application - Fixed Version
class ChatApplication {
    constructor() {
        this.chats = new Map(); // chatId: {name, host, port, messages, status, config}
        this.activeChat = null;
        this.chatCounter = 0;
        this.isVisible = false;
        this.windowElement = null;
        this.streamingAbortController = null; // For canceling streaming requests
        this.configVisible = false;

        // Generation stats tracking
        this.generationStats = {
            startTime: null,
            firstTokenTime: null,
            tokenCount: 0,
            lastTokenTime: null
        };

        // Default configuration for new chats
        this.defaultConfig = {
            systemPrompt: '',
            temperature: 0.8,
            topK: 40,
            topP: 0.9,
            maxTokens: -1,
            streamResponse: true,
            repeatPenalty: 1.1
        };

        this.init();
    }

    init() {
        this.createChatWindow();
        this.loadSavedChats();
    }

    resetGenerationStats() {
        this.generationStats = {
            startTime: null,
            firstTokenTime: null,
            tokenCount: 0,
            lastTokenTime: null
        };
    }

    calculateGenerationStats(stopReason = null) {
        if (!this.generationStats.startTime) {
            return null;
        }

        const now = Date.now();
        const totalTime = (now - this.generationStats.startTime) / 1000; // seconds
        const timeToFirstToken = this.generationStats.firstTokenTime ? 
            (this.generationStats.firstTokenTime - this.generationStats.startTime) / 1000 : 0;
        
        // Calculate tokens per second (excluding time to first token)
        const generationTime = totalTime - timeToFirstToken;
        const tokensPerSecond = generationTime > 0 ? 
            (this.generationStats.tokenCount / generationTime).toFixed(2) : '0.00';

        // Use provided stop reason or determine default
        const finalStopReason = stopReason || (this.generationStats.tokenCount > 0 ? 'EOS Token Found' : 'No tokens generated');

        return {
            tokensPerSecond,
            totalTokens: this.generationStats.tokenCount,
            timeToFirstToken: timeToFirstToken.toFixed(2),
            stopReason: finalStopReason,
            formatted: `${tokensPerSecond} t/s / ${this.generationStats.tokenCount} tokens / ${timeToFirstToken.toFixed(2)}s to first token / ${finalStopReason}`,
            short: `${tokensPerSecond} t/s`
        };
    }

    // Helper method to create or update stats element
    // Stats are only displayed on newly generated assistant messages
    updateStatsElement(container, stats, isStreaming = false) {
        if (!stats) return;

        let statsElement = container.querySelector('.message-stats');
        
        if (!statsElement) {
            statsElement = document.createElement('div');
            statsElement.className = 'message-stats';
            
            // Insert after message content
            const messageContent = container.querySelector('.message-content');
            if (messageContent && messageContent.nextSibling) {
                container.insertBefore(statsElement, messageContent.nextSibling);
            } else {
                container.appendChild(statsElement);
            }
            
        }

        // Update content and classes (show only tk/s; show a custom themed bubble with full details on hover)
        statsElement.textContent = (stats && (stats.short || `${stats.tokensPerSecond} t/s`)) || '';
        // Ensure tooltip element exists and is updated
        let tooltip = statsElement.querySelector('.message-stats-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'message-stats-tooltip';
            statsElement.appendChild(tooltip);
        }
        // Render detailed info on separate lines inside the tooltip
        tooltip.innerHTML = `
            ${stats.tokensPerSecond} t/s<br>
            ${stats.totalTokens} tokens<br>
            ${stats.timeToFirstToken}s to first token<br>
            ${stats.stopReason}
        `;
        statsElement.className = `message-stats${isStreaming ? ' streaming' : ''}`;
        
        return statsElement;
    }



    createChatWindow() {
        // Create the main chat application window
        const windowId = 'chat-application';
        const content = `
            <div class="chat-app-container">
                <div class="chat-button-area">
                    <button class="chat-toggle-btn" id="chat-toggle-btn" onclick="chatApp.toggleSidebar()" title="Toggle Chat List">
                        <span class="material-icons">chat</span>
                    </button>
                    <button class="new-chat-icon-btn" onclick="chatApp.showNewChatDialog()" title="New Chat">
                        <span class="material-icons">add</span>
                    </button>
                </div>
                <div class="chat-sidebar" id="chat-sidebar">
                    <div class="chat-list" id="chat-list">
                        <!-- Chat list items will be populated here -->
                    </div>
                </div>
                <div class="chat-divider" id="chat-divider"></div>
                <div class="chat-main">
                    <div class="chat-welcome" id="chat-welcome">
                        <div class="welcome-content">
                            <h2><span class="material-icons">chat</span> Chat Application</h2>
                            <p>Select a chat from the sidebar or create a new one to get started.</p>
                            <button class="welcome-new-chat-btn" onclick="chatApp.showNewChatDialog()">Create New Chat</button>
                        </div>
                    </div>
                    <div class="chat-area" id="chat-area" style="display: none;">
                        <div class="chat-header" id="chat-header">
                            <div class="chat-title" id="chat-title">Chat Title</div>
                            <div class="chat-actions">
                                <button class="connection-btn disconnected" id="connection-btn" onclick="chatApp.toggleConnection()" title="Connect/Disconnect">
                                    <span id="connection-status">Connect</span>
                                </button>
                                <button class="chat-action-btn" onclick="chatApp.clearCurrentChat()" title="Clear Chat"><span class="material-icons">delete</span></button>
                                <button class="chat-action-btn" id="config-btn" onclick="chatApp.toggleConfig()" title="Configuration">
                                    <span class="material-icons">settings</span>
                                </button>
                            </div>
                        </div>
                        <div class="chat-content-container">
                            <div class="chat-messages" id="chat-messages">
                                <!-- Messages will be populated here -->
                            </div>
                            <div class="chat-config-overlay" id="chat-config" style="display: none;">
                                <div class="config-section">
                                    <div class="config-group">
                                        <label for="system-prompt">System Prompt:</label>
                                        <textarea id="system-prompt" class="config-textarea" placeholder="Enter system prompt..." rows="3"></textarea>
                                    </div>
                                    <div class="config-row">
                                        <div class="config-group">
                                            <label for="temperature">Temperature:</label>
                                            <div class="slider-container">
                                                <input type="range" id="temperature" class="config-slider" min="0.1" max="2.0" step="0.01" value="0.8">
                                                <span class="slider-value" id="temperature-value">0.8</span>
                                            </div>
                                        </div>
                                        <div class="config-group">
                                            <label for="top-k">Top K:</label>
                                            <div class="slider-container">
                                                <input type="range" id="top-k" class="config-slider" min="1" max="100" step="1" value="40">
                                                <span class="slider-value" id="top-k-value">40</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="config-row">
                                        <div class="config-group">
                                            <label for="top-p">Top P:</label>
                                            <div class="slider-container">
                                                <input type="range" id="top-p" class="config-slider" min="0.1" max="1.0" step="0.05" value="0.9">
                                                <span class="slider-value" id="top-p-value">0.9</span>
                                            </div>
                                        </div>
                                        <div class="config-group">
                                            <label for="max-tokens">Max Tokens:</label>
                                            <div class="slider-container">
                                                <input type="range" id="max-tokens" class="config-slider" min="-1" max="4096" step="1" value="-1">
                                                <span class="slider-value" id="max-tokens-value">Unlimited</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="config-row">
                                        <div class="config-group">
                                            <label for="repeat-penalty">Repeat Penalty:</label>
                                            <div class="slider-container">
                                                <input type="range" id="repeat-penalty" class="config-slider" min="0.8" max="1.5" step="0.05" value="1.1">
                                                <span class="slider-value" id="repeat-penalty-value">1.1</span>
                                            </div>
                                        </div>
                                        <div class="config-group">
                                            <label>
                                                <input type="checkbox" id="stream-response" checked>
                                                Stream Response
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="chat-input-area">
                            <div class="chat-input-container">
                                <textarea class="chat-input" id="chat-input" placeholder="Type your message..." autocomplete="off" rows="2"
                                       oninput="chatApp.autoResizeInput(this)" onkeydown="chatApp.handleInputKeydown(event)"></textarea>
                                <button class="chat-send" id="chat-send" onclick="chatApp.handleSendButtonClick()" title="Send message">
                                    <span class="material-icons">arrow_upward</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- New Chat Dialog -->
            <div class="modal-overlay" id="new-chat-modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Create New Chat</h3>
                        <button class="modal-close" onclick="chatApp.hideNewChatDialog()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="chat-name-input">Chat Name:</label>
                            <input type="text" id="chat-name-input" placeholder="Enter chat name..." class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="chat-host-input">Server Host:</label>
                            <input type="text" id="chat-host-input" value="127.0.0.1" class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="chat-port-input">Server Port:</label>
                            <input type="number" id="chat-port-input" value="8080" class="form-input">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="chatApp.hideNewChatDialog()">Cancel</button>
                        <button class="btn btn-primary" onclick="chatApp.createNewChat()">Create Chat</button>
                    </div>
                </div>
            </div>
        `;

        // Check if desktop object exists before using it
        if (typeof desktop !== 'undefined' && desktop.createWindow) {
            this.windowElement = desktop.createWindow(windowId, 'Chat Application', 'chat-application-window', content);
            this.windowElement.style.width = '70vw';
            this.windowElement.style.height = '80vh';
            this.windowElement.style.minWidth = '600px';
            this.windowElement.style.minHeight = '450px';
            this.windowElement.style.display = 'none'; // Hidden by default
        } else {
            // Fallback: create a standalone window element
            this.windowElement = document.createElement('div');
            this.windowElement.id = windowId;
            this.windowElement.className = 'chat-application-window';
            this.windowElement.innerHTML = content;
            this.windowElement.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 70vw;
                height: 80vh;
                min-width: 600px;
                min-height: 450px;
                background: white;
                border: 1px solid #ccc;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                z-index: 1000;
                display: none;
            `;
            document.body.appendChild(this.windowElement);
        }

        // Initialize sidebar state and draggable divider
        this.sidebarVisible = true;
        this.sidebarWidth = 200; // Default width (minimum)
        this.initializeDraggableDivider();

        // Set initial layout after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.updateSidebarWidth();
        }, 50);
    }

    show() {
        if (this.windowElement) {
            this.windowElement.style.display = 'block';
            if (typeof desktop !== 'undefined' && desktop.windowZIndex) {
                this.windowElement.style.zIndex = ++desktop.windowZIndex;
            }
            this.isVisible = true;

            // Check window visibility and reposition if needed
            if (typeof desktop !== 'undefined' && desktop.checkWindowVisibility && desktop.repositionWindowToVisible) {
                setTimeout(() => {
                    if (!desktop.checkWindowVisibility(this.windowElement)) {
                        const result = desktop.repositionWindowToVisible(this.windowElement);
                        if (result.moved && desktop.showNotification) {
                            const message = result.centered ?
                                'Chat window was off-screen and has been centered' :
                                'Chat window repositioned to visible area';
                            desktop.showNotification(message, 'info');
                        }
                    }
                }, 10); // Small delay to ensure display:block takes effect
            }

            // Add to taskbar if desktop system exists
            if (typeof desktop !== 'undefined' && desktop.addTaskbarItem && !document.getElementById('taskbar-chat-application')) {
                desktop.addTaskbarItem('Chat Application', 'chat-application', '<span class="material-icons">chat</span>');
            }

            // Update taskbar item to be active
            const taskbarItem = document.getElementById('taskbar-chat-application');
            if (taskbarItem) {
                taskbarItem.classList.add('active');
            }
        }
    }

    hide() {
        if (this.windowElement) {
            this.windowElement.style.display = 'none';
            this.isVisible = false;

            // Cancel any ongoing streaming request
            if (this.streamingAbortController) {
                this.streamingAbortController.abort();
                this.streamingAbortController = null;
            }

            // Cleanup scroll listeners
            this.cleanupScrollListeners();

            // Update taskbar item to be inactive
            const taskbarItem = document.getElementById('taskbar-chat-application');
            if (taskbarItem) {
                taskbarItem.classList.remove('active');
            }
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    showNewChatDialog() {
        const modal = document.getElementById('new-chat-modal');
        if (modal) {
            modal.style.display = 'flex';
            // Focus on name input
            const nameInput = document.getElementById('chat-name-input');
            if (nameInput) {
                nameInput.focus();
                nameInput.value = `Chat ${this.chats.size + 1}`;
                nameInput.select();
            }
        }
    }

    hideNewChatDialog() {
        const modal = document.getElementById('new-chat-modal');
        if (modal) {
            modal.style.display = 'none';
            // Clear inputs safely
            const nameInput = document.getElementById('chat-name-input');
            const hostInput = document.getElementById('chat-host-input');
            const portInput = document.getElementById('chat-port-input');

            if (nameInput) nameInput.value = '';
            if (hostInput) hostInput.value = '127.0.0.1';
            if (portInput) portInput.value = '8080';
        }
    }

    createNewChat() {
        const nameInput = document.getElementById('chat-name-input');
        const hostInput = document.getElementById('chat-host-input');
        const portInput = document.getElementById('chat-port-input');

        if (!nameInput || !hostInput || !portInput) {
            alert('Error: Required input fields not found');
            return;
        }

        const name = nameInput.value.trim();
        const host = hostInput.value.trim();
        const port = parseInt(portInput.value);

        if (!name) {
            alert('Please enter a chat name');
            return;
        }

        if (!host || !port || port < 1 || port > 65535) {
            alert('Please enter valid host and port');
            return;
        }

        const chatId = 'chat_' + (++this.chatCounter) + '_' + Date.now();

        const chatData = {
            id: chatId,
            name: name,
            host: host,
            port: port,
            messages: [],
            status: 'disconnected',
            statusMessage: null,
            created: Date.now(),
            config: { ...this.defaultConfig }
        };

        this.chats.set(chatId, chatData);
        this.addChatToList(chatData);
        this.selectChat(chatId);
        this.hideNewChatDialog();
        this.saveChatData();

        // Test connection
        this.testConnection(chatId);
    }

    addChatToList(chatData) {
        const chatList = document.getElementById('chat-list');
        if (!chatList) return;

        const chatItem = document.createElement('div');
        chatItem.className = `chat-list-item ${chatData.status}`;
        chatItem.id = `chat-item-${chatData.id}`;

        chatItem.innerHTML = `
            <div class="chat-item-content" onclick="chatApp.selectChat('${chatData.id}')">
                <div class="chat-item-info">
                    <div class="chat-item-name" title="${this.escapeHtml(chatData.name)}">${this.escapeHtml(chatData.name)}</div>
                    <div class="chat-item-details">${this.escapeHtml(chatData.host)}:${chatData.port}</div>
                </div>
                <button class="chat-delete-btn" onclick="event.stopPropagation(); chatApp.deleteChatFromList('${chatData.id}')" title="Delete Chat">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        `;

        chatList.appendChild(chatItem);
        
        // Auto-show sidebar when adding chat
        this.updateSidebarVisibility();
    }

    // Add HTML escaping function for security
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Toggle sidebar visibility
    toggleSidebar() {
        const sidebar = document.getElementById('chat-sidebar');
        const divider = document.getElementById('chat-divider');

        if (!sidebar || !divider) return;

        this.sidebarVisible = !this.sidebarVisible;

        if (this.sidebarVisible) {
            sidebar.style.display = 'flex';
            sidebar.style.width = this.sidebarWidth + 'px';
            divider.style.display = 'block';
        } else {
            sidebar.style.display = 'none';
            divider.style.display = 'none';
        }
    }

    // Initialize draggable divider functionality
    initializeDraggableDivider() {
        let isDragging = false;
        let startX = 0;
        let startWidth = 0;

        const handleMouseDown = (e) => {
            const divider = document.getElementById('chat-divider');
            if (!divider || !this.sidebarVisible) return;

            isDragging = true;
            startX = e.clientX;
            startWidth = this.sidebarWidth;

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            e.preventDefault();
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const newWidth = Math.max(200, Math.min(500, startWidth + deltaX)); // Min 200px, max 500px

            this.sidebarWidth = newWidth;
            this.updateSidebarWidth();

            e.preventDefault();
        };

        const handleMouseUp = () => {
            if (!isDragging) return;

            isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        // Add event listener when window is shown
        setTimeout(() => {
            const divider = document.getElementById('chat-divider');
            if (divider) {
                divider.addEventListener('mousedown', handleMouseDown);
            }
        }, 100);
    }

    // Update sidebar width
    updateSidebarWidth() {
        const sidebar = document.getElementById('chat-sidebar');

        if (sidebar && this.sidebarVisible) {
            sidebar.style.width = this.sidebarWidth + 'px';
        }
    }

    // Auto-hide/show sidebar based on chat list content
    updateSidebarVisibility() {
        const sidebar = document.getElementById('chat-sidebar');
        const divider = document.getElementById('chat-divider');
        
        if (!sidebar || !divider) return;

        const hasChats = this.chats.size > 0;
        
        // Only auto-hide if sidebar is currently visible and no chats exist
        // Only auto-show if sidebar is currently hidden and chats exist
        if (!hasChats && this.sidebarVisible) {
            // Auto-hide when empty
            this.sidebarVisible = false;
            sidebar.style.display = 'none';
            divider.style.display = 'none';
        } else if (hasChats && !this.sidebarVisible) {
            // Auto-show when chats are added
            this.sidebarVisible = true;
            sidebar.style.display = 'flex';
            sidebar.style.width = this.sidebarWidth + 'px';
            divider.style.display = 'block';
        }
    }

    selectChat(chatId) {
        // Update UI to show selected chat
        document.querySelectorAll('.chat-list-item').forEach(item => {
            item.classList.remove('active');
        });

        const chatItem = document.getElementById(`chat-item-${chatId}`);
        if (chatItem) {
            chatItem.classList.add('active');
        }

        this.activeChat = chatId;
        this.showChatArea();
        this.loadChatMessages(chatId);

        // Load configuration if config area is visible
        if (this.configVisible) {
            this.loadCurrentConfig();
        }
    }

    showChatArea() {
        const welcome = document.getElementById('chat-welcome');
        const chatArea = document.getElementById('chat-area');

        if (welcome) welcome.style.display = 'none';
        if (chatArea) chatArea.style.display = 'flex';
    }

    loadChatMessages(chatId) {
        const chatData = this.chats.get(chatId);
        if (!chatData) return;

        // Update chat header
        const chatTitle = document.getElementById('chat-title');
        if (chatTitle) {
            const titleText = `${chatData.name} (${chatData.host}:${chatData.port})`;
            chatTitle.textContent = titleText;
            chatTitle.title = titleText; // Add tooltip for full text when truncated
        }

        // Update connection button
        this.updateConnectionButton(chatData.status);

        // Load messages
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';

            // Load all messages with their stats preserved
            const messages = chatData.messages || [];
            messages.forEach((message, index) => {
                const isLastMessage = index === messages.length - 1;
                this.addMessageToUI({ ...message }, false, isLastMessage);
            });
            
            // Setup sticky copy buttons for all loaded messages
            this.setupStickyCopyButtons(messagesContainer);
            
            // Update status message display
            this.updateStatusMessageDisplay(chatId);
        }

        // Update input state based on connection status
        this.updateInputState(chatData.status);
    }

    getStatusText(status) {
        switch (status) {
            case 'connected': return 'Connected and ready to chat';
            case 'connecting': return 'Connecting to server...';
            case 'error': return 'Connection failed';
            default: return 'Not connected';
        }
    }

    setStatusMessage(chatId, message) {
        const chatData = this.chats.get(chatId);
        if (chatData) {
            chatData.statusMessage = message;
            this.saveChatData();
            
            // Update UI if this is the active chat
            if (this.activeChat === chatId) {
                this.updateStatusMessageDisplay(chatId);
            }
        }
    }

    updateStatusMessageDisplay(chatId) {
        const chatData = this.chats.get(chatId);
        if (!chatData) return;

        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        // Remove existing status message
        const existingStatus = messagesContainer.querySelector('.chat-status');
        if (existingStatus) {
            existingStatus.remove();
        }

        // Show status message if there's a custom one or no messages
        if (chatData.statusMessage || chatData.messages.length === 0) {
            const statusMessage = chatData.statusMessage || this.getStatusText(chatData.status);
            const statusElement = document.createElement('div');
            statusElement.className = 'chat-status';
            statusElement.innerHTML = `
                <div class="status-message">
                    ${statusMessage}
                </div>
            `;
            messagesContainer.appendChild(statusElement);
        }
    }

    // Public method to set a custom status message for the current chat
    setCurrentChatStatusMessage(message) {
        if (this.activeChat) {
            this.setStatusMessage(this.activeChat, message);
        }
    }

    // Public method to clear the status message for the current chat
    clearCurrentChatStatusMessage() {
        if (this.activeChat) {
            this.setStatusMessage(this.activeChat, null);
        }
    }

    updateInputState(status) {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');

        const isConnected = status === 'connected';

        if (input) {
            input.disabled = !isConnected;
            input.placeholder = isConnected ? 'Type your message...' : 'Not connected';
        }

        if (sendBtn) {
            sendBtn.disabled = !isConnected;
        }
    }

    updateConnectionButton(status) {
        const connectionBtn = document.getElementById('connection-btn');
        const connectionStatus = document.getElementById('connection-status');

        if (!connectionBtn || !connectionStatus) return;

        // Remove all status classes
        connectionBtn.classList.remove('connected', 'disconnected', 'connecting');

        switch (status) {
            case 'connected':
                connectionBtn.classList.add('connected');
                connectionStatus.textContent = 'Connected';
                connectionBtn.title = 'Click to disconnect';
                break;
            case 'connecting':
                connectionBtn.classList.add('connecting');
                connectionStatus.textContent = 'Connecting...';
                connectionBtn.title = 'Connecting to server';
                break;
            default:
                connectionBtn.classList.add('disconnected');
                connectionStatus.textContent = 'Connect';
                connectionBtn.title = 'Click to connect';
                break;
        }
    }

    toggleConnection() {
        if (!this.activeChat) return;

        const chatData = this.chats.get(this.activeChat);
        if (!chatData) return;

        if (chatData.status === 'connected') {
            // Disconnect
            chatData.status = 'disconnected';
            this.updateChatItemStatus(this.activeChat, 'disconnected');
            this.updateConnectionButton('disconnected');
            this.updateInputState('disconnected');
            this.saveChatData();
        } else if (chatData.status === 'disconnected' || chatData.status === 'error') {
            // Connect
            this.testConnection(this.activeChat);
        }
    }

    async testConnection(chatId) {
        const chatData = this.chats.get(chatId);
        if (!chatData) return;

        // Update status to connecting
        chatData.status = 'connecting';
        this.updateChatItemStatus(chatId, 'connecting');

        if (this.activeChat === chatId) {
            this.updateConnectionButton('connecting');
            this.loadChatMessages(chatId);
        }

        try {
            // Create AbortController for timeout (better browser compatibility)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`http://${chatData.host}:${chatData.port}/v1/models`, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                chatData.status = 'connected';
                this.updateChatItemStatus(chatId, 'connected');

                if (this.activeChat === chatId) {
                    this.loadChatMessages(chatId);
                }
            } else {
                throw new Error('Server responded with error');
            }
        } catch (error) {
            chatData.status = 'error';
            this.updateChatItemStatus(chatId, 'error');

            if (this.activeChat === chatId) {
                this.loadChatMessages(chatId);
            }
        }

        this.saveChatData();
    }

    updateChatItemStatus(chatId, status) {
        const chatItem = document.getElementById(`chat-item-${chatId}`);
        if (chatItem) {
            // Remove all status classes
            chatItem.classList.remove('connected', 'connecting', 'error', 'disconnected');
            // Add new status class
            chatItem.classList.add(status);
        }
    }

    async deleteChatFromList(chatId) {
        const chatData = this.chats.get(chatId);
        if (!chatData) return;

        // Use reusable modal dialog with blur and darkened background
        let confirmed = false;
        try {
            confirmed = await ModalDialog.showConfirmation({
                title: 'Delete Chat',
                message: `Are you sure you want to delete "${chatData.name}"?\n\nThis action cannot be undone.`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                type: 'danger'
            });
        } catch (error) {
            console.error('Error showing confirmation dialog:', error);
            confirmed = confirm(`Are you sure you want to delete "${chatData.name}"?`);
        }

        if (confirmed) {
            // Remove from data
            this.chats.delete(chatId);

            // Remove from UI
            const chatItem = document.getElementById(`chat-item-${chatId}`);
            if (chatItem) {
                chatItem.remove();
            }

            // If this was the active chat, clear it
            if (this.activeChat === chatId) {
                this.activeChat = null;

                // Show welcome screen
                const welcome = document.getElementById('chat-welcome');
                const chatArea = document.getElementById('chat-area');

                if (welcome) welcome.style.display = 'flex';
                if (chatArea) chatArea.style.display = 'none';
            }

            // Auto-hide sidebar if no chats remain
            this.updateSidebarVisibility();

            this.saveChatData();
        }
    }

    // Configuration Methods
    toggleConfig() {
        const configArea = document.getElementById('chat-config');
        const configBtn = document.getElementById('config-btn');
        const chatMessages = document.getElementById('chat-messages');

        if (!configArea || !configBtn || !chatMessages) return;

        this.configVisible = !this.configVisible;

        if (this.configVisible) {
            // Show the config area first without the visible class
            configArea.style.display = 'block';
            configArea.classList.remove('visible');

            // Force a reflow to ensure the element is rendered in its initial position
            configArea.offsetHeight;

            // Use requestAnimationFrame to ensure the transition starts from the correct position
            requestAnimationFrame(() => {
                configArea.classList.add('visible');
                chatMessages.classList.add('config-visible');
            });

            configBtn.classList.add('active');
            this.loadCurrentConfig();
            this.setupConfigEventListeners();
        } else {
            configArea.classList.remove('visible');
            chatMessages.classList.remove('config-visible');
            configBtn.classList.remove('active');
            // Hide the config area after animation completes
            setTimeout(() => {
                if (!this.configVisible) {
                    configArea.style.display = 'none';
                }
            }, 300); // Match the CSS transition duration
        }
    }

    loadCurrentConfig() {
        if (!this.activeChat) return;

        const chatData = this.chats.get(this.activeChat);
        if (!chatData) return;

        // Ensure config exists, create default if not
        if (!chatData.config) {
            chatData.config = { ...this.defaultConfig };
        }

        const config = chatData.config;

        // Load values into UI
        this.setConfigValue('system-prompt', config.systemPrompt);
        this.setConfigValue('temperature', config.temperature);
        this.setConfigValue('top-k', config.topK);
        this.setConfigValue('top-p', config.topP);
        this.setConfigValue('max-tokens', config.maxTokens);
        this.setConfigValue('stream-response', config.streamResponse);
        this.setConfigValue('repeat-penalty', config.repeatPenalty);
    }

    setConfigValue(id, value) {
        const element = document.getElementById(id);
        if (!element) return;

        if (element.type === 'checkbox') {
            element.checked = value;
        } else if (element.type === 'range') {
            element.value = value;
            // Update the corresponding value display
            const valueDisplay = document.getElementById(id + '-value');
            if (valueDisplay) {
                // Special handling for max-tokens to show "Unlimited" for -1
                if (id === 'max-tokens' && value === -1) {
                    valueDisplay.textContent = 'Unlimited';
                } else {
                    valueDisplay.textContent = value;
                }
            }
        } else {
            element.value = value;
        }
    }

    setupConfigEventListeners() {
        // Only set up listeners once
        if (this.configListenersSetup) return;
        this.configListenersSetup = true;

        // System prompt
        const systemPrompt = document.getElementById('system-prompt');
        if (systemPrompt) {
            systemPrompt.addEventListener('input', () => this.updateConfig('systemPrompt', systemPrompt.value));
        }

        // Sliders
        const sliders = ['temperature', 'top-k', 'top-p', 'max-tokens', 'repeat-penalty'];
        sliders.forEach(sliderId => {
            const slider = document.getElementById(sliderId);
            const valueDisplay = document.getElementById(sliderId + '-value');

            if (slider && valueDisplay) {
                slider.addEventListener('input', () => {
                    const value = parseFloat(slider.value);

                    // Special handling for max-tokens to show "Unlimited" for -1
                    if (sliderId === 'max-tokens' && value === -1) {
                        valueDisplay.textContent = 'Unlimited';
                    } else {
                        valueDisplay.textContent = value;
                    }

                    // Convert ID to config key
                    const configKey = this.getConfigKey(sliderId);
                    this.updateConfig(configKey, value);
                });
            }
        });

        // Checkbox
        const streamCheckbox = document.getElementById('stream-response');
        if (streamCheckbox) {
            streamCheckbox.addEventListener('change', () => {
                this.updateConfig('streamResponse', streamCheckbox.checked);
            });
        }
    }

    getConfigKey(sliderId) {
        const keyMap = {
            'temperature': 'temperature',
            'top-k': 'topK',
            'top-p': 'topP',
            'max-tokens': 'maxTokens',
            'repeat-penalty': 'repeatPenalty'
        };
        return keyMap[sliderId] || sliderId;
    }

    updateConfig(key, value) {
        if (!this.activeChat) return;

        const chatData = this.chats.get(this.activeChat);
        if (!chatData) return;

        // Ensure config exists
        if (!chatData.config) {
            chatData.config = { ...this.defaultConfig };
        }

        chatData.config[key] = value;
        this.saveChatData();
    }

    getRequestConfig() {
        if (!this.activeChat) return {};

        const chatData = this.chats.get(this.activeChat);
        if (!chatData || !chatData.config) return {};

        const config = chatData.config;

        // Build request config, omitting max_tokens when it's -1 (unlimited)
        const requestConfig = {
            temperature: config.temperature,
            top_k: config.topK,
            top_p: config.topP,
            stream: config.streamResponse,
            repeat_penalty: config.repeatPenalty,
            system_prompt: config.systemPrompt
        };

        // Only include max_tokens if it's not -1 (unlimited)
        if (config.maxTokens !== -1) {
            requestConfig.max_tokens = config.maxTokens;
        }

        return requestConfig;
    }

    async sendMessage() {
        if (!this.activeChat) return;

        const input = document.getElementById('chat-input');
        if (!input) return;

        const message = input.value.trim();

        if (!message) return;

        const chatData = this.chats.get(this.activeChat);
        if (!chatData || chatData.status !== 'connected') return;

        // Clear input and reset height
        input.value = '';
        // Reset textarea height to 2 lines
        input.style.height = 'auto';
        input.rows = 2;

        // Add user message to UI and data
        const userMessage = {
            role: 'user',
            content: message,
            timestamp: Date.now()
        };

        chatData.messages.push(userMessage);
        this.addMessageToUI(userMessage, true);

        // Show streaming indicator
        this.showStreamingIndicator();

        // Reset and start generation stats tracking
        this.resetGenerationStats();
        this.generationStats.startTime = Date.now();

        // Create abort controller for this request
        this.streamingAbortController = new AbortController();

        try {
            // Get chat configuration
            const requestConfig = this.getRequestConfig();

            // Prepare messages with system prompt if configured
            let messages = chatData.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            // Add system prompt if configured
            if (requestConfig.system_prompt && requestConfig.system_prompt.trim()) {
                messages.unshift({
                    role: 'system',
                    content: requestConfig.system_prompt
                });
            }

            const response = await fetch(`http://${chatData.host}:${chatData.port}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: messages,
                    stream: requestConfig.stream,
                    max_tokens: requestConfig.max_tokens,
                    temperature: requestConfig.temperature,
                    top_k: requestConfig.top_k,
                    top_p: requestConfig.top_p,
                    repeat_penalty: requestConfig.repeat_penalty
                }),
                signal: this.streamingAbortController.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Handle streaming response
            await this.handleStreamingResponse(response, chatData);

        } catch (error) {
            // Check if this is a cancellation
            const isCancelled = error.name === 'AbortError' ||
                (this.streamingAbortController && this.streamingAbortController.signal.aborted);

            this.hideStreamingIndicator();

            if (isCancelled) {
                // Don't show any error for cancellation - the hideStreamingIndicator handles the UI
                console.log('Request cancelled by user');
            } else if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
                this.addErrorMessage('Network error: Please check your connection and server status', 'Connection Error');
                // Automatically test connection
                setTimeout(() => {
                    this.testConnection(this.activeChat);
                }, 2000);
            } else if (error.message.includes('Stream connection lost after multiple retries')) {
                // This is likely due to a cancellation that wasn't properly caught
                console.log('Stream connection lost - likely due to cancellation');
            } else {
                this.addErrorMessage(`Error: ${error.message}`, 'Application Error');
            }
        } finally {
            this.streamingAbortController = null;
            // Reset send button to send icon
            this.updateSendButton(false);
        }
    }

    addMessageToUI(message, isNewMessage = false, isLastMessage = false) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        // Hide stats on previous last message when a new one is added
        if (isNewMessage) {
            const lastMessage = messagesContainer.querySelector('.chat-message:last-child');
            if (lastMessage) {
                const statsElement = lastMessage.querySelector('.message-stats');
                if (statsElement) {
                    statsElement.style.display = 'none';
                }
            }
        }

        // Only clear saved status message when adding a new message (not when loading existing ones)
        if (isNewMessage && this.activeChat) {
            const chatData = this.chats.get(this.activeChat);
            if (chatData && chatData.statusMessage) {
                chatData.statusMessage = null;
                this.saveChatData();
            }
        }

        // Remove status message if it exists
        const statusMessage = messagesContainer.querySelector('.chat-status');
        if (statusMessage) {
            statusMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${message.role}`;
        messageDiv.dataset.messageId = message.timestamp; // Add unique identifier

        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        
        messageDiv.innerHTML = `
            <div class="message-content">
                ${this.formatMessage(message.content, false)}
                <div class="message-time">${time}</div>
            </div>
            <div class="message-footer">
                <div class="message-actions">
                    <button class="message-delete-btn" onclick="chatApp.deleteMessage(${message.timestamp})" title="Delete message">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Add stats if this message has generation stats
        if (message.role === 'assistant' && message.generationStats) {
            const statsElement = this.updateStatsElement(messageDiv, message.generationStats);
            if (statsElement && !isLastMessage) {
                statsElement.style.display = 'none'; // Hide stats if it's not the last message
            }
        }

        // Setup sticky copy buttons for any code blocks in this message
        this.setupStickyCopyButtons(messageDiv);
    }





    formatMessage(content, isStreaming = false) {
        // Store think blocks with placeholders before HTML escaping
        const thinkBlocks = [];

        // Handle incomplete think blocks for streaming
        if (isStreaming) {
            // Check for incomplete think blocks and handle them appropriately
            content = this.handleStreamingThinkBlocks(content, thinkBlocks);
        } else {
            // Process both raw and escaped think tags for complete messages
            content = content.replace(/(?:<think>|&lt;think&gt;)([\s\S]*?)(?:<\/think>|&lt;\/think&gt;)/g, (match, thinkContent) => {
                // Decode HTML entities in think content if needed
                const decodedContent = thinkContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
                const thinkId = thinkBlocks.length;
                thinkBlocks.push(decodedContent.trim());
                return `__THINK_BLOCK_${thinkId}__`;
            });
        }

        // Escape HTML to prevent XSS
        content = this.escapeHtml(content);

        // Process code blocks - handle both complete and incomplete for streaming
        if (isStreaming) {
            content = this.handleStreamingCodeBlocks(content);
        } else {
            content = content.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
                // Remove leading/trailing newlines from code
                code = code.replace(/^\n+|\n+$/g, '');
                // Create language header if language is specified
                const languageHeader = language ? `<div class="code-language">${language}</div>` : '';
                // Create code block with optional language class
                const langClass = language ? ` class="language-${language}"` : '';
                return `<div class="code-block-container">${languageHeader}<pre><code${langClass}>${code}</code><button class="copy-button" onclick="chatApp.copyCode(this)">Copy</button></pre></div>`;
            });
        }

        // Process inline code
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Process bold and italic (after HTML escaping, so we need to match escaped asterisks)
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Convert newlines to <br>
        content = content.replace(/\n/g, '<br>');

        // Restore think blocks as collapsible elements
        content = content.replace(/__THINK_BLOCK_(\d+)__/g, (match, id) => {
            const thinkContent = thinkBlocks[parseInt(id)];

            // Use full content for both preview and expanded state
            const fullContent = this.escapeHtml(thinkContent);

            const thinkId = `think-${Date.now()}-${id}`;

            return `
                <div class="think-block collapsed" id="${thinkId}">
                    <div class="think-header" onclick="chatApp.toggleThinkBlock('${thinkId}')">
                        <span class="think-label">Thinking...</span>
                        <span class="think-toggle">▼</span>
                    </div>
                    <div class="think-preview">${fullContent.replace(/\n/g, '<br>')}</div>
                    <div class="think-content" style="display: none;">${fullContent.replace(/\n/g, '<br>')}</div>
                </div>
            `;
        });

        // Handle streaming think blocks with different placeholder - show only header during streaming
        content = content.replace(/__THINK_BLOCK_STREAMING_(\d+)__/g, (match, id) => {
            const thinkContent = thinkBlocks[parseInt(id)];
            const thinkId = `think-streaming-${Date.now()}-${id}`;

            // During streaming, only show header with pulsing indicator
            // Content will be displayed only after the complete block is received
            return `
                <div class="think-block streaming-only" id="${thinkId}">
                    <div class="think-header streaming-active">
                        <span class="think-label pulsing">Thinking...</span>
                    </div>
                </div>
            `;
        });

        return content;
    }

    showStreamingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        // Remove existing streaming indicator
        this.hideStreamingIndicator();

        const streamingDiv = document.createElement('div');
        streamingDiv.className = 'chat-message assistant streaming';
        streamingDiv.id = 'streaming-message';

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        streamingDiv.innerHTML = `
            <div class="message-content" id="streaming-content">
                <div class="streaming-placeholder">AI is responding...</div>
                <div class="message-time">${time}</div>
            </div>
            <div class="message-footer">
                <div class="message-actions">
                </div>
            </div>
        `;

        messagesContainer.appendChild(streamingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Update send button to show cancel icon
        this.updateSendButton(true);
    }

    hideStreamingIndicator() {
        const streamingIndicator = document.getElementById('streaming-message');
        if (streamingIndicator) {
            // Check if this is a cancellation by seeing if the abort controller is still active
            const isCancelled = this.streamingAbortController && this.streamingAbortController.signal.aborted;

            if (isCancelled) {
                // Convert to regular message with cancellation tag instead of removing
                streamingIndicator.classList.remove('streaming');

                // Add cancellation tag if not already present
                // Add final stats for cancelled message
                if (this.generationStats.tokenCount > 0) {
                    const stats = this.calculateGenerationStats('Cancelled by user');
                    if (stats) {
                        // Update stats element using helper method
                        this.updateStatsElement(streamingIndicator, stats, false);

                        // Save the cancelled message with stats
                        if (this.activeChat) {
                            const chatData = this.chats.get(this.activeChat);
                            if (chatData) {
                                const cancelledMessage = {
                                    role: 'assistant',
                                    content: streamingIndicator.querySelector('.message-content').textContent || 'Message was cancelled',
                                    timestamp: Date.now(),
                                    generationStats: stats
                                };
                                chatData.messages.push(cancelledMessage);
                                this.saveChatData();
                            }
                        }
                    }
                }
            } else {
                // Normal removal
                streamingIndicator.remove();
            }
        }
        // Update send button back to send icon
        this.updateSendButton(false);
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        // Remove existing typing indicator
        this.hideTypingIndicator();

        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message assistant typing';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-content">
                <span class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </span>
            </div>
        `;

        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    addErrorMessage(errorText, stopReason = 'Error') {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'chat-message error';

        // Add retry button for network errors
        const isNetworkError = errorText.includes('network') || errorText.includes('connection') || errorText.includes('Failed to fetch');
        const retryButton = isNetworkError ? '<button class="retry-btn" onclick="chatApp.retryLastMessage()">Retry</button>' : '';

        errorDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(errorText)}</div>
            <div class="message-footer">
                <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                ${retryButton}
            </div>
        `;

        messagesContainer.appendChild(errorDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async deleteMessage(messageTimestamp) {
        if (!this.activeChat) return;

        const chatData = this.chats.get(this.activeChat);
        if (!chatData) return;

        // Use reusable modal dialog with blur and darkened background
        let confirmed = false;
        try {
            confirmed = await ModalDialog.showConfirmation({
                title: 'Delete Message',
                message: 'Are you sure you want to delete this message?\n\nThis action cannot be undone.',
                confirmText: 'Delete',
                cancelText: 'Cancel',
                type: 'danger'
            });
        } catch (error) {
            console.error('Error showing confirmation dialog:', error);
            confirmed = confirm('Are you sure you want to delete this message?');
        }

        if (confirmed) {
            // Remove from data
            chatData.messages = chatData.messages.filter(msg => msg.timestamp !== messageTimestamp);

            // Remove from UI
            const messageElement = document.querySelector(`[data-message-id="${messageTimestamp}"]`);
            if (messageElement) {
                messageElement.remove();
            }

            // If no messages left, show status
            if (chatData.messages.length === 0) {
                this.loadChatMessages(this.activeChat);
            }

            this.saveChatData();
        }
    }

    toggleThinkBlock(thinkId) {
        const thinkBlock = document.getElementById(thinkId);
        if (!thinkBlock) return;

        const isCollapsed = thinkBlock.classList.contains('collapsed');
        const preview = thinkBlock.querySelector('.think-preview');
        const content = thinkBlock.querySelector('.think-content');
        const toggle = thinkBlock.querySelector('.think-toggle');
        const isStreaming = thinkBlock.classList.contains('streaming');

        if (isCollapsed) {
            // Expand
            thinkBlock.classList.remove('collapsed');
            thinkBlock.classList.add('expanded');
            preview.style.display = 'none';
            content.style.display = 'block';
            // Only update toggle arrow for non-streaming blocks
            if (toggle && !isStreaming) {
                toggle.textContent = '▲'; // Up arrow
            }
        } else {
            // Collapse
            thinkBlock.classList.remove('expanded');
            thinkBlock.classList.add('collapsed');
            preview.style.display = 'block';
            content.style.display = 'none';
            // Only update toggle arrow for non-streaming blocks
            if (toggle && !isStreaming) {
                toggle.textContent = '▼'; // Down arrow
            }
        }

        // Scroll to keep the think block in view if needed
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            const rect = thinkBlock.getBoundingClientRect();
            const containerRect = messagesContainer.getBoundingClientRect();

            if (rect.bottom > containerRect.bottom) {
                thinkBlock.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }
    }

    copyCode(button) {
        // Get the code content from the parent pre element's code child
        const preElement = button.closest('pre');
        if (!preElement) return;

        const codeElement = preElement.querySelector('code');
        if (!codeElement) return;

        // Get the original text content (preserves newlines)
        let codeText = codeElement.textContent || codeElement.innerText;

        // Ensure we preserve line breaks
        if (!codeText.includes('\n') && codeElement.innerHTML.includes('<br>')) {
            // If innerHTML has <br> tags, convert them to newlines
            codeText = codeElement.innerHTML
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]*>/g, '') // Remove other HTML tags
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');
        }

        // Copy to clipboard with fallback
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(codeText).then(() => {
                this.showCopySuccess(button);
            }).catch(err => {
                console.error('Failed to copy code: ', err);
                this.fallbackCopyToClipboard(codeText, button);
            });
        } else {
            this.fallbackCopyToClipboard(codeText, button);
        }
    }

    showCopySuccess(button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('copied');

        // Reset button after 2 seconds
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    }

    setupStickyCopyButtons(messageElement) {
        const codeBlocks = messageElement.querySelectorAll('.code-block-container pre');
        const messagesContainer = document.getElementById('chat-messages');

        if (!messagesContainer || codeBlocks.length === 0) return;

        // Remove existing scroll listener if any
        if (this.scrollListener) {
            messagesContainer.removeEventListener('scroll', this.scrollListener);
        }

        // Create new scroll listener
        this.scrollListener = () => {
            const containerRect = messagesContainer.getBoundingClientRect();
            const containerTop = containerRect.top;
            const containerBottom = containerRect.bottom;

            // Check all code blocks in all messages
            const allCodeBlocks = messagesContainer.querySelectorAll('.code-block-container pre');
            allCodeBlocks.forEach(codeBlock => {
                const copyButton = codeBlock.querySelector('.copy-button');
                if (!copyButton) return;

                const codeBlockRect = codeBlock.getBoundingClientRect();
                const codeBlockTop = codeBlockRect.top;
                const codeBlockBottom = codeBlockRect.bottom;

                // Check if code block is visible in container
                if (codeBlockBottom > containerTop && codeBlockTop < containerBottom) {
                    // Code block is visible
                    if (codeBlockTop < containerTop) {
                        // Code block extends above container, stick button to top
                        const offset = Math.min(containerTop - codeBlockTop + 8, codeBlockRect.height - 40);
                        copyButton.style.position = 'absolute';
                        copyButton.style.top = `${offset}px`;
                        copyButton.style.right = '8px';
                        copyButton.style.zIndex = '1000';
                    } else {
                        // Code block fully visible, position normally
                        copyButton.style.position = 'absolute';
                        copyButton.style.top = '8px';
                        copyButton.style.right = '8px';
                        copyButton.style.zIndex = '100';
                    }
                }
            });
        };

        // Add scroll listener
        messagesContainer.addEventListener('scroll', this.scrollListener);

        // Initial positioning
        this.scrollListener();
    }

    async handleStreamingResponse(response, chatData) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let messageStarted = false;
        let retryCount = 0;
        const maxRetries = 3;

        try {
            while (true) {
                let result;

                try {
                    result = await reader.read();
                } catch (readError) {
                    // Check if this is due to an abort signal
                    if (this.streamingAbortController && this.streamingAbortController.signal.aborted) {
                        throw new Error('Request was aborted');
                    }

                    console.warn('Stream read error:', readError);

                    if (retryCount < maxRetries) {
                        retryCount++;
                        console.log(`Retrying stream read (${retryCount}/${maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                        continue;
                    } else {
                        throw new Error('Stream connection lost after multiple retries');
                    }
                }

                const { done, value } = result;

                if (done) {
                    break;
                }

                // Reset retry count on successful read
                retryCount = 0;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            break;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                                const delta = parsed.choices[0].delta;

                                if (delta.content) {
                                    if (!messageStarted) {
                                        messageStarted = true;
                                        // Record time to first token
                                        if (!this.generationStats.firstTokenTime) {
                                            this.generationStats.firstTokenTime = Date.now();
                                        }
                                    }

                                    // Track token count (rough estimation - each character is roughly 0.75 tokens)
                                    // This is a simplified estimation - in practice, tokenization varies by model
                                    const estimatedTokens = Math.ceil(delta.content.length * 0.75);
                                    this.generationStats.tokenCount += estimatedTokens;
                                    this.generationStats.lastTokenTime = Date.now();

                                    fullContent += delta.content;
                                    this.updateStreamingMessage(fullContent);
                                }
                            }

                            // Check for usage information in the response (if available)
                            if (parsed.usage && parsed.usage.completion_tokens) {
                                // Use actual token count from API if available
                                this.generationStats.tokenCount = parsed.usage.completion_tokens;
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse streaming data:', data, parseError);
                            // Continue processing other lines instead of failing
                        }
                    }
                }

                // Check if request was aborted
                if (this.streamingAbortController && this.streamingAbortController.signal.aborted) {
                    throw new Error('Request was aborted');
                }
            }

            // Finalize the message
            this.hideStreamingIndicator();

            if (fullContent) {
                // Calculate final generation stats
                const stats = this.calculateGenerationStats();
                
                const assistantMessage = {
                    role: 'assistant',
                    content: fullContent,
                    timestamp: Date.now(),
                    generationStats: stats
                };

                chatData.messages.push(assistantMessage);
                this.addMessageToUI(assistantMessage, true, true);
                this.saveChatData();
            } else {
                throw new Error('No content received from server');
            }

        } catch (error) {
            this.hideStreamingIndicator();

            // If we have partial content, save it as an incomplete message
            if (fullContent) {
                const stats = this.calculateGenerationStats(error.name === 'AbortError' ? 'Cancelled by user' : 'Connection Error');
                const partialMessage = {
                    role: 'assistant',
                    content: fullContent,
                    timestamp: Date.now(),
                    generationStats: stats
                };
                chatData.messages.push(partialMessage);
                this.addMessageToUI(partialMessage, true, true);
                this.saveChatData();
            } else {
                // Add an error message if there's no content at all
                this.addErrorMessage(
                    error.name === 'AbortError' ? 'Request cancelled by user' : `Error: ${error.message}`,
                    error.name === 'AbortError' ? 'Cancelled' : 'Error'
                );
            }

            // Don't re-throw the error, as we've handled it by displaying a message
        } finally {
            // Clean up reader
            try {
                reader.releaseLock();
            } catch (e) {
                // Reader might already be released
            }
        }
    }

    updateStreamingMessage(content) {
        const streamingContent = document.getElementById('streaming-content');
        if (streamingContent) {
            // Remove placeholder if it exists
            const placeholder = streamingContent.querySelector('.streaming-placeholder');
            if (placeholder) {
                placeholder.remove();
            }

            // Update content
            streamingContent.innerHTML = this.formatMessage(content, true);
            
            // Auto-scroll to keep the streaming message in view
            const messagesContainer = document.getElementById('chat-messages');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            // Setup copy buttons for any new code blocks
            this.setupStickyCopyButtons(streamingContent);
        }
    }

    handleStreamingThinkBlocks(content, thinkBlocks) {
        // Handle complete think blocks
        content = content.replace(/(?:<think>|&lt;think&gt;)([\s\S]*?)(?:<\/think>|&lt;\/think&gt;)/g, (match, thinkContent) => {
            const decodedContent = thinkContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            const thinkId = thinkBlocks.length;
            thinkBlocks.push(decodedContent.trim());
            return `__THINK_BLOCK_${thinkId}__`;
        });

        // Handle incomplete think blocks (only opening tag)
        content = content.replace(/(?:<think>|&lt;think&gt;)([\s\S]*)$/g, (match, thinkContent) => {
            const decodedContent = thinkContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            const thinkId = thinkBlocks.length;
            thinkBlocks.push(decodedContent.trim());
            return `__THINK_BLOCK_STREAMING_${thinkId}__`;
        });

        return content;
    }

    handleStreamingCodeBlocks(content) {
        // Handle complete code blocks
        content = content.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
            code = code.replace(/^\n+|\n+$/g, '');
            const languageHeader = language ? `<div class="code-language">${language}</div>` : '';
            const langClass = language ? ` class="language-${language}"` : '';
            return `<div class="code-block-container">${languageHeader}<pre><code${langClass}>${code}</code><button class="copy-button" onclick="chatApp.copyCode(this)">Copy</button></pre></div>`;
        });

        // Handle incomplete code blocks (only opening ```)
        content = content.replace(/```(\w+)?\n?([\s\S]*)$/g, (match, language, code) => {
            const languageHeader = language ? `<div class="code-language">${language}</div>` : '';
            const langClass = language ? ` class="language-${language}"` : '';
            return `<div class="code-block-container streaming">${languageHeader}<pre><code${langClass}>${code}</code></pre></div>`;
        });

        return content;
    }

    retryLastMessage() {
        if (!this.activeChat) return;

        const chatData = this.chats.get(this.activeChat);
        if (!chatData || chatData.messages.length === 0) return;

        // Find the last user message
        const lastUserMessage = [...chatData.messages].reverse().find(msg => msg.role === 'user');
        if (!lastUserMessage) return;

        // Remove any error messages
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            const errorMessages = messagesContainer.querySelectorAll('.chat-message.error');
            errorMessages.forEach(msg => msg.remove());
        }

        // Simulate sending the last message again
        const input = document.getElementById('chat-input');
        if (input) {
            input.value = lastUserMessage.content;
            this.sendMessage();
        }
    }

    cancelCurrentRequest() {
        if (this.streamingAbortController) {
            this.streamingAbortController.abort();
            this.streamingAbortController = null;

            // Instead of hiding the streaming indicator, convert it to a regular message
            const streamingIndicator = document.getElementById('streaming-message');
            if (streamingIndicator) {
                // Remove streaming classes
                streamingIndicator.classList.remove('streaming');

                // Add cancellation tag
                // Update message content to remove placeholder
                const content = streamingIndicator.querySelector('.message-content');
                if (content) {
                    content.innerHTML = content.innerHTML.replace('<div class="streaming-placeholder">AI is responding...</div>', '');
                }
            }
        }
        // Reset send button to send icon
        this.updateSendButton(false);
    }

    updateSendButton(showCancel) {
        const sendButton = document.getElementById('chat-send');
        if (sendButton) {
            if (showCancel) {
                sendButton.innerHTML = '<span class="material-icons">close</span>';
                sendButton.classList.add('cancel-mode');
                sendButton.title = 'Cancel generation';
            } else {
                sendButton.innerHTML = '<span class="material-icons">arrow_upward</span>';
                sendButton.classList.remove('cancel-mode');
                sendButton.title = 'Send message';
            }
        }
    }

    handleSendButtonClick() {
        // Check if we're in cancel mode
        const sendButton = document.getElementById('chat-send');
        const isCancelMode = sendButton && sendButton.classList.contains('cancel-mode');

        if (isCancelMode) {
            this.cancelCurrentRequest();
        } else {
            this.sendMessage();
        }
    }

    cleanupScrollListeners() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer && this.scrollListener) {
            messagesContainer.removeEventListener('scroll', this.scrollListener);
            this.scrollListener = null;
        }
    }

    autoResizeInput(textarea) {
        // Store original height and reset to measure content
        const originalHeight = textarea.style.height;
        textarea.style.height = 'auto';

        const text = textarea.value;

        // Count explicit newlines (specification requirement)
        const explicitLines = text.split('\n');
        const explicitLineCount = explicitLines.length;

        // Calculate dimensions
        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(computedStyle.lineHeight);
        const paddingTop = parseFloat(computedStyle.paddingTop);
        const paddingBottom = parseFloat(computedStyle.paddingBottom);
        const borderTop = parseFloat(computedStyle.borderTopWidth);
        const borderBottom = parseFloat(computedStyle.borderBottomWidth);
        const totalPadding = paddingTop + paddingBottom;
        const totalBorder = borderTop + borderBottom;

        const maxLines = 10;
        const minLines = 2;

        // If textarea is empty or has minimal content, reset to 2 lines
        if (!text.trim()) {
            const minHeight = (lineHeight * minLines) + totalPadding;
            textarea.style.height = minHeight + 'px';
            textarea.rows = minLines;
            return;
        }

        // Measure actual content height to handle both newlines and wrapping
        const scrollHeight = textarea.scrollHeight;
        const contentHeight = scrollHeight - totalPadding - totalBorder;
        const measuredLines = Math.max(Math.round(contentHeight / lineHeight), explicitLineCount);

        // Apply constraints
        const targetLines = Math.max(Math.min(measuredLines, maxLines), minLines);
        const newHeight = (lineHeight * targetLines) + totalPadding;

        textarea.style.height = newHeight + 'px';
        textarea.rows = targetLines;

        // If content exceeds max lines, ensure scrollbar is visible
        if (measuredLines > maxLines) {
            textarea.style.overflowY = 'auto';
        } else {
            textarea.style.overflowY = 'hidden';
        }
    }

    handleInputKeydown(event) {
        // Check if we're in cancel mode (send button is in cancel mode)
        const sendButton = document.getElementById('chat-send');
        const isCancelMode = sendButton && sendButton.classList.contains('cancel-mode');

        // Cancel request on Enter (without Shift) when in cancel mode
        if (event.key === 'Enter' && !event.shiftKey && isCancelMode) {
            event.preventDefault();
            this.cancelCurrentRequest();
            return;
        }

        // Send message on Enter (without Shift) when in send mode
        if (event.key === 'Enter' && !event.shiftKey && !isCancelMode) {
            event.preventDefault();
            this.sendMessage();
        }
        // Allow Shift+Enter for new lines
    }

    fallbackCopyToClipboard(text, button) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showCopySuccess(button);
            }
        } catch (err) {
            console.error('Fallback copy failed: ', err);
        }

        document.body.removeChild(textArea);
    }

    async clearCurrentChat() {
        if (!this.activeChat) return;

        // Use the same styled confirmation dialog as desktop
        const confirmed = await ModalDialog.showConfirmation({
            title: 'Clear Chat',
            message: 'Are you sure you want to clear all messages in this chat?\n\nThis action cannot be undone.',
            confirmText: 'Clear',
            cancelText: 'Cancel',
            type: 'danger'
        });

        if (confirmed) {
            // Cancel any ongoing streaming request
            if (this.streamingAbortController) {
                this.streamingAbortController.abort();
                this.streamingAbortController = null;
            }

            // Hide any streaming indicators
            this.hideStreamingIndicator();

            const chatData = this.chats.get(this.activeChat);
            if (chatData) {
                chatData.messages = [];
                chatData.statusMessage = null; // Clear status message when clearing chat
                this.loadChatMessages(this.activeChat);
                this.saveChatData();
            }
        }
    }

    saveChatData() {
        try {
            const chatData = {};
            this.chats.forEach((data, id) => {
                chatData[id] = data;
            });
            localStorage.setItem('chatAppData', JSON.stringify(chatData));
        } catch (error) {
            console.error('Error saving chat data:', error);
        }
    }

    loadSavedChats() {
        try {
            const savedData = localStorage.getItem('chatAppData');
            if (savedData) {
                const chatData = JSON.parse(savedData);
                Object.entries(chatData).forEach(([id, data]) => {
                    // Ensure statusMessage field exists for backward compatibility
                    if (data.statusMessage === undefined) {
                        data.statusMessage = null;
                    }
                    this.chats.set(id, data);
                    this.addChatToList(data);

                    // Update counter to avoid ID conflicts
                    const counterMatch = id.match(/chat_(\d+)_/);
                    if (counterMatch) {
                        this.chatCounter = Math.max(this.chatCounter, parseInt(counterMatch[1]));
                    }
                });

                // Test connections for all chats
                this.chats.forEach((data, id) => {
                    this.testConnection(id);
                });
            }
            
            // Update sidebar visibility based on loaded chats
            this.updateSidebarVisibility();
        } catch (error) {
            console.error('Error loading saved chats:', error);
            // Still check sidebar visibility even if loading failed
            this.updateSidebarVisibility();
        }
    }

    // Disconnect all chats connected to a specific server
    disconnectChatsForServer(host, port) {
        console.log(`🔌 Disconnecting chats for server ${host}:${port}`);
        let disconnectedCount = 0;
        
        for (const [chatId, chatData] of this.chats.entries()) {
            if (chatData.host === host && chatData.port === port && chatData.status === 'connected') {
                console.log(`🔌 Disconnecting chat ${chatData.name} (${chatId}) from server ${host}:${port}`);
                chatData.status = 'disconnected';
                this.updateChatItemStatus(chatId, 'disconnected');
                disconnectedCount++;
                
                // If this was the active chat, update the connection button
                if (this.activeChat === chatId) {
                    this.updateConnectionButton('disconnected');
                }
            }
        }
        
        if (disconnectedCount > 0) {
            console.log(`✅ Disconnected ${disconnectedCount} chat(s) from server ${host}:${port}`);
            // Show notification to user
            if (window.desktop && window.desktop.showNotification) {
                window.desktop.showNotification(
                    `Disconnected ${disconnectedCount} chat session(s)`, 
                    'info'
                );
            }
        }
        
        return disconnectedCount;
    }

    // Save chat state to server session API
    async saveChatState(windowId, chatData) {
        try {
            // Get current messages from the chat window
            const messagesDiv = document.getElementById(`messages-${windowId}`);
            const messages = [];
            if (messagesDiv) {
                messagesDiv.querySelectorAll('.chat-message').forEach(msg => {
                    messages.push({
                        role: msg.classList.contains('user-message') ? 'user' : 'assistant',
                        content: msg.querySelector('.message-content')?.textContent || '',
                        timestamp: msg.dataset.timestamp || Date.now()
                    });
                });
            }

            const updatedChatData = { ...chatData, messages };
            this.chats.set(windowId, updatedChatData);

            const response = await fetch('/api/session/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ windowId, ...updatedChatData })
            });
            
            if (!response.ok) {
                console.error('Failed to save chat state:', response.statusText);
            }
        } catch (error) {
            console.error('Error saving chat state:', error);
        }
    }

    // Remove chat from session storage
    async removeChatFromSession(windowId) {
        try {
            if (this.chats.has(windowId)) {
                await fetch(`/api/session/chat/${windowId}`, { method: 'DELETE' });
                this.chats.delete(windowId);
            }
        } catch (error) {
            console.error('Error removing chat from session:', error);
        }
    }




}

// Global chat application instance
let chatApp = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    chatApp = new ChatApplication();
    // Make it globally available
    window.chatApp = chatApp;
});