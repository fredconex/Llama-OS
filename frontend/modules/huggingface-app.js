// Hugging Face Application Module
class HuggingFaceApp {
    constructor(desktop) {
        this.desktop = desktop;
        this.windowId = 'huggingface-search';
        // Initialize Tauri API access - defer until needed
        this.invoke = null;
        this.tauriInitialized = false;
        // Don't call initTauriAPI here - wait until first use
        this.setupEventListeners();
    }
    
    initTauriAPI() {
        if (this.tauriInitialized) return;
        
        try {
            if (window.__TAURI__ && window.__TAURI__.core) {
                this.invoke = window.__TAURI__.core.invoke;
                this.tauriInitialized = true;
                console.log('Tauri API initialized in HuggingFaceApp');
            } else {
                console.warn('Tauri API not available yet, will retry when needed');
                this.tauriInitialized = false;
            }
        } catch (error) {
            console.error('Failed to initialize Tauri API:', error);
            this.tauriInitialized = false;
        }
    }
    
    async waitForTauriAPI(maxAttempts = 10, delay = 500) {
        if (this.tauriInitialized) return true;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`Attempting to initialize Tauri API (attempt ${attempt}/${maxAttempts})...`);
            this.initTauriAPI();
            
            if (this.tauriInitialized) {
                console.log('Tauri API initialized successfully');
                return true;
            }
            
            if (attempt < maxAttempts) {
                console.log(`Tauri API not ready, waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        console.error('Failed to initialize Tauri API after maximum attempts');
        return false;
    }
    
    setupEventListeners() {
        // Listen for file system changes to update download status
        if (window.__TAURI__ && window.__TAURI__.event) {
            // Listen for file deletion events
            window.__TAURI__.event.listen('file-deleted', () => {
                console.log('File deleted event received in HuggingFace app, refreshing download status...');
                this.refreshAllDownloadStatus();
            });
            
            // Listen for download completion events
            window.__TAURI__.event.listen('download-complete', () => {
                console.log('Download complete event received, refreshing download status...');
                setTimeout(() => {
                    this.refreshAllDownloadStatus();
                }, 1000); // Small delay to ensure file is fully written
            });
        }
    }
    
    getInvoke() {
        if (!this.tauriInitialized) {
            this.initTauriAPI();
        }
        return this.invoke;
    }

    isInitialized() {
        return this.tauriInitialized && this.invoke !== null;
    }

    async openHuggingFaceSearch() {
        // Check if Tauri API is available
        if (!this.isInitialized()) {
            console.warn('HuggingFace app not fully initialized, attempting to initialize...');
            
            // Try to wait for Tauri API to be ready
            const apiReady = await this.waitForTauriAPI();
            if (!apiReady) {
                this.desktop.showNotification('HuggingFace app failed to initialize Tauri API', 'error');
                return;
            }
        }
        
        // Check if window already exists
        const existingWindow = this.desktop.windows.get(this.windowId);
        if (existingWindow && !existingWindow.classList.contains('hidden')) {
            existingWindow.style.zIndex = ++this.desktop.windowZIndex;
            return;
        }
        
        const content = `
            <div class="huggingface-search-container">
                <div class="search-section">
                    <div class="search-header">
                        <h3>Hugging Face Model Search</h3>
                        <p>Search and download llama.cpp compatible GGUF models from Hugging Face</p>
                    </div>
                    <div class="search-controls">
                        <input type="text" id="hf-search-input" class="search-input" placeholder="Search for models (e.g., llama, mistral, qwen, codellama)" autocomplete="off">
                        <div class="limit-controls">
                            <label for="hf-limit">Show:</label>
                            <select id="hf-limit" class="limit-select">
                                <option value="50">50</option>
                                <option value="100" selected>100</option>
                                <option value="250">250</option>
                                <option value="500">500</option>
                            </select>
                        </div>
                        <div class="sorting-controls">
                            <label for="hf-sort-by">Sort by:</label>
                            <select id="hf-sort-by" class="sort-select">
                                <option value="relevance">Relevance</option>
                                <option value="downloads">Most Downloads</option>
                                <option value="likes">Most Likes</option>
                                <option value="updated">Recently Updated</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="search-results" id="hf-search-results">
                    <div class="search-placeholder">
                        <div class="search-placeholder-icon">Search</div>
                        <p>Enter a search term and press Enter to find llama.cpp compatible models</p>
                        <div class="search-suggestions">
                            <span class="suggestion-label">Popular searches:</span>
                            <button class="suggestion-btn" onclick="huggingFaceApp.quickSearch('llama')"># llama</button>
                            <button class="suggestion-btn" onclick="huggingFaceApp.quickSearch('mistral')"># mistral</button>
                            <button class="suggestion-btn" onclick="huggingFaceApp.quickSearch('qwen')"># qwen</button>
                            <button class="suggestion-btn" onclick="huggingFaceApp.quickSearch('codellama')"># codellama</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const window = this.desktop.createWindow(this.windowId, 'Hugging Face Models', 'huggingface-search-window', content);
        window.style.width = '900px';
        window.style.height = '700px';
        window.style.left = 'calc(50% - 450px)';
        window.style.top = '50px';
        
        // Add event listeners
        this.setupHuggingFaceSearchListeners();
        
        this.desktop.addTaskbarItem('Hugging Face', this.windowId, 'HF');
    }
    
    setupHuggingFaceSearchListeners() {
        const window = this.desktop.windows.get(this.windowId);
        if (!window) return;
        
        const searchInput = window.querySelector('#hf-search-input');
        const sortBySelect = window.querySelector('#hf-sort-by');
        const limitSelect = window.querySelector('#hf-limit');
        
        // Enter key in search input
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performHuggingFaceSearch();
            }
        });
        
        // Sort by change
        sortBySelect.addEventListener('change', () => {
            this.performHuggingFaceSearch();
        });
        
        // Limit change
        limitSelect.addEventListener('change', () => {
            this.performHuggingFaceSearch();
        });
        
        // Focus search input
        setTimeout(() => searchInput.focus(), 100);
    }
    
    // Helper function to format time ago
    formatTimeAgo(dateString) {
        if (!dateString) {
            console.log('formatTimeAgo: dateString is null/undefined');
            return 'Unknown';
        }
        
        try {
            const date = new Date(dateString);
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.log('formatTimeAgo: Invalid date:', dateString);
                return 'Unknown';
            }
            
            const now = new Date();
            const diffInMs = now - date;
            const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
            
            if (diffInDays < 0) {
                console.log('formatTimeAgo: Future date detected:', dateString);
                return 'Recently';
            }
            
            if (diffInDays === 0) return 'Today';
            if (diffInDays === 1) return '1 day ago';
            if (diffInDays < 7) return `${diffInDays} days ago`;
            if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
            if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
            return `${Math.floor(diffInDays / 365)} years ago`;
        } catch (error) {
            console.error('formatTimeAgo error:', error, 'dateString:', dateString);
            return 'Unknown';
        }
    }

    formatFileSize(bytes) {
        return this.desktop.formatFileSize(bytes);
    }
    
    formatNumber(num) {
        return this.desktop.formatNumber(num);
    }
    
    async performHuggingFaceSearch() {
        const window = this.desktop.windows.get(this.windowId);
        if (!window) return;
        
        const searchInput = window.querySelector('#hf-search-input');
        const resultsContainer = window.querySelector('#hf-search-results');
        const sortBySelect = window.querySelector('#hf-sort-by');
        const limitSelect = window.querySelector('#hf-limit');
        
        const query = searchInput.value.trim();
        if (!query) {
            this.desktop.showNotification('Please enter a search term', 'error');
            return;
        }
        
        // Show loading state
        searchInput.disabled = true;
        resultsContainer.innerHTML = `
            <div class="search-loading">
                <div class="loading-spinner"></div>
                <p>Searching Hugging Face for "${query}"...</p>
            </div>
        `;
        
        try {
            const invoke = this.getInvoke();
            if (!invoke) {
                throw new Error('Tauri API not available');
            }
            
            const result = await invoke('search_huggingface', {
                query: query,
                limit: parseInt(limitSelect.value),
                sortBy: sortBySelect.value
            });
            
            this.displayHuggingFaceResults(result.models, query);
            
        } catch (error) {
            console.error('Search error:', error);
            resultsContainer.innerHTML = `
                <div class="search-error">
                    <div class="error-icon">Error</div>
                    <h4>Search Failed</h4>
                    <p>${error.message}</p>
                    <button onclick="huggingFaceApp.performHuggingFaceSearch()" class="retry-btn">Try Again</button>
                </div>
            `;
            this.desktop.showNotification('Search failed: ' + error.message, 'error');
        } finally {
            searchInput.disabled = false;
        }
    }

    displayHuggingFaceResults(models, query) {
        const window = this.desktop.windows.get(this.windowId);
        if (!window) return;
        
        const resultsContainer = window.querySelector('#hf-search-results');
        
        if (!models || models.length === 0) {
            resultsContainer.innerHTML = `
                <div class="search-no-results">
                    <div class="no-results-icon">No Results</div>
                    <h4>No Models Found</h4>
                    <p>No llama.cpp compatible models found for "${query}"</p>
                    <p>Try different search terms like 'llama', 'mistral', 'qwen', or 'codellama'</p>
                </div>
            `;
            return;
        }
        
        // Create the two-panel layout with simplified list
        const resultsHTML = `
            <div class="search-results-header">
                <h4>Found ${models.length} llama.cpp compatible models for "${query}"</h4>
            </div>
            <div class="search-results-content">
                <div class="models-sidebar">
                    <div class="models-list">
                        ${models.map((model, index) => {
                            const updatedText = model.lastModified ? this.formatTimeAgo(model.lastModified) : 'Unknown';
                            
                            return `
                                <div class="model-list-item ${index === 0 ? 'selected' : ''}" data-model-index="${index}" onclick="huggingFaceApp.selectModel(${index})">
                                    <div class="model-list-name">${model.name}</div>
                                    <div class="model-list-author">by ${model.author}</div>
                                    <div class="model-list-stats">
                                        <span class="stat-downloads" title="${this.formatNumber(model.downloads)} downloads">⬇ ${this.formatNumber(model.downloads)}</span>
                                        <span class="stat-likes" title="${this.formatNumber(model.likes)} likes">❤ ${this.formatNumber(model.likes)}</span>
                                        <span class="stat-updated" title="Last updated: ${model.lastModified || 'Unknown'}">${updatedText}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="model-details-panel">
                    <div id="model-details-content">
                        <div class="model-detail-placeholder">
                            <h3>Select a model to view details</h3>
                            <p>Click on a model from the list to see detailed information, available GGUF files, and download options.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        resultsContainer.innerHTML = resultsHTML;
        
        // Store models data for selection
        window._modelsData = models;
        
        // Auto-select first model if available
        if (models.length > 0) {
            setTimeout(() => this.selectModel(0), 100);
        }
    }

    selectModel(index) {
        const window = this.desktop.windows.get(this.windowId);
        if (!window || !window._modelsData) return;
        
        // Update selected item in list
        window.querySelectorAll('.model-list-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
        });
        
        // Get the basic model info
        const basicModel = window._modelsData[index];
        const detailsContent = window.querySelector('#model-details-content');
        
        // Show basic info immediately with loading state
        detailsContent.innerHTML = `
            <div class="model-detail-header">
                <div class="model-header-top">
                    <h3 class="model-detail-name">${basicModel.name}</h3>
                    <button class="model-page-btn" onclick="desktop.openUrl('https://huggingface.co/${basicModel.id}')" title="Open model page on Hugging Face">
                        View on HF
                    </button>
                </div>
                <div class="model-detail-meta">
                    <span class="model-detail-author">by ${basicModel.author}</span>
                </div>
            </div>
            
            <div class="model-stats-compact">
                <div class="stat-row">
                    <div class="stat-compact">
                        <span class="stat-number">${this.formatNumber(basicModel.downloads)}</span>
                        <span class="stat-label">Downloads</span>
                    </div>
                    <div class="stat-compact">
                        <span class="stat-number">${this.formatNumber(basicModel.likes)}</span>
                        <span class="stat-label">Likes</span>
                    </div>
                    <div class="stat-compact">
                        <span class="stat-number">Loading...</span>
                        <span class="stat-label">Files</span>
                    </div>
                    <div class="stat-compact">
                        <span class="stat-number">Loading...</span>
                        <span class="stat-label">GGUF Files</span>
                    </div>
                </div>
            </div>
            
            <div class="model-detail-download">
                <h4>Available GGUF Files</h4>
                <div class="quantizations-list">
                    <div class="quant-item">
                        <div class="quant-info">
                            <span class="quant-name">Loading...</span>
                            <span class="quant-size"></span>
                        </div>
                        <button class="quant-download-btn" disabled data-status="unknown">
                            Loading
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Fetch detailed model information in the background
        this.fetchModelDetails(basicModel.id, index)
            .then(detailedModel => {
                // Update details panel with full information only if still selected
                const currentSelected = window.querySelector('.model-list-item.selected');
                if (currentSelected && parseInt(currentSelected.dataset.modelIndex) === index) {
                    detailsContent.innerHTML = this.generateModelDetails(detailedModel, index);
                    
                    // Store model data for download access
                    detailsContent.modelData = detailedModel;
                    
                    // Check download status for each GGUF file
                    this.updateFileDownloadStatus(detailedModel);
                }
            })
            .catch(error => {
                console.error('Error fetching model details:', error);
                // Only show error if this model is still selected
                const currentSelected = window.querySelector('.model-list-item.selected');
                if (currentSelected && parseInt(currentSelected.dataset.modelIndex) === index) {
                    detailsContent.innerHTML = `
                        <div class="model-detail-error">
                            <h3>${basicModel.name}</h3>
                            <p>Error loading model details: ${error.message}</p>
                            <p>This model may not have GGUF files available.</p>
                            <button onclick="huggingFaceApp.selectModel(${index})" class="retry-btn">Retry</button>
                        </div>
                    `;
                }
            });
    }
    
    async fetchModelDetails(modelId) {
        // Check cache first
        const window = this.desktop.windows.get(this.windowId);
        if (!window._modelDetailsCache) {
            window._modelDetailsCache = new Map();
        }
        
        // Return cached data if available
        if (window._modelDetailsCache.has(modelId)) {
            return window._modelDetailsCache.get(modelId);
        }
        
        try {
            const invoke = this.getInvoke();
            if (!invoke) {
                throw new Error('Tauri API not available');
            }
            
            const result = await invoke('get_model_details', {
                modelId: modelId
            });
            
            // Cache the result
            window._modelDetailsCache.set(modelId, result);
            
            return result;
            
        } catch (error) {
            console.error('Error fetching model details:', error);
            throw error;
        }
    }
    
    generateModelDetails(model, index) {
        // Sort GGUF files by size (smallest first)
        const sortedFileKeys = Object.keys(model.gguf_files).sort((a, b) => {
            const sizeA = model.gguf_files[a].size || 0;
            const sizeB = model.gguf_files[b].size || 0;
            return sizeA - sizeB;
        });
        
        // Group files by similarity and create styled items
        const fileGroups = this.groupFilesBySimilarity(sortedFileKeys);
        const fileItems = sortedFileKeys.map(filename => {
            const fileData = model.gguf_files[filename];
            const size = this.formatFileSize(fileData.size);
            const sizeText = size !== 'Unknown size' ? ` (${size})` : '';
            
            // Remove .gguf extension and find common parts within the file's group
            const displayName = filename.replace(/\.gguf$/i, '');
            const fileGroup = fileGroups.find(group => group.includes(filename));
            const styledName = this.styleFilenameWithinGroup(displayName, fileGroup || [filename]);
            
            return `
                <div class="quant-item" data-filename="${filename}" data-model-id="${model.id}">
                    <div class="quant-info">
                        <span class="quant-name">${styledName}</span>
                        <span class="quant-size">${sizeText}</span>
                    </div>
                    <button class="quant-download-btn" onclick="huggingFaceApp.downloadFile('${model.id}', '${filename}', ${index})" data-status="unknown">
                        Download
                    </button>
                </div>
            `;
        }).join('');
        
        return `
            <div class="model-detail-header">
                <div class="model-header-top">
                    <h3 class="model-detail-name">${model.name}</h3>
                    <button class="model-page-btn" onclick="desktop.openUrl('https://huggingface.co/${model.id}')" title="Open model page on Hugging Face">
                        View on HF
                    </button>
                </div>
                <div class="model-detail-meta">
                    <span class="model-detail-author">by ${model.author}</span>
                </div>
            </div>
            
            <div class="model-stats-compact">
                <div class="stat-row">
                    <div class="stat-compact">
                        <span class="stat-number">${this.formatNumber(model.downloads)}</span>
                        <span class="stat-label">Downloads</span>
                    </div>
                    <div class="stat-compact">
                        <span class="stat-number">${this.formatNumber(model.likes)}</span>
                        <span class="stat-label">Likes</span>
                    </div>
                    <div class="stat-compact">
                        <span class="stat-number">${model.total_files}</span>
                        <span class="stat-label">Files</span>
                    </div>
                    <div class="stat-compact">
                        <span class="stat-number">${Object.keys(model.gguf_files).length}</span>
                        <span class="stat-label">GGUF Files</span>
                    </div>
                </div>
            </div>
            
            ${model.description ? `
            <div class="model-detail-description">
                <p>${model.description}</p>
            </div>
            ` : ''}
            
            <div class="model-detail-download">
                <h4>Available GGUF Files</h4>
                <div class="quantizations-list">
                    ${fileItems}
                </div>
            </div>
        `;
    }
    
    async downloadFile(modelId, filename, index) {
        const window = this.desktop.windows.get(this.windowId);
        if (!window) return;
        
        // Find and check the download button state
        const fileItem = window.querySelector(`[data-filename="${filename}"][data-model-id="${modelId}"]`);
        const downloadBtn = fileItem?.querySelector('.quant-download-btn');
        
        // Don't allow download if file is already downloaded
        if (downloadBtn && downloadBtn.dataset.status === 'downloaded') {
            this.desktop.showNotification('File already downloaded', 'info');
            return;
        }
        
        // Get model data from the details content
        const detailsContent = window.querySelector('#model-details-content');
        const modelData = detailsContent.modelData;
        
        if (!modelData || !modelData.gguf_files[filename]) {
            this.desktop.showNotification('Error: file data not found', 'error');
            return;
        }
        
        // Double-check if file exists before starting download
        const invoke = this.getInvoke();
        if (!invoke) {
            this.desktop.showNotification('Error: Tauri API not available', 'error');
            return;
        }
        
        try {
            const fileExists = await invoke('check_file_exists', {
                modelId: modelId,
                filename: filename
            });
            
            if (fileExists) {
                this.desktop.showNotification('File already exists', 'info');
                // Update button state
                if (downloadBtn) {
                    downloadBtn.innerHTML = 'Downloaded';
                    downloadBtn.dataset.status = 'downloaded';
                    downloadBtn.disabled = true;
                    downloadBtn.classList.add('downloaded');
                }
                return;
            }
        } catch (error) {
            console.error('Error checking file existence:', error);
        }
        
        const fileData = modelData.gguf_files[filename];
        const files = [filename]; // Just the single file
        
        if (downloadBtn) {
            // Disable the button and show downloading state
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = 'Downloading...';
            downloadBtn.dataset.status = 'downloading';
        }
        
        invoke('download_model', {
            modelId: modelId,
            filename: filename,
            files: files
        }).then(result => {
            console.log('Download command successful:', result);
            this.desktop.showNotification(`Download started: ${result.download_id}`, 'success');
            
            // Store the download ID for tracking
            if (downloadBtn) {
                downloadBtn.dataset.downloadId = result.download_id;
            }
            
            // Show the download manager
            if (typeof downloadManager !== 'undefined' && downloadManager) {
                downloadManager.showDownloadManager();
            }
            
            // Start monitoring this download
            this.monitorDownload(result.download_id, modelId, filename);
        }).catch(error => {
            console.error('Download error:', error);
            this.desktop.showNotification('Download failed: ' + error, 'error');
            
            // Reset button on error
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = 'Download';
                downloadBtn.dataset.status = 'available';
                downloadBtn.classList.remove('downloaded');
            }
        });
    }

    groupFilesBySimilarity(filenames) {
        if (filenames.length <= 1) {
            return [filenames];
        }
        
        const groups = [];
        const processed = new Set();
        
        for (const filename of filenames) {
            if (processed.has(filename)) continue;
            
            const currentGroup = [filename];
            processed.add(filename);
            
            // Find files that share a significant common prefix with this file
            const cleanName = filename.replace(/\.gguf$/i, '');
            
            for (const otherFilename of filenames) {
                if (processed.has(otherFilename)) continue;
                
                const otherCleanName = otherFilename.replace(/\.gguf$/i, '');
                const commonPrefix = this.findCommonPrefix(cleanName, otherCleanName);
                
                // Group files if they share a meaningful common prefix (at least 5 chars)
                // and the prefix ends with punctuation or the files are very similar
                if (commonPrefix.length >= 5) {
                    const similarity = commonPrefix.length / Math.max(cleanName.length, otherCleanName.length);
                    if (similarity > 0.6 || /[-_.]$/.test(commonPrefix)) {
                        currentGroup.push(otherFilename);
                        processed.add(otherFilename);
                    }
                }
            }
            
            groups.push(currentGroup);
        }
        
        return groups;
    }
    
    findCommonPrefix(str1, str2) {
        let commonPrefix = '';
        const minLength = Math.min(str1.length, str2.length);
        
        for (let i = 0; i < minLength; i++) {
            if (str1[i] === str2[i]) {
                commonPrefix += str1[i];
            } else {
                break;
            }
        }
        
        return commonPrefix;
    }
    
    styleFilenameWithinGroup(displayName, groupFilenames) {
        if (groupFilenames.length <= 1) {
            return displayName;
        }
        
        // Remove .gguf extension from all filenames in the group for comparison
        const cleanFilenames = groupFilenames.map(f => f.replace(/\.gguf$/i, ''));
        
        // Find the longest common prefix within this group
        let rawCommonPrefix = cleanFilenames[0];
        for (const filename of cleanFilenames.slice(1)) {
            rawCommonPrefix = this.findCommonPrefix(rawCommonPrefix, filename);
        }
        
        // Find the best split point by looking for punctuation boundaries
        let commonPrefix = rawCommonPrefix;
        
        // Look for the last meaningful punctuation (dash, underscore, dot) in the common prefix
        const punctuationMatches = [...rawCommonPrefix.matchAll(/[-_.]/g)];
        if (punctuationMatches.length > 0) {
            // Get the position after the last punctuation mark
            const lastPunctuationPos = punctuationMatches[punctuationMatches.length - 1].index + 1;
            
            // Only use this split if it leaves a meaningful prefix (at least 3 chars)
            if (lastPunctuationPos >= 3) {
                commonPrefix = rawCommonPrefix.substring(0, lastPunctuationPos);
            }
        }
        
        // Only apply styling if common prefix is meaningful (more than 2 characters)
        if (commonPrefix.length <= 2) {
            return displayName;
        }
        
        // Extract the unique part (everything after the common prefix)
        const uniquePart = displayName.substring(commonPrefix.length);
        
        // Style the parts
        let styledName = '';
        styledName += `<span class="filename-common">${commonPrefix}</span>`;
        styledName += `<span class="filename-unique">${uniquePart}</span>`;
        
        return styledName;
    }

    async updateFileDownloadStatus(model) {
        const window = this.desktop.windows.get(this.windowId);
        if (!window) return;
        
        const invoke = this.getInvoke();
        if (!invoke) return;
        
        // Check download status for each GGUF file
        const promises = Object.keys(model.gguf_files).map(async (filename) => {
            const fileItem = window.querySelector(`[data-filename="${filename}"][data-model-id="${model.id}"]`);
            const downloadBtn = fileItem?.querySelector('.quant-download-btn');
            
            if (downloadBtn) {
                // Don't update if currently downloading, paused, or in progress
                const currentStatus = downloadBtn.dataset.status;
                if (currentStatus === 'downloading' || currentStatus === 'paused') {
                    return; // Skip this file, let the monitor handle it
                }
                
                try {
                    // Check if file already exists
                    const fileExists = await invoke('check_file_exists', {
                        modelId: model.id,
                        filename: filename
                    });
                    
                    if (fileExists) {
                        downloadBtn.innerHTML = 'Downloaded';
                        downloadBtn.dataset.status = 'downloaded';
                        downloadBtn.disabled = true;
                        downloadBtn.classList.add('downloaded');
                    } else {
                        downloadBtn.innerHTML = 'Download';
                        downloadBtn.dataset.status = 'available';
                        downloadBtn.disabled = false;
                        downloadBtn.classList.remove('downloaded');
                    }
                } catch (error) {
                    console.error('Error checking file existence:', error);
                    // If check fails, assume available for download
                    downloadBtn.innerHTML = 'Download';
                    downloadBtn.dataset.status = 'available';
                    downloadBtn.disabled = false;
                    downloadBtn.classList.remove('downloaded');
                }
            }
        });
        
        // Wait for all checks to complete
        await Promise.all(promises);
    }
    
    // Method to refresh download status for all visible models
    async refreshAllDownloadStatus() {
        const window = this.desktop.windows.get(this.windowId);
        if (!window) return;
        
        const detailsContent = window.querySelector('#model-details-content');
        if (detailsContent && detailsContent.modelData) {
            await this.updateFileDownloadStatus(detailsContent.modelData);
        }
    }
    
    // Monitor a specific download and update button status
    async monitorDownload(downloadId, modelId, filename) {
        const invoke = this.getInvoke();
        if (!invoke) return;
        
        const checkDownloadStatus = async () => {
            try {
                const status = await invoke('get_download_status', { downloadId });
                
                const window = this.desktop.windows.get(this.windowId);
                if (!window) return;
                
                const fileItem = window.querySelector(`[data-filename="${filename}"][data-model-id="${modelId}"]`);
                const downloadBtn = fileItem?.querySelector('.quant-download-btn');
                
                if (!downloadBtn) return;
                
                switch (status.status) {
                    case 'Downloading':
                    case 'Starting':
                        downloadBtn.innerHTML = `Downloading... ${status.progress}%`;
                        downloadBtn.dataset.status = 'downloading';
                        downloadBtn.disabled = true;
                        // Continue monitoring
                        setTimeout(checkDownloadStatus, 1000);
                        break;
                        
                    case 'Completed':
                        downloadBtn.innerHTML = 'Downloaded';
                        downloadBtn.dataset.status = 'downloaded';
                        downloadBtn.disabled = true;
                        downloadBtn.classList.add('downloaded');
                        break;
                        
                    case 'Failed':
                    case 'Cancelled':
                        downloadBtn.innerHTML = 'Download';
                        downloadBtn.dataset.status = 'available';
                        downloadBtn.disabled = false;
                        downloadBtn.classList.remove('downloaded');
                        if (status.status === 'Failed') {
                            this.desktop.showNotification(`Download failed: ${filename}`, 'error');
                        }
                        break;
                        
                    case 'Paused':
                        downloadBtn.innerHTML = 'Paused';
                        downloadBtn.dataset.status = 'paused';
                        downloadBtn.disabled = true;
                        // Continue monitoring
                        setTimeout(checkDownloadStatus, 2000);
                        break;
                        
                    default:
                        // Continue monitoring for unknown states
                        setTimeout(checkDownloadStatus, 1000);
                        break;
                }
            } catch (error) {
                console.error('Error checking download status:', error);
                // Stop monitoring on error and reset button
                const window = this.desktop.windows.get(this.windowId);
                if (window) {
                    const fileItem = window.querySelector(`[data-filename="${filename}"][data-model-id="${modelId}"]`);
                    const downloadBtn = fileItem?.querySelector('.quant-download-btn');
                    if (downloadBtn) {
                        downloadBtn.innerHTML = 'Download';
                        downloadBtn.dataset.status = 'available';
                        downloadBtn.disabled = false;
                        downloadBtn.classList.remove('downloaded');
                    }
                }
            }
        };
        
        // Start monitoring
        setTimeout(checkDownloadStatus, 1000);
    }
    
    quickSearch(query) {
        const window = this.desktop.windows.get(this.windowId);
        if (!window) return;
        
        const searchInput = window.querySelector('#hf-search-input');
        if (searchInput) {
            searchInput.value = query;
            this.performHuggingFaceSearch();
        }
    }
}