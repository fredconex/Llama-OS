/**
 * ModalDialog Usage Examples
 * 
 * This file demonstrates how to use the reusable ModalDialog class
 * in various scenarios throughout the application.
 */

// Example 1: Basic Confirmation Dialog (danger type)
async function deleteFileExample() {
    const confirmed = await ModalDialog.showConfirmation({
        title: 'Delete File',
        message: 'Are you sure you want to delete "example.txt"?\n\nThis action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
    });
    
    if (confirmed) {
        console.log('User confirmed deletion');
        // Perform deletion logic here
    } else {
        console.log('User cancelled deletion');
    }
}

// Example 2: Warning Dialog
async function restartApplicationExample() {
    const confirmed = await ModalDialog.showConfirmation({
        title: 'Restart Application',
        message: 'This will close all running processes and restart the application.\n\nAre you sure you want to continue?',
        confirmText: 'Restart',
        cancelText: 'Cancel',
        type: 'warning'
    });
    
    if (confirmed) {
        console.log('Restarting application...');
        // Restart logic here
    }
}

// Example 3: Info Dialog (single button)
async function showInfoExample() {
    await ModalDialog.showInfo({
        title: 'Operation Complete',
        message: 'The file has been successfully uploaded and processed.',
        okText: 'Got it'
    });
    
    console.log('Info dialog closed');
}

// Example 4: Custom Dialog with Multiple Actions
async function customActionsExample() {
    const result = await ModalDialog.showCustom({
        title: 'Save Changes',
        content: `
            <p>You have unsaved changes. What would you like to do?</p>
            <div style="margin-top: 16px;">
                <label style="display: block; margin-bottom: 8px;">
                    <input type="checkbox" id="auto-save" style="margin-right: 8px;">
                    Don't ask me again (auto-save)
                </label>
            </div>
        `,
        buttons: [
            {
                text: 'Cancel',
                className: 'btn-secondary',
                action: () => 'cancel'
            },
            {
                text: 'Discard',
                className: 'btn-danger',
                action: () => 'discard'
            },
            {
                text: 'Save',
                className: 'btn-primary',
                action: () => {
                    const autoSave = document.getElementById('auto-save').checked;
                    return { action: 'save', autoSave };
                }
            }
        ]
    });
    
    console.log('Custom dialog result:', result);
    
    switch (result?.action || result) {
        case 'save':
            console.log('Saving changes...', result.autoSave ? '(auto-save enabled)' : '');
            break;
        case 'discard':
            console.log('Discarding changes...');
            break;
        case 'cancel':
        default:
            console.log('Operation cancelled');
            break;
    }
}

// Example 5: Simple Yes/No Question
async function simpleQuestionExample() {
    const confirmed = await ModalDialog.showConfirmation({
        title: 'Enable Notifications',
        message: 'Would you like to enable desktop notifications for new messages?',
        confirmText: 'Yes',
        cancelText: 'No',
        type: 'info'
    });
    
    if (confirmed) {
        console.log('Notifications enabled');
        // Enable notifications logic
    } else {
        console.log('Notifications disabled');
    }
}

// Example 6: Non-closable Critical Dialog
async function criticalActionExample() {
    const confirmed = await ModalDialog.showConfirmation({
        title: 'Critical Action Required',
        message: 'The system requires immediate attention.\n\nThis dialog cannot be dismissed by clicking outside or pressing Escape.',
        confirmText: 'Take Action',
        cancelText: 'Ignore',
        type: 'danger',
        allowOverlayClose: false,  // Prevent closing by clicking outside
        allowEscapeClose: false    // Prevent closing with Escape key
    });
    
    if (confirmed) {
        console.log('Taking critical action...');
    } else {
        console.log('User chose to ignore the critical action');
    }
}

// Example 7: Info Dialog with Custom OK Text
async function successMessageExample() {
    await ModalDialog.showInfo({
        title: 'Upload Complete',
        message: 'Your model has been successfully uploaded and is ready to use.',
        okText: 'Start Using Model'
    });
    
    console.log('User acknowledged success message');
    // Navigate to model or perform next action
}

// Usage in real scenarios:
// 
// 1. In chat-app.js for deleting chats:
//    const confirmed = await ModalDialog.showConfirmation({
//        title: 'Delete Chat',
//        message: `Are you sure you want to delete "${chatName}"?\n\nThis action cannot be undone.`,
//        confirmText: 'Delete',
//        cancelText: 'Cancel',
//        type: 'danger'
//    });
//
// 2. In properties-manager.js for deleting files:
//    const confirmed = await ModalDialog.showConfirmation({
//        title: 'Delete File',
//        message: `Are you sure you want to delete "${filename}"?\n\nThis action cannot be undone.`,
//        confirmText: 'Delete',
//        cancelText: 'Cancel',
//        type: 'danger'
//    });
//
// 3. In any module for showing info:
//    await ModalDialog.showInfo({
//        title: 'Operation Complete',
//        message: 'The operation completed successfully.'
//    });
//
// Benefits of the reusable ModalDialog:
// ✅ Consistent styling across the application
// ✅ Darkened background with blur effect
// ✅ Proper z-index management
// ✅ Keyboard navigation (Tab, Enter, Escape)
// ✅ Accessibility features (focus management)
// ✅ Customizable button types and colors
// ✅ Support for line breaks in messages
// ✅ Promise-based API for easy async/await usage
// ✅ Custom content support for complex dialogs
// ✅ Configurable overlay and escape key behavior