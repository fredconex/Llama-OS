// Llama.cpp Releases Management Module
class LlamaCppReleasesManager {
    constructor(desktop) {
        this.desktop = desktop;
        
        // Initialize Tauri API access
        this.invoke = null;
        this.initTauriAPI();

        // UI state
        this.hideOtherPlatforms = true; // default ON: emphasize Windows assets
        this.lastReleases = null; // cache latest fetched releases for re-rendering
    }
    
    initTauriAPI() {
        try {
            if (window.__TAURI__ && window.__TAURI__.core) {
                this.invoke = window.__TAURI__.core.invoke;
                console.log('Tauri API initialized in LlamaCppReleasesManager');
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

    // Escape a string for safe inclusion inside single-quoted JS in HTML attributes
    // - Escape backslashes first, then single quotes
    // - Remove newlines to avoid breaking attributes
    escapeForOnclick(str) {
        if (str == null) return '';
        return String(str)
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'")
            .replace(/\r?\n/g, ' ');
    }

    // Normalize filesystem paths for reliable matching on Windows
    normalizePath(pathValue) {
        if (!pathValue || typeof pathValue !== 'string') return '';
        let normalized = pathValue.replace(/\\/g, '/');
        normalized = normalized.replace(/\/+$/g, '');
        return normalized.toLowerCase();
    }

    switchTopTab(tabButton, tabName) {
        const tabs = document.querySelectorAll('.llamacpp-top-tabs .top-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        if (tabButton) tabButton.classList.add('active');

        const releasesEl = document.getElementById('llamacpp-manager-content');
        const installedEl = document.getElementById('llamacpp-installed-content');
        if (!releasesEl || !installedEl) return;
        if (tabName === 'releases') {
            releasesEl.classList.remove('hidden');
            installedEl.classList.add('hidden');
        } else {
            releasesEl.classList.add('hidden');
            installedEl.classList.remove('hidden');
            this.loadInstalledVersions();
        }
    }

    async loadInstalledVersions() {
        const container = document.getElementById('llamacpp-installed-content');
        if (!container) return;
        try {
            container.innerHTML = '<div class="loading-installed">Loading installed versions...</div>';
            const invoke = this.getInvoke();
            if (!invoke) throw new Error('Tauri API not available');
            const [versions, cfg] = await Promise.all([
                invoke('list_llamacpp_versions'),
                invoke('get_config')
            ]);
            this.renderInstalledVersions(versions, cfg);
        } catch (e) {
            console.error('Failed to load installed versions:', e);
            container.innerHTML = `<div class="error-installed">${e?.message || 'Failed to load installed versions'}</div>`;
        }
    }

    renderInstalledVersions(versions, cfg) {
        const container = document.getElementById('llamacpp-installed-content');
        if (!container) return;
        if (!Array.isArray(versions) || versions.length === 0) {
            container.innerHTML = '<div class="no-installed">No versions installed yet.</div>';
            return;
        }
        // Sort versions by numeric version descending (e.g., b6356 > b6355)
        const extractVersionNumber = (v) => {
            const name = v?.name || (v?.path ? v.path.split(/[\\/]/).pop() : '');
            const match = String(name).match(/(\d+)/);
            return match ? parseInt(match[1], 10) : -Infinity;
        };
        const sortedVersions = [...versions].sort((a, b) => extractVersionNumber(b) - extractVersionNumber(a));

        const activePath = cfg?.active_executable_folder || null;
        const activeNorm = this.normalizePath(activePath);
        const rows = sortedVersions.map(v => {
            const isActive = !!activeNorm && this.normalizePath(v.path) === activeNorm;
            const status = isActive ? '<span class="badge active">Active</span>' : (v.has_server ? '<span class="badge ok">Ready</span>' : '<span class="badge warn">Missing server</span>');
            const name = v.name || (v.path ? v.path.split(/[\\/]/).pop() : '');
            const escapedPath = this.escapeForOnclick(v.path || '');
            
            // Determine if the activate button should be disabled
            const isReady = v.has_server;
            const activateButtonDisabled = !isReady;
            const activateButtonClass = `installed-activate${activateButtonDisabled ? ' disabled' : ''}`;
            const activateButtonTitle = activateButtonDisabled ? 'Cannot activate: server executable is missing' : 'Set as active version';

            return `
                <div class="installed-item">
                    <div class="installed-info">
                        <div class="installed-name">${name}</div>
                        <div class="installed-path">${v.path}</div>
                    </div>
                    <div class="installed-status">${status}</div>
                    <div class="installed-actions">
                        ${isActive ? '' : `
                            <button
                                class="${activateButtonClass}"
                                onclick="if(!${activateButtonDisabled}) { llamacppReleasesManager.setActiveVersion('${escapedPath}'); }"
                                ${activateButtonDisabled ? 'disabled' : ''}
                                title="${activateButtonTitle}">
                                <span class="material-icons">check_circle</span> Set Active
                            </button>
                        `}
                        <button class="installed-delete" onclick="llamacppReleasesManager.deleteVersion('${escapedPath}')"><span class="material-icons">delete</span></button>
                    </div>
                </div>
            `;
        }).join('');
        container.innerHTML = `
            <div class="installed-list">${rows}</div>
        `;
    }

    async setActiveVersion(path) {
        try {
            const invoke = this.getInvoke();
            if (!invoke) throw new Error('Tauri API not available');
            await invoke('set_active_llamacpp_version', { path });
            this.loadInstalledVersions();
        } catch (e) {
            alert(`Failed to set active version: ${e.message || e}`);
        }
    }

    async deleteVersion(path) {
        let confirmed = false;
        try {
            confirmed = await ModalDialog.showConfirmation({
                title: 'Delete Build',
                message: 'Are you sure you want to delete this installed version? This action cannot be undone.',
                confirmText: 'Delete',
                cancelText: 'Cancel',
                type: 'danger'
            });
        } catch (e) {
            // Fallback if modal not available
            confirmed = confirm('Delete this installed version folder?');
        }
        if (!confirmed) return;
        try {
            const invoke = this.getInvoke();
            if (!invoke) throw new Error('Tauri API not available');
            await invoke('delete_llamacpp_version', { path });
            this.loadInstalledVersions();
        } catch (e) {
            alert(`Failed to delete version: ${e.message || e}`);
        }
    }
    // Llama.cpp release methods
    async getLlamaCppReleases() {
        try {
            const invoke = this.getInvoke();
            if (!invoke) {
                // Tauri API not ready yet, try to initialize it
                this.initTauriAPI();
                // Wait a bit and try again
                await new Promise(resolve => setTimeout(resolve, 100));
                const retryInvoke = this.getInvoke();
                if (!retryInvoke) {
                    throw new Error('Tauri API not available. Please try again in a moment.');
                }
                const releases = await retryInvoke('get_llamacpp_releases');
                return releases;
            }
            const releases = await invoke('get_llamacpp_releases');
            return releases;
        } catch (error) {
            console.error('Error fetching llama.cpp releases:', error);
            // Provide a more user-friendly error message
            if (error.message && error.message.includes('Tauri API not available')) {
                throw new Error('Application not ready yet. Please try again in a moment.');
            }
            throw error;
        }
    }

    async downloadLlamaCppAsset(asset) {
        try {
            const invoke = this.getInvoke();
            if (invoke) {
                const result = await invoke('download_llamacpp_asset', { asset });
                console.log('Llama.cpp asset download started:', result);
                return result;
            }
        } catch (error) {
            console.error('Error downloading llama.cpp asset:', error);
            throw error;
        }
    }

    async handleAssetDownload(assetId, name, downloadUrl, size, tagName) {
        const asset = {
            id: assetId, // Pass the assetId
            name: name,
            download_url: downloadUrl,
            size: size,
            content_type: 'application/octet-stream' // Default content type since GitHub API sometimes returns unexpected values
        };
        
        // Choose version folder using tag name (strip leading 'v'), fallback to asset name sans .zip
        let versionFolder = (tagName || '').toString().trim().replace(/^v/, '');
        if (!versionFolder) {
            versionFolder = (name || '').replace(/\.zip$/i, '').replace(/[^A-Za-z0-9._-]/g, '_');
        }

        try {
            const invoke = this.getInvoke();
            if (!invoke) throw new Error('Tauri API not available');
            await invoke('download_llamacpp_asset_to_version', { asset, versionFolder });
            console.log(`Started download of ${name} to ${versionFolder}`);
            // Auto-switch to Installed tab only when the downloaded version becomes Ready
            this.autoSwitchWhenVersionReady(versionFolder);
        } catch (error) {
            console.error(`Failed to start download of ${name}:`, error);
            alert(`Failed to start download: ${error.message}`);
        }
    }

    // Start listening/polling, and switch to Installed when the specific version is detected as Ready
    async autoSwitchWhenVersionReady(versionFolder, timeoutMs = 180000) {
        const start = Date.now();
        const invoke = this.getInvoke();
        if (!invoke) return;

        const matchesTarget = (v) => {
            const folderName = (v?.name || (v?.path ? v.path.split(/[\\/]/).pop() : '') || '').trim();
            return folderName.toLowerCase() === String(versionFolder).trim().toLowerCase();
        };

        const check = async () => {
            try {
                const [versions] = await Promise.all([
                    invoke('list_llamacpp_versions')
                ]);
                const found = Array.isArray(versions) ? versions.find(v => matchesTarget(v) && v.has_server) : null;
                if (found) {
                    const installedTab = document.querySelector('.llamacpp-top-tabs .top-tab[data-top-tab="installed"]');
                    if (installedTab) this.switchTopTab(installedTab, 'installed');
                    
                    // Refresh the releases to show the "Installed" tag
                    this.loadLlamaCppReleases();
                    
                    return true;
                }
            } catch (e) {
                // ignore transient errors
            }
            return false;
        };

        // Quick checks after a download-complete event; also poll until timeout
        let intervalId = null;
        const stop = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };

        // Attach one-time listener to react promptly when download completes
        if (window.__TAURI__ && window.__TAURI__.event) {
            const unlistenPromise = window.__TAURI__.event.listen('download-complete', async () => {
                if (await check()) {
                    try { const unlisten = await unlistenPromise; if (typeof unlisten === 'function') unlisten(); } catch (_) {}
                    stop();
                }
            });
        }

        // Begin polling until timeout
        intervalId = setInterval(async () => {
            if (Date.now() - start > timeoutMs) {
                stop();
                return;
            }
            if (await check()) stop();
        }, 2000);
    }

    // Toggle release expansion when clicking on header
    async toggleReleaseExpansion(headerElement) {
        const releaseItem = headerElement.closest('.release-item');
        if (releaseItem) {
            const isExpanded = releaseItem.classList.contains('expanded');
            releaseItem.classList.toggle('expanded');
            
            // If expanding and release has no body, try to load commit info
            if (!isExpanded && releaseItem.classList.contains('expanded')) {
                const releaseTag = releaseItem.querySelector('.release-tag').textContent;
                const releaseBody = releaseItem.querySelector('.release-body');
                
                // Check if we need to load commit info
                if (releaseBody && (releaseBody.textContent.trim() === 'No release notes available for this release.' || releaseBody.textContent.trim() === '')) {
                    await this.loadCommitInfoForRelease(releaseItem, releaseTag);
                }
            }
        }
    }

    // Load commit info for a specific release
    async loadCommitInfoForRelease(releaseItem, tagName) {
        try {
            const releaseBody = releaseItem.querySelector('.release-body');
            if (!releaseBody) return;
            
            // Show loading state
            releaseBody.innerHTML = '<div class="loading-commit-info">Loading commit information...</div>';
            
            const invoke = this.getInvoke();
            if (!invoke) {
                throw new Error('Tauri API not available');
            }
            
            // Fetch commit info using the tag name
            const commitInfo = await invoke('get_llamacpp_commit_info', { tagName: tagName });
            
            // Update the release body with commit info
            releaseBody.innerHTML = this.formatCommitInfo(commitInfo);
            
        } catch (error) {
            console.error('Error loading commit info for release:', error);
            const releaseBody = releaseItem.querySelector('.release-body');
            if (releaseBody) {
                releaseBody.innerHTML = '<div class="error-commit-info">Failed to load commit information. Please try again later.</div>';
            }
        }
    }

    // Switch between release tabs
    switchReleaseTab(tabButton, tabName) {
        const releaseItem = tabButton.closest('.release-item');
        if (!releaseItem) return;

        // Remove active class from all tabs and panes in this release
        const allTabs = releaseItem.querySelectorAll('.release-tab');
        const allPanes = releaseItem.querySelectorAll('.release-tab-pane');
        
        allTabs.forEach(tab => tab.classList.remove('active'));
        allPanes.forEach(pane => pane.classList.remove('active'));

        // Add active class to clicked tab and corresponding pane
        tabButton.classList.add('active');
        const targetPane = releaseItem.querySelector(`[data-pane="${tabName}"]`);
        if (targetPane) {
            targetPane.classList.add('active');
        }
    }

    // Show llama.cpp release manager
    showLlamaCppManager() {
        const windowId = 'llamacpp-manager';
        
        // Check if window already exists
        if (this.desktop.windows.has(windowId)) {
            const existingWindow = this.desktop.windows.get(windowId);
            if (existingWindow.style.display === 'none' || existingWindow.classList.contains('hidden')) {
                existingWindow.style.display = 'block';
                existingWindow.classList.remove('hidden');
                existingWindow.style.zIndex = ++this.desktop.windowZIndex;
            }
            return;
        }

        const content = `
            <div class="llamacpp-manager-container">
                <div class="llamacpp-manager-header">
                    <div class="llamacpp-manager-info">
                        <p>Download and manage llama.cpp releases from GitHub</p>
                    </div>
                    <div class="llamacpp-manager-controls">
                        <button class="llamacpp-refresh" onclick="llamacppReleasesManager.refreshLlamaCppReleases()" title="Refresh Releases">
                            <span class="material-icons">refresh</span> Refresh Releases
                        </button>
                        <button class="llamacpp-refresh platform-toggle" id="llamacpp-platform-toggle-ctrl" style="display: none;" onclick="llamacppReleasesManager.togglePlatformFilter()" title="Toggle platform visibility">
                            <span class="material-icons">layers</span> Windows only
                        </button>
                    </div>
                </div>
                <div class="llamacpp-top-tabs">
                    <button class="top-tab active" data-top-tab="releases" onclick="llamacppReleasesManager.switchTopTab(this, 'releases')">
                        <span class="material-icons">new_releases</span> Releases
                    </button>
                    <button class="top-tab" data-top-tab="installed" onclick="llamacppReleasesManager.switchTopTab(this, 'installed')">
                        <span class="material-icons">inventory_2</span> Installed Versions
                    </button>
                </div>
                <div class="llamacpp-manager-content" id="llamacpp-manager-content">
                    <div class="loading-releases">Loading releases...</div>
                </div>
                <div class="llamacpp-installed-content hidden" id="llamacpp-installed-content">
                    <div class="loading-installed">Loading installed versions...</div>
                </div>
            </div>
        `;
        
        // Create window using desktop's createWindow method
        const windowElement = this.desktop.createWindow(windowId, 'Llama.cpp Release Manager', 'llamacpp-manager-window', content);
        
        // Add taskbar item
        this.desktop.addTaskbarItem('Llama.cpp Manager', windowId, '<span class="material-icons">build</span>');
        
        // Load releases after window is created
        this.loadLlamaCppReleases();
        this.loadInstalledVersions();
    }

    async loadLlamaCppReleases() {
        const content = document.getElementById('llamacpp-manager-content');
        if (!content) return;

        try {
            content.innerHTML = '<div class="loading-releases">Loading releases...</div>';
            
            // Fetch both releases and installed versions in parallel
            const [releases, installedVersions] = await Promise.all([
                this.getLlamaCppReleases(),
                this.getInvoke()('list_llamacpp_versions')
            ]);

            this.lastReleases = releases;
            this.renderLlamaCppReleases(releases, installedVersions);
        } catch (error) {
            const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
            content.innerHTML = `<div class="error-releases">Failed to load releases: ${errorMessage}</div>`;
            console.error('Failed to load llama.cpp releases:', error);
        }
    }

    async refreshLlamaCppReleases() {
        await this.loadLlamaCppReleases();
    }

    renderLlamaCppReleases(releases, installedVersions = []) {
        const content = document.getElementById('llamacpp-manager-content');
        if (!content) return;

        if (releases.length === 0) {
            content.innerHTML = '<div class="no-releases">No releases found</div>';
            return;
        }

        const installedTags = new Set(installedVersions.map(v => v.name.toLowerCase()));

        const isWindowsAsset = (name) => {
            const n = String(name);
            const isWin = /(win|windows|win64|win32|x64|amd64)/i.test(n);
            const isOther = /(mac|darwin|osx|linux|ubuntu|debian|arch|fedora|arm64|aarch64|raspi|rpi)/i.test(n);
            return isWin && !isOther;
        };
        const isMacAsset = (name) => /mac|darwin|osx|apple|macos/i.test(name);
        const isLinuxAsset = (name) => /linux|ubuntu|debian|arch|fedora/i.test(name);
        const shouldShowAsset = (name) => {
            if (!this.hideOtherPlatforms) return true;
            // Default to Windows filter for this app
            return isWindowsAsset(name);
        };

        const releasesHTML = releases.map(release => {
            const releaseDate = new Date(release.published_at).toLocaleDateString();
            const relativeTime = this.formatRelativeTime(release.published_at);
            const isInstalled = installedTags.has(release.tag_name.toLowerCase());
            const installedBadge = isInstalled ? '<span class="badge installed">Installed</span>' : '';

            // Preserve expansion state by not altering release-item class outside
            // Sort assets: preferred platform (Windows) first when filter is on; keep stable otherwise
            const assetsSorted = [...release.assets].sort((a, b) => {
                const aWin = isWindowsAsset(a.name || '');
                const bWin = isWindowsAsset(b.name || '');
                if (this.hideOtherPlatforms && aWin !== bWin) return aWin ? -1 : 1;
                return String(a.name || '').localeCompare(String(b.name || ''));
            });

            const assetsHTML = assetsSorted
                .map(asset => {
                    const name = asset.name || '';
                    const warnCuda = /cudart/i.test(name);
                    const warningHTML = warnCuda ? '<span class="asset-note" style="margin-left: 8px; color: rgba(255,255,255,0.6);">Required for CUDA</span>' : '';
                    const isWin = isWindowsAsset(name);
                    const grayClass = this.hideOtherPlatforms && !isWin ? ' dim-asset' : '';
                    return `
                        <div class="release-asset${grayClass}">
                            <div class="asset-info">
                                <span class="asset-name">${name}</span>${warningHTML}
                            </div>
                            <button class="asset-download" onclick="llamacppReleasesManager.handleAssetDownload(${asset.id}, '${name}', '${asset.download_url}', ${asset.size}, '${release.tag_name}')" title="Download ${name} (${this.formatFileSize(asset.size)})">
                                <span class="material-icons">download</span> Download (${this.formatFileSize(asset.size)})
                            </button>
                        </div>
                    `;
                })
                .join('');

            return `
                <div class="release-item">
                    <div class="release-header" onclick="llamacppReleasesManager.toggleReleaseExpansion(this)" title="Click to expand/collapse">
                        <div class="release-info">
                            <h5 class="release-name">${release.name || release.tag_name}</h5>
                            <span class="release-tag">${release.tag_name}</span>
                            <span class="release-date">${releaseDate}</span>
                           <span class="release-time">${relativeTime}</span>
                           ${installedBadge}
                       </div>
                       <div class="release-actions">
                           <button class="github-view-btn" onclick="event.stopPropagation(); desktop.openUrl('${release.html_url}')" title="View on GitHub">
                               <span class="material-icons">open_in_new</span>
                            </button>
                            <span class="release-arrow">
                                <span class="material-icons">expand_more</span>
                            </span>
                        </div>
                    </div>
                    <div class="release-details">
                        <div class="release-tabs">
                            <button class="release-tab active" onclick="llamacppReleasesManager.switchReleaseTab(this, 'notes')" data-tab="notes">
                                <span class="material-icons">description</span> Release Notes
                            </button>
                            <button class="release-tab" onclick="llamacppReleasesManager.switchReleaseTab(this, 'downloads')" data-tab="downloads">
                                <span class="material-icons">download</span> Downloads (${release.assets.length})
                            </button>
                        </div>
                        <div class="release-tab-content">
                            <div class="release-tab-pane active" data-pane="notes">
                                <div class="release-body">${release.body || 'No release notes available for this release.'}</div>
                            </div>
                            <div class="release-tab-pane" data-pane="downloads">
                                ${assetsHTML}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Capture current expanded items, active tab, and scroll to restore after re-render
        const expandedTags = Array.from(document.querySelectorAll('#llamacpp-manager-content .release-item.expanded .release-tag')).map(el => el.textContent);
        const activeTabsByTag = {};
        document.querySelectorAll('#llamacpp-manager-content .release-item').forEach(item => {
            const tagEl = item.querySelector('.release-tag');
            const activeTab = item.querySelector('.release-tab.active');
            if (tagEl && activeTab) activeTabsByTag[tagEl.textContent] = activeTab.getAttribute('data-tab');
        });
        const scrollY = content.scrollTop;

        content.innerHTML = `
            <div class="releases-header">
                <p>Found ${releases.length} llama.cpp releases</p>
                <button class="platform-badge" id="llamacpp-platform-badge" onclick="llamacppReleasesManager.togglePlatformFilter()" title="Toggle platform visibility">
                    ${this.hideOtherPlatforms ? 'Windows only' : 'All platforms'}
                </button>
            </div>
            ${releasesHTML}
        `;

        // Restore expanded state and active tab; also restore scroll position
        if (expandedTags && expandedTags.length) {
            const items = document.querySelectorAll('#llamacpp-manager-content .release-item');
            items.forEach(item => {
                const tagEl = item.querySelector('.release-tag');
                if (tagEl && expandedTags.includes(tagEl.textContent)) {
                    item.classList.add('expanded');
                    const desiredTab = activeTabsByTag[tagEl.textContent];
                    if (desiredTab) {
                        const btn = item.querySelector(`.release-tab[data-tab="${desiredTab}"]`);
                        if (btn) this.switchReleaseTab(btn, desiredTab);
                    }
                }
            });
        }
        content.scrollTop = scrollY;
    }

    togglePlatformFilter() {
        this.hideOtherPlatforms = !this.hideOtherPlatforms;
        const btn = document.getElementById('llamacpp-platform-toggle-ctrl');
        if (btn) {
            btn.innerHTML = `<span class="material-icons">layers</span> ${this.hideOtherPlatforms ? 'Windows only' : 'All platforms'}`;
        }
        const badge = document.getElementById('llamacpp-platform-badge');
        if (badge) {
            badge.textContent = this.hideOtherPlatforms ? 'Windows only' : 'All platforms';
        }
        if (this.lastReleases) {
            // Re-render with cached releases and newly fetched installed versions
            this.getInvoke()('list_llamacpp_versions').then(installed => {
                this.renderLlamaCppReleases(this.lastReleases, installed);
            });
        }
    }

    // Utility Methods
    formatFileSize(bytes) {
        if (!bytes) return 'Unknown size';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    formatRelativeTime(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) {
            return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''} ago`;
        }
        
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) {
            return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
        }
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
        }
        
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 30) {
            return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
        }
        
        const diffInMonths = Math.floor(diffInDays / 30);
        if (diffInMonths < 12) {
            return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
        }
        
        const diffInYears = Math.floor(diffInMonths / 12);
        return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
    }
    
    formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
    
    formatCommitInfo(commitInfo) {
        if (!commitInfo) return null;
        
        return commitInfo.message;
    }
}
