// Theme definitions - Single source of truth for all theme color schemes
// Organized from neutral to colorful themes
const themeDefinitions = {
    // NEUTRAL THEMES (top section)
    'dark-gray': {
        name: 'Dark Gray',
        primary: '#424242', light: '#6d6d6d', dark: '#212121', accent: '#757575',
        bg: '#0d0d0d', surface: '#1a1a1a', surfaceLight: '#2d2d2d',
        text: '#f5f5f5', textMuted: '#bdbdbd', border: '#616161', hover: '#383838',
        gradientStart: '#121212', gradientMiddle: '#1e1e1e', gradientEnd: '#121212',
        glow: 'rgba(97, 97, 97, 0.5)', glowLight: 'rgba(97, 97, 97, 0.3)', glowStrong: 'rgba(97, 97, 97, 0.7)',
        bgLight: 'rgba(97, 97, 97, 0.2)', bgMedium: 'rgba(97, 97, 97, 0.3)', bgStrong: 'rgba(97, 97, 97, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    gray: {
        name: 'Gray',
        primary: '#78909c', light: '#b0bec5', dark: '#546e7a', accent: '#90a4ae',
        bg: '#1a1c1d', surface: '#263238', surfaceLight: '#37474f',
        text: '#eceff1', textMuted: '#b0bec5', border: '#90a4ae', hover: '#607d8b',
        gradientStart: '#263238', gradientMiddle: '#37474f', gradientEnd: '#263238',
        glow: 'rgba(144, 164, 174, 0.5)', glowLight: 'rgba(144, 164, 174, 0.3)', glowStrong: 'rgba(144, 164, 174, 0.7)',
        bgLight: 'rgba(144, 164, 174, 0.2)', bgMedium: 'rgba(144, 164, 174, 0.3)', bgStrong: 'rgba(144, 164, 174, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    brown: {
        name: 'Brown',
        primary: '#8d6e63', light: '#a1887f', dark: '#5d4037', accent: '#bcaaa4',
        bg: '#1a1413', surface: '#2d251f', surfaceLight: '#3e342b',
        text: '#efebe9', textMuted: '#d7ccc8', border: '#a1887f', hover: '#6d4c41',
        gradientStart: '#1a1413', gradientMiddle: '#2d251f', gradientEnd: '#1a1413',
        glow: 'rgba(161, 136, 127, 0.5)', glowLight: 'rgba(141, 110, 99, 0.3)', glowStrong: 'rgba(188, 170, 164, 0.7)',
        bgLight: 'rgba(161, 136, 127, 0.2)', bgMedium: 'rgba(141, 110, 99, 0.3)', bgStrong: 'rgba(188, 170, 164, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    rosetta: {
        name: 'Rosetta',
        primary: '#d4a574', light: '#e6c2a6', dark: '#b8956b', accent: '#f4d5b7',
        bg: '#1a1512', surface: '#2d241d', surfaceLight: '#3e3228',
        text: '#f5f0e8', textMuted: '#e6c2a6', border: '#d4a574', hover: '#c19660',
        gradientStart: '#1a1512', gradientMiddle: '#2d241d', gradientEnd: '#1a1512',
        glow: 'rgba(212, 165, 116, 0.5)', glowLight: 'rgba(230, 194, 166, 0.3)', glowStrong: 'rgba(244, 213, 183, 0.7)',
        bgLight: 'rgba(212, 165, 116, 0.2)', bgMedium: 'rgba(230, 194, 166, 0.3)', bgStrong: 'rgba(244, 213, 183, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    
    // MODERATE COLOR THEMES (middle section)
    navy: {
        name: 'Navy',
        primary: '#1565c0', light: '#64b5f6', dark: '#0d47a1', accent: '#1976d2',
        bg: '#0a1929', surface: '#152a4a', surfaceLight: '#1e3a61',
        text: '#e3f2fd', textMuted: '#bbdefb', border: '#2196f3', hover: '#0d47a1',
        gradientStart: '#0a1929', gradientMiddle: '#152a4a', gradientEnd: '#0a1929',
        glow: 'rgba(33, 150, 243, 0.5)', glowLight: 'rgba(33, 150, 243, 0.3)', glowStrong: 'rgba(33, 150, 243, 0.7)',
        bgLight: 'rgba(33, 150, 243, 0.2)', bgMedium: 'rgba(33, 150, 243, 0.3)', bgStrong: 'rgba(33, 150, 243, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    green: {
        name: 'Green',
        primary: '#43a047', light: '#81c784', dark: '#2e7d32', accent: '#66bb6a',
        bg: '#0a290a', surface: '#154a15', surfaceLight: '#1e611e',
        text: '#e8f5e9', textMuted: '#a5d6a7', border: '#66bb6a', hover: '#388e3c',
        gradientStart: '#0a290a', gradientMiddle: '#154a15', gradientEnd: '#0a290a',
        glow: 'rgba(102, 187, 106, 0.5)', glowLight: 'rgba(102, 187, 106, 0.3)', glowStrong: 'rgba(102, 187, 106, 0.7)',
        bgLight: 'rgba(102, 187, 106, 0.2)', bgMedium: 'rgba(102, 187, 106, 0.3)', bgStrong: 'rgba(102, 187, 106, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    purple: {
        name: 'Purple',
        primary: '#772953', light: '#a0658a', dark: '#5d1f3f', accent: '#8b4d6b',
        bg: '#2d0a20', surface: '#4a1536', surfaceLight: '#5d1f3f',
        text: '#f5e6ed', textMuted: '#d4a5bb', border: '#a0658a', hover: '#6b2447',
        gradientStart: '#2d0a20', gradientMiddle: '#4a1536', gradientEnd: '#2d0a20',
        glow: 'rgba(160, 101, 138, 0.5)', glowLight: 'rgba(160, 101, 138, 0.3)', glowStrong: 'rgba(160, 101, 138, 0.7)',
        bgLight: 'rgba(160, 101, 138, 0.2)', bgMedium: 'rgba(160, 101, 138, 0.3)', bgStrong: 'rgba(160, 101, 138, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    ice: {
        name: 'Ice',
        primary: '#00e5ff', light: '#62efff', dark: '#0097a7', accent: '#b3e5fc',
        bg: '#0d1621', surface: '#1a2c3d', surfaceLight: '#264253',
        text: '#e0f7ff', textMuted: '#b3e5fc', border: '#4fc3f7', hover: '#0288d1',
        gradientStart: '#0d1621', gradientMiddle: '#1a2c3d', gradientEnd: '#0d1621',
        glow: 'rgba(0, 229, 255, 0.5)', glowLight: 'rgba(179, 229, 252, 0.3)', glowStrong: 'rgba(79, 195, 247, 0.7)',
        bgLight: 'rgba(0, 229, 255, 0.2)', bgMedium: 'rgba(179, 229, 252, 0.3)', bgStrong: 'rgba(79, 195, 247, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    
    // VIBRANT THEMES (bottom section)
    orange: {
        name: 'Orange',
        primary: '#fb8c00', light: '#ffa726', dark: '#ef6c00', accent: '#ff9800',
        bg: '#2c1a00', surface: '#4a2d15', surfaceLight: '#613e1e',
        text: '#fff3e0', textMuted: '#ffcc80', border: '#ffa726', hover: '#f57c00',
        gradientStart: '#5a2c00', gradientMiddle: '#874115', gradientEnd: '#5a2c00',
        glow: 'rgba(255, 167, 38, 0.5)', glowLight: 'rgba(255, 167, 38, 0.3)', glowStrong: 'rgba(255, 167, 38, 0.7)',
        bgLight: 'rgba(255, 167, 38, 0.2)', bgMedium: 'rgba(255, 167, 38, 0.3)', bgStrong: 'rgba(255, 167, 38, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    yellow: {
        name: 'Yellow',
        primary: '#fdd835', light: '#fff176', dark: '#fbc02d', accent: '#ffee58',
        bg: '#29270a', surface: '#4a4715', surfaceLight: '#615e1e',
        text: '#fffde7', textMuted: '#fff59d', border: '#ffd600', hover: '#fbc02d',
        gradientStart: '#5a570a', gradientMiddle: '#878315', gradientEnd: '#5a570a',
        glow: 'rgba(255, 214, 0, 0.5)', glowLight: 'rgba(255, 214, 0, 0.3)', glowStrong: 'rgba(255, 214, 0, 0.7)',
        bgLight: 'rgba(255, 214, 0, 0.2)', bgMedium: 'rgba(255, 214, 0, 0.3)', bgStrong: 'rgba(255, 214, 0, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    red: {
        name: 'Red',
        primary: '#d32f2f', light: '#f44336', dark: '#b71c1c', accent: '#ff5252',
        bg: '#1a0606', surface: '#2d1212', surfaceLight: '#3d1a1a',
        text: '#ffebee', textMuted: '#ffcdd2', border: '#f44336', hover: '#c62828',
        gradientStart: '#1a0606', gradientMiddle: '#2d1212', gradientEnd: '#1a0606',
        glow: 'rgba(244, 67, 54, 0.5)', glowLight: 'rgba(244, 67, 54, 0.3)', glowStrong: 'rgba(244, 67, 54, 0.7)',
        bgLight: 'rgba(244, 67, 54, 0.2)', bgMedium: 'rgba(244, 67, 54, 0.3)', bgStrong: 'rgba(244, 67, 54, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    valentine: {
        name: 'Valentine',
        primary: '#e91e63', light: '#f06292', dark: '#c2185b', accent: '#ff69b4',
        bg: '#1a0d14', surface: '#2d1a24', surfaceLight: '#3d2434',
        text: '#fce4ec', textMuted: '#f8bbd9', border: '#ff69b4', hover: '#d81b60',
        gradientStart: '#1a0d14', gradientMiddle: '#2d1a24', gradientEnd: '#1a0d14',
        glow: 'rgba(255, 105, 180, 0.5)', glowLight: 'rgba(233, 30, 99, 0.3)', glowStrong: 'rgba(255, 20, 147, 0.7)',
        bgLight: 'rgba(255, 105, 180, 0.2)', bgMedium: 'rgba(233, 30, 99, 0.3)', bgStrong: 'rgba(255, 20, 147, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    samba: {
        name: 'Samba',
        primary: '#ff6b35', light: '#ff8a65', dark: '#e64a19', accent: '#ffcc02',
        bg: '#1a0f05', surface: '#2d1e0a', surfaceLight: '#3e2c15',
        text: '#fff8e1', textMuted: '#ffcc80', border: '#ffb74d', hover: '#f57c00',
        gradientStart: '#1a0f05', gradientMiddle: '#2d1e0a', gradientEnd: '#1a0f05',
        glow: 'rgba(255, 107, 53, 0.5)', glowLight: 'rgba(255, 204, 2, 0.3)', glowStrong: 'rgba(255, 138, 101, 0.7)',
        bgLight: 'rgba(255, 107, 53, 0.2)', bgMedium: 'rgba(255, 204, 2, 0.3)', bgStrong: 'rgba(255, 138, 101, 0.4)',
        error: '#f44336', errorBg: 'rgba(244, 67, 54, 0.1)', warning: '#ff9800', warningBg: 'rgba(255, 152, 0, 0.1)', success: '#4caf50', successBg: 'rgba(76, 175, 80, 0.1)'
    },
    cyberpunk: {
        name: 'Cyberpunk',
        primary: '#00ffff', light: '#64ffff', dark: '#00acc1', accent: '#ff00ff',
        bg: '#0a0f1a', surface: '#1a1f2e', surfaceLight: '#2a2f3e',
        text: '#ffffff', textMuted: '#e0ffff', border: '#ff00ff', hover: '#ff6600', // Improved text contrast
        gradientStart: '#000511', gradientMiddle: '#1a0033', gradientEnd: '#000511',
        glow: 'rgba(0, 255, 255, 0.5)', glowLight: 'rgba(255, 0, 255, 0.3)', glowStrong: 'rgba(255, 102, 0, 0.7)',
        bgLight: 'rgba(0, 255, 255, 0.2)', bgMedium: 'rgba(255, 0, 255, 0.3)', bgStrong: 'rgba(255, 102, 0, 0.4)',
        error: '#ff0080', errorBg: 'rgba(255, 0, 128, 0.1)', warning: '#ffff00', warningBg: 'rgba(255, 255, 0, 0.1)', success: '#00ff80', successBg: 'rgba(0, 255, 128, 0.1)'
    },
};

// Function to generate theme options HTML
function generateThemeOptions(selectedTheme = 'navy') {
    let options = '';
    for (const [key, theme] of Object.entries(themeDefinitions)) {
        const selected = key === selectedTheme ? ' selected' : '';
        options += `<option value="${key}"${selected}>${theme.name}</option>`;
    }
    return options;
}

// Make it available globally
if (typeof window !== 'undefined') {
    window.themeDefinitions = themeDefinitions;
    window.generateThemeOptions = generateThemeOptions;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { themeDefinitions, generateThemeOptions };
}