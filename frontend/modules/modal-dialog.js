/**
 * Reusable Modal Dialog Utility
 * Creates consistent modal dialogs with darkened background and blur effects
 */
class ModalDialog {
    /**
     * Show a confirmation dialog
     * @param {Object} options - Dialog configuration
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Dialog message (supports \n for line breaks)
     * @param {string} options.confirmText - Confirm button text (default: 'Confirm')
     * @param {string} options.cancelText - Cancel button text (default: 'Cancel')
     * @param {string} options.type - Dialog type: 'danger', 'warning', 'info' (default: 'info')
     * @param {boolean} options.allowOverlayClose - Allow closing by clicking overlay (default: true)
     * @param {boolean} options.allowEscapeClose - Allow closing with Escape key (default: true)
     * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
     */
    static showConfirmation(options = {}) {
        const {
            title = 'Confirm',
            message = 'Are you sure?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            type = 'info',
            allowOverlayClose = true,
            allowEscapeClose = true
        } = options;

        return new Promise((resolve) => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'modal-dialog-overlay';
            
            // Create modal dialog
            const modal = document.createElement('div');
            modal.className = `modal-dialog-content modal-dialog-${type}`;
            
            modal.innerHTML = `
                <div class="modal-dialog-header">
                    <h3>${title}</h3>
                </div>
                <div class="modal-dialog-body">
                    <p style="white-space: pre-line; margin: 0;">${message}</p>
                </div>
                <div class="modal-dialog-footer">
                    <button class="btn btn-secondary modal-dialog-cancel">${cancelText}</button>
                    <button class="btn btn-${type === 'danger' ? 'danger' : 'primary'} modal-dialog-confirm">${confirmText}</button>
                </div>
            `;
            
            // Add event listeners
            const cancelBtn = modal.querySelector('.modal-dialog-cancel');
            const confirmBtn = modal.querySelector('.modal-dialog-confirm');
            
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
            if (allowOverlayClose) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        cleanup();
                        resolve(false);
                    }
                });
            }
            
            // Close on Escape key
            if (allowEscapeClose) {
                const handleEscape = (e) => {
                    if (e.key === 'Escape') {
                        cleanup();
                        resolve(false);
                        document.removeEventListener('keydown', handleEscape);
                    }
                };
                document.addEventListener('keydown', handleEscape);
            }
            
            // Add modal to overlay and overlay to document
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            // Focus the confirm button for better accessibility
            setTimeout(() => confirmBtn.focus(), 100);
        });
    }

    /**
     * Show an information dialog
     * @param {Object} options - Dialog configuration
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Dialog message
     * @param {string} options.okText - OK button text (default: 'OK')
     * @returns {Promise<void>} - Resolves when dialog is closed
     */
    static showInfo(options = {}) {
        const {
            title = 'Information',
            message = '',
            okText = 'OK'
        } = options;

        return new Promise((resolve) => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'modal-dialog-overlay';
            
            // Create modal dialog
            const modal = document.createElement('div');
            modal.className = 'modal-dialog-content modal-dialog-info';
            
            modal.innerHTML = `
                <div class="modal-dialog-header">
                    <h3>${title}</h3>
                </div>
                <div class="modal-dialog-body">
                    <p style="white-space: pre-line; margin: 0;">${message}</p>
                </div>
                <div class="modal-dialog-footer">
                    <button class="btn btn-primary modal-dialog-ok">${okText}</button>
                </div>
            `;
            
            // Add event listeners
            const okBtn = modal.querySelector('.modal-dialog-ok');
            
            const cleanup = () => {
                overlay.remove();
                resolve();
            };
            
            okBtn.addEventListener('click', cleanup);
            
            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                }
            });
            
            // Close on Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
            
            // Add modal to overlay and overlay to document
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            // Focus the OK button for better accessibility
            setTimeout(() => okBtn.focus(), 100);
        });
    }

    /**
     * Show a custom dialog with custom content
     * @param {Object} options - Dialog configuration
     * @param {string} options.title - Dialog title
     * @param {string} options.content - Custom HTML content for dialog body
     * @param {Array} options.buttons - Array of button objects {text, className, action}
     * @param {boolean} options.allowOverlayClose - Allow closing by clicking overlay (default: true)
     * @param {boolean} options.allowEscapeClose - Allow closing with Escape key (default: true)
     * @returns {Promise} - Resolves based on button actions
     */
    static showCustom(options = {}) {
        const {
            title = 'Dialog',
            content = '',
            buttons = [],
            allowOverlayClose = true,
            allowEscapeClose = true
        } = options;

        return new Promise((resolve) => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'modal-dialog-overlay';
            
            // Create modal dialog
            const modal = document.createElement('div');
            modal.className = 'modal-dialog-content modal-dialog-custom';
            
            // Create buttons HTML
            const buttonsHtml = buttons.map((btn, index) => 
                `<button class="btn ${btn.className || 'btn-secondary'}" data-button-index="${index}">${btn.text}</button>`
            ).join('');
            
            modal.innerHTML = `
                <div class="modal-dialog-header">
                    <h3>${title}</h3>
                </div>
                <div class="modal-dialog-body">
                    ${content}
                </div>
                <div class="modal-dialog-footer">
                    ${buttonsHtml}
                </div>
            `;
            
            // Add event listeners for buttons
            buttons.forEach((btn, index) => {
                const buttonElement = modal.querySelector(`[data-button-index="${index}"]`);
                buttonElement.addEventListener('click', () => {
                    overlay.remove();
                    if (btn.action) {
                        resolve(btn.action());
                    } else {
                        resolve(index);
                    }
                });
            });
            
            // Close on overlay click
            if (allowOverlayClose) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        overlay.remove();
                        resolve(null);
                    }
                });
            }
            
            // Close on Escape key
            if (allowEscapeClose) {
                const handleEscape = (e) => {
                    if (e.key === 'Escape') {
                        overlay.remove();
                        resolve(null);
                        document.removeEventListener('keydown', handleEscape);
                    }
                };
                document.addEventListener('keydown', handleEscape);
            }
            
            // Add modal to overlay and overlay to document
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        });
    }
}

// Make it available globally
window.ModalDialog = ModalDialog;