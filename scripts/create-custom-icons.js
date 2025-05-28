#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Ensure icons directory exists
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('🎨 Creating simple and highly visible icons for Chrome extension...');

// Create simple, high-contrast icons that will definitely show up
function createIcon(size) {
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF4444;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0066FF;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="starGrad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFFF00;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FF8800;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle with high contrast -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="url(#bgGrad${size})" stroke="#000000" stroke-width="1"/>
  
  <!-- White inner circle for contrast -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 4}" fill="none" stroke="white" stroke-width="1" opacity="0.8" />
  
  <!-- Large central star -->
  <g transform="translate(${size/2}, ${size/2})">
    <path d="M0,${-size/3} L${size/10},${-size/10} L${size/3},0 L${size/10},${size/10} L0,${size/3} L${-size/10},${size/10} L${-size/3},0 L${-size/10},${-size/10} Z" 
          fill="url(#starGrad${size})" stroke="#000000" stroke-width="1"/>
  </g>
  
  <!-- Bold arrow pointing up -->
  <g transform="translate(${size/2}, ${size/2})">
    <path d="M0,${-size/5} L${size/8},${-size/12} L${size/16},${-size/12} L${size/16},${size/6} L${-size/16},${size/6} L${-size/16},${-size/12} L${-size/8},${-size/12} Z" 
          fill="white" stroke="#000000" stroke-width="0.5"/>
  </g>
  
  <!-- High contrast accent dots -->
  <circle cx="${size - size/8}" cy="${size/8}" r="${size/20}" fill="white" stroke="#000000" stroke-width="0.5"/>
  <circle cx="${size/8}" cy="${size - size/8}" r="${size/20}" fill="white" stroke="#000000" stroke-width="0.5"/>
</svg>`;

    return svg;
}

// Generate icons for different sizes
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
    const svg = createIcon(size);
    const filename = `icon${size}.svg`;
    const filepath = path.join(iconsDir, filename);
    
    fs.writeFileSync(filepath, svg);
    console.log(`✅ Created ${filename} (${size}x${size})`);
});

console.log('\n🎉 Simple high-contrast SVG icons created successfully!');

// Create README for icons
const readme = `# Chrome Extension Icons - High Contrast Version

## Design Features
- **High contrast gradient**: Red to Blue for maximum visibility
- **Bold yellow/orange star**: Central boost symbol
- **White arrow with black outline**: Clear upward pointing symbol
- **Simple design**: No complex filters that might not render
- **Black outlines**: Ensure visibility on any background

## Color Palette
- Background: #FF4444 → #0066FF (Red to Blue)
- Star: #FFFF00 → #FF8800 (Yellow to Orange)
- Accents: White with black outlines

## Sizes Generated
- 16x16px (toolbar)
- 32x32px (extension management)
- 48x48px (extension details)
- 128x128px (Chrome Web Store)

These icons are designed for maximum visibility and compatibility with Chrome extension system.
`;

fs.writeFileSync(path.join(iconsDir, 'README.md'), readme);
console.log('📚 Created README.md with icon documentation');

console.log('\n📝 These simplified icons should be highly visible in Chrome!');
console.log('If icons still don\'t show, try:');
console.log('1. Reload the extension in chrome://extensions/');
console.log('2. Clear Chrome cache');
console.log('3. Restart Chrome browser'); 