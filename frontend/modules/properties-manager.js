// Properties Management Module
class PropertiesManager {
    constructor(desktop) {
        this.desktop = desktop;
        // Initialize Tauri API access
        this.invoke = null;
        this.initTauriAPI();
    }
    
    initTauriAPI() {
        try {
            if (window.__TAURI__ && window.__TAURI__.core) {
                this.invoke = window.__TAURI__.core.invoke;
                console.log('Tauri API initialized in PropertiesManager');
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

    showProperties(icon) {
        const modelPath = icon.dataset.path;
        const modelName = icon.dataset.name;
        console.log('Opening properties for:', modelPath);
        this.openPropertiesWindow(modelName, modelPath);
    }

    openPropertiesWindow(modelName, modelPath) {
        // Use consistent window ID based on model path to prevent multiple windows
        const windowId = 'props_' + btoa(modelPath).replace(/[^a-zA-Z0-9]/g, '');

        // Check if properties window is already open for this model
        const existingWindow = this.desktop.windows.get(windowId);
        if (existingWindow && !existingWindow.classList.contains('hidden')) {
            // Focus existing window
            existingWindow.style.zIndex = ++this.desktop.windowZIndex;
            return;
        }

        // Use Tauri command instead of fetch
        const invoke = this.getInvoke();
        if (!invoke) {
            console.error('Tauri invoke not available for loading model settings');
            this.desktop.showNotification('Error: Tauri API not available', 'error');
            return;
        }

        invoke('get_model_settings', { modelPath: modelPath })
            .then(async config => {
                console.log('Loaded config for', modelPath, ':', config);
                const content = await this.generatePropertiesContent(config, modelPath);
                const window = this.desktop.createWindow(windowId, `Properties - ${modelName}`, 'properties-window', content);
                // Add to taskbar
                this.desktop.addTaskbarItem(`Properties - ${modelName}`, windowId, '<span class="material-icons">settings</span>');
                this.setupPropertiesSync(window);
            })
            .catch(error => {
                console.error('Error loading model settings:', error);
                this.desktop.showNotification('Error loading model settings: ' + error.message, 'error');
            });
    }

    async generatePropertiesContent(config, modelPath) {
        try {
            // Load settings configuration
            const settingsConfig = await this.desktop.loadSettingsConfig();
            console.log('Settings config loaded:', settingsConfig.length, 'settings');
            
            // Parse current arguments to populate individual settings
            const parsedSettings = await this.desktop.parseArgumentsToSettings(config.custom_args || '');
            console.log('Parsed settings:', parsedSettings);
            
            // Filter to only show enabled settings
            const enabledSettings = settingsConfig.filter(setting => 
                parsedSettings[setting.id + '_enabled']
            );
            
            // Generate HTML for enabled settings only
            const settingsHTML = enabledSettings.map(setting => 
                this.desktop.generateSettingHTML(setting, parsedSettings)
            ).join('');
            
            // Generate sidebar with all settings, but hide enabled ones
            const sidebarItems = settingsConfig.map(setting => {
            	const isEnabled = parsedSettings[setting.id + '_enabled'];
            	const addedClass = isEnabled ? 'added' : '';
            	return `
            		<div class="sidebar-item ${addedClass}" data-setting-id="${setting.id}" title="${setting.description}">
            			${setting.name}
            		</div>
            	`;
            }).join('');
            
            return `
                <div class="properties-container">
                    <button class="delete-file-btn-floating" onclick="propertiesManager.deleteModelFile('${btoa(modelPath)}')" title="Delete this model file">
                        <span class="material-icons">delete</span>
                    </button>
                    
                    <div class="properties-sidebar">
                        <h4>Settings</h4>
                        <div class="sidebar-items">
                            ${sidebarItems}
                        </div>
                    </div>
                    
                    <div class="properties-main">
                        <div class="property-group" data-model-path="${btoa(modelPath)}">
                            <h4>Active Settings</h4>
                            <div class="active-settings">
                                ${settingsHTML || '<div class="no-settings">No settings configured. Click settings from the sidebar to add them.</div>'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="properties-button-container">
                        <div class="properties-bottom-section">
                            <div class="custom-args-section">
                                <h4>Custom Arguments</h4>
                                <textarea class="property-textarea" data-field="custom_args" placeholder="Additional custom arguments will be preserved">${config.custom_args || ''}</textarea>
                            </div>
                            <div class="button-section">
                                <div class="button-note">
                                    <small>Note: Changes to individual settings above will automatically update this field.</small>
                                </div>
                                <div class="button-group">
                                    <button class="properties-btn cancel-btn" onclick="propertiesManager.closePropertiesWindow()">Cancel</button>
                                    <button class="properties-btn save-btn" onclick="propertiesManager.saveProperties()">Save</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error generating properties content:', error);
            return `
                <div class="properties-container">
                    <button class="delete-file-btn-floating" onclick="propertiesManager.deleteModelFile('${btoa(modelPath)}')" title="Delete this model file">
                        <span class="material-icons">delete</span>
                    </button>
                    
                    <div class="properties-sidebar">
                        <h4>Settings</h4>
                        <div class="sidebar-items">
                            <div style="color: var(--theme-text-muted); font-style: italic; padding: 20px; text-align: center;">
                                Error loading settings
                            </div>
                        </div>
                    </div>
                    
                    <div class="properties-main">
                        <div class="property-group" data-model-path="${btoa(modelPath)}">
                            <h4>Error Loading Settings</h4>
                            <p>Failed to load model settings configuration. Please check the console for details.</p>
                        </div>
                    </div>
                    
                    <div class="properties-button-container">
                        <div class="properties-bottom-section">
                            <div class="custom-args-section">
                                <h4>Custom Arguments</h4>
                                <textarea class="property-textarea" data-field="custom_args" placeholder="Enter custom arguments manually">${config.custom_args || ''}</textarea>
                            </div>
                            <div class="button-section">
                                <div class="button-note">
                                    <small>Note: Manual entry only in error mode.</small>
                                </div>
                                <div class="button-group">
                                    <button class="properties-btn cancel-btn" onclick="propertiesManager.closePropertiesWindow()">Cancel</button>
                                    <button class="properties-btn save-btn" onclick="propertiesManager.saveProperties()">Save</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    setupPropertiesSync(window) {
        const customArgsTextarea = window.querySelector('[data-field="custom_args"]');
        const sidebarItems = window.querySelectorAll('.sidebar-item');
        
        // Set up sidebar item interactions
        sidebarItems.forEach(item => {
        	item.addEventListener('click', async () => {
        		const settingId = item.dataset.settingId;
        		if (item.classList.contains('added')) {
        			await this.removeSetting(settingId);
        		} else {
        			await this.addSettingToArguments(settingId, customArgsTextarea);
        		}
        	});
        });
        
        // Delegate sync functionality to desktop for now
        this.desktop.setupPropertiesSync(window);
    }

    async addSettingToArguments(settingId, customArgsTextarea) {
        try {
            // Load settings configuration
            const settingsConfig = await this.desktop.loadSettingsConfig();
            const setting = settingsConfig.find(s => s.id === settingId);
            
            if (!setting) {
                console.error('Setting not found:', settingId);
                return;
            }

            // Parse current arguments to get settings object
            const currentArgs = customArgsTextarea.value || '';
            const parsedSettings = await this.desktop.parseArgumentsToSettings(currentArgs);
            
            // Enable the setting with default value
            parsedSettings[settingId + '_enabled'] = true;
            if (!parsedSettings[settingId]) {
                if (setting.isFlag || setting.type === 'toggle') {
                    parsedSettings[settingId] = true;
                } else {
                    parsedSettings[settingId] = setting.default || '';
                }
            }
            
            // Update the custom args textarea
            const newArgs = await this.desktop.settingsToArguments(parsedSettings, currentArgs);
            customArgsTextarea.value = newArgs;
            
            // Regenerate the active settings area in correct order
            const activeWindow = document.querySelector('.properties-window:not(.hidden)');
            if (activeWindow) {
                await this.regenerateActiveSettings(activeWindow, settingsConfig, parsedSettings);
                
                // Hide the setting from sidebar
                const sidebarItem = activeWindow.querySelector(`.sidebar-item[data-setting-id="${settingId}"]`);
                if (sidebarItem) {
                	sidebarItem.classList.add('added');
                }
            }
            
            console.log('Added setting:', settingId);
            
        } catch (error) {
            console.error('Error adding setting to arguments:', error);
            this.desktop.showNotification('Error adding setting: ' + error.message, 'error');
        }
    }

    async saveProperties() {
        const activeWindow = document.querySelector('.properties-window:not(.hidden)');
        if (!activeWindow) {
            this.desktop.showNotification('No properties window found', 'error');
            return;
        }

        const propertyGroup = activeWindow.querySelector('.property-group[data-model-path]');
        if (!propertyGroup) {
            this.desktop.showNotification('Model path not found', 'error');
            return;
        }

        const modelPath = atob(propertyGroup.dataset.modelPath);
        const textarea = activeWindow.querySelector('[data-field="custom_args"]');
        const customArgs = textarea ? textarea.value.trim() : '';

        console.log('Saving arguments for', modelPath, ':', customArgs);

        try {
            // Use Tauri command instead of fetch
            const invoke = this.getInvoke();
            if (!invoke) {
                throw new Error('Tauri API not available');
            }

            // Create ModelConfig object to match Rust struct
            const config = {
                custom_args: customArgs,
                server_host: '127.0.0.1',
                server_port: 8080,
                model_path: modelPath
            };

            await invoke('update_model_settings', {
                modelPath: modelPath,
                config: config
            });

            this.desktop.showNotification('Arguments saved successfully!', 'success');
            
            // Update custom arguments indicators
            await this.desktop.updateCustomArgsIndicators();
            
            this.closePropertiesWindow();
        } catch (error) {
            console.error('Error saving settings:', error);
            this.desktop.showNotification('Error saving settings: ' + error.message, 'error');
        }
    }

    closePropertiesWindow() {
        const activeWindow = document.querySelector('.properties-window:not(.hidden)');
        if (activeWindow) {
            this.desktop.closeWindow(activeWindow.id);
        }
    }

    async removeSetting(settingId) {
        try {
            const activeWindow = document.querySelector('.properties-window:not(.hidden)');
            if (!activeWindow) {
                console.error('No active properties window found');
                return;
            }

            const customArgsTextarea = activeWindow.querySelector('[data-field="custom_args"]');
            if (!customArgsTextarea) {
                console.error('Custom args textarea not found');
                return;
            }

            // Parse current arguments and disable the setting
            const currentArgs = customArgsTextarea.value || '';
            const parsedSettings = await this.desktop.parseArgumentsToSettings(currentArgs);
            
            // Disable the setting
            parsedSettings[settingId + '_enabled'] = false;
            delete parsedSettings[settingId];
            
            // Update the custom args textarea
            const newArgs = await this.desktop.settingsToArguments(parsedSettings, currentArgs);
            customArgsTextarea.value = newArgs;
            
            // Load settings configuration and regenerate active settings in correct order
            const settingsConfig = await this.desktop.loadSettingsConfig();
            await this.regenerateActiveSettings(activeWindow, settingsConfig, parsedSettings);
            
            // Show the setting back in sidebar
            const sidebarItem = activeWindow.querySelector(`.sidebar-item[data-setting-id="${settingId}"]`);
            if (sidebarItem) {
            	sidebarItem.classList.remove('added');
            }
            
            console.log('Removed setting:', settingId);
            
        } catch (error) {
            console.error('Error removing setting:', error);
            this.desktop.showNotification('Error removing setting: ' + error.message, 'error');
        }
    }

    async regenerateActiveSettings(activeWindow, settingsConfig, parsedSettings) {
        try {
            // Filter to only show enabled settings in the correct order
            const enabledSettings = settingsConfig.filter(setting => 
                parsedSettings[setting.id + '_enabled']
            );
            
            // Generate HTML for enabled settings in correct order
            const settingsHTML = enabledSettings.map(setting => 
                this.desktop.generateSettingHTML(setting, parsedSettings)
            ).join('');
            
            // Update the active settings container
            const activeSettingsContainer = activeWindow.querySelector('.active-settings');
            if (activeSettingsContainer) {
                activeSettingsContainer.innerHTML = settingsHTML || '<div class="no-settings">No settings configured. Click settings from the sidebar to add them.</div>';
                
                // Re-setup event listeners for all settings
                if (activeWindow.setupSettingInputListeners) {
                    activeWindow.setupSettingInputListeners();
                }
            }
        } catch (error) {
            console.error('Error regenerating active settings:', error);
        }
    }

    async addSettingById(settingId) {
        try {
            const activeWindow = document.querySelector('.properties-window:not(.hidden)');
            if (!activeWindow) {
                console.error('No active properties window found');
                return;
            }

            const customArgsTextarea = activeWindow.querySelector('[data-field="custom_args"]');
            if (!customArgsTextarea) {
                console.error('Custom args textarea not found');
                return;
            }

            await this.addSettingToArguments(settingId, customArgsTextarea);
            
        } catch (error) {
            console.error('Error adding setting by ID:', error);
            this.desktop.showNotification('Error adding setting: ' + error.message, 'error');
        }
    }
    
    async deleteModelFile(encodedModelPath) {
        // Decode the base64-encoded model path
        const modelPath = atob(encodedModelPath);
        const filename = modelPath.split(/[\\/]/).pop(); // Get filename from path
        
        // Show confirmation dialog using reusable modal
        const confirmed = await ModalDialog.showConfirmation({
            title: 'Delete File',
            message: `Are you sure you want to delete "${filename}"?\n\nThis action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            type: 'danger'
        });
        
        if (!confirmed) {
            return;
        }
        
        try {
            // Use Tauri command instead of fetch
            const invoke = this.getInvoke();
            if (!invoke) {
                throw new Error('Tauri API not available');
            }

            const result = await invoke('delete_model_file', {
                modelPath: modelPath
            });
            
            // Check if the deletion was successful
            if (!result.success) {
                throw new Error(result.error || 'Unknown error occurred');
            }
            
            // The file-deleted event will handle updating the desktop icons without animations
            this.desktop.showNotification(`Successfully deleted "${filename}"`, 'success');
            
            // Close the properties window
            this.closePropertiesWindow();
            
        } catch (error) {
            console.error('Error deleting model file:', error);
            this.desktop.showNotification(`Failed to delete file: ${error.message}`, 'error');
        }
    }
    
    async showInlineConfirmationDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            const activeWindow = document.querySelector('.properties-window:not(.hidden)');
            if (!activeWindow) {
                resolve(false);
                return;
            }
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'properties-modal-overlay';
            
            // Create modal dialog
            const modal = document.createElement('div');
            modal.className = 'properties-confirmation-modal';
            modal.innerHTML = `
                <div class="modal-header">
                    <h3>${title}</h3>
                </div>
                <div class="modal-body">
                    <p style="white-space: pre-line; margin-bottom: 20px;">${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary cancel-btn">${cancelText}</button>
                    <button class="btn btn-danger confirm-btn">${confirmText}</button>
                </div>
            `;
            
            // Add event listeners
            const cancelBtn = modal.querySelector('.cancel-btn');
            const confirmBtn = modal.querySelector('.confirm-btn');
            
            const cleanup = () => {
                overlay.remove();
            };
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            });
            
            // Close on Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
            
            // Add modal to overlay and overlay to window
            overlay.appendChild(modal);
            activeWindow.appendChild(overlay);
        });
    }
}