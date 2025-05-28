#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Ensure icons directory exists
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('🎨 Creating MASSIVE full-space icons for Chrome extension...');

// Create icons where elements fill almost the entire space
function createIcon(size) {
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#764ba2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f093fb;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="starGrad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffecd2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#fcb69f;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="arrowGrad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4facfe;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#00f2fe;stop-opacity:1" />
    </linearGradient>
    <filter id="glow${size}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Minimal background - just rounded corners -->
  <rect x="0" y="0" width="${size}" height="${size}" fill="url(#bgGrad${size})" rx="${size/12}"/>
  
  <!-- MASSIVE star that fills 90% of the space -->
  <g transform="translate(${size/2}, ${size/2})">
    <path d="M0,${-size*0.45} L${size*0.15},${-size*0.15} L${size*0.45},0 L${size*0.15},${size*0.15} L0,${size*0.45} L${-size*0.15},${size*0.15} L${-size*0.45},0 L${-size*0.15},${-size*0.15} Z" 
          fill="url(#starGrad${size})" filter="url(#glow${size})" stroke="rgba(255,255,255,0.8)" stroke-width="1"/>
  </g>
  
  <!-- LARGE upward arrow that covers most of the center -->
  <g transform="translate(${size/2}, ${size/2})">
    <path d="M0,${-size*0.25} L${size*0.2},${-size*0.05} L${size*0.12},${-size*0.05} L${size*0.12},${size*0.2} L${-size*0.12},${size*0.2} L${-size*0.12},${-size*0.05} L${-size*0.2},${-size*0.05} Z" 
          fill="url(#arrowGrad${size})" filter="url(#glow${size})" stroke="rgba(255,255,255,0.9)" stroke-width="1"/>
  </g>
  
  <!-- Minimal corner accents -->
  <circle cx="${size*0.9}" cy="${size*0.1}" r="${size*0.06}" fill="white" opacity="0.9"/>
  <circle cx="${size*0.1}" cy="${size*0.9}" r="${size*0.06}" fill="white" opacity="0.9"/>
  
  <!-- Tiny sparkles in corners -->
  <g transform="translate(${size*0.15}, ${size*0.15})">
    <path d="M0,${-size*0.04} L${size*0.015},${-size*0.015} L${size*0.04},0 L${size*0.015},${size*0.015} L0,${size*0.04} L${-size*0.015},${size*0.015} L${-size*0.04},0 L${-size*0.015},${-size*0.015} Z" 
          fill="white" opacity="0.8"/>
  </g>
  <g transform="translate(${size*0.85}, ${size*0.85})">
    <path d="M0,${-size*0.04} L${size*0.015},${-size*0.015} L${size*0.04},0 L${size*0.015},${size*0.015} L0,${size*0.04} L${-size*0.015},${size*0.015} L${-size*0.04},0 L${-size*0.015},${-size*0.015} Z" 
          fill="white" opacity="0.8"/>
  </g>
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
    console.log(`✅ Created ${filename} (${size}x${size}) - MASSIVE ELEMENTS`);
});

console.log('\n🎉 MASSIVE full-space icons created successfully!');

// Create README for icons
const readme = `# Chrome Extension Icons - MASSIVE Full-Space Version

## Design Features
- **MASSIVE elements**: Star fills 90% of icon space, arrow covers most of center
- **Minimal background**: Just rounded corners, elements dominate the space
- **Huge central star**: Takes up almost the entire icon area
- **Large arrow**: Prominent upward pointing arrow covering center
- **Minimal accents**: Small corner elements that don't distract
- **White outlines**: Ensure elements stand out clearly
- **Maximum visibility**: Elements are as large as possible

## Color Palette
- Background: #667eea → #764ba2 → #f093fb (Purple to Pink) - MINIMAL
- Star: #ffecd2 → #fcb69f (Warm Orange) - MASSIVE
- Arrow: #4facfe → #00f2fe (Blue Cyan) - LARGE
- Accents: White with high opacity - SMALL

## Sizes Generated
- 16x16px (toolbar) - Massive star dominates
- 32x32px (extension management) - Large elements
- 48x48px (extension details) - Full-space design
- 128x128px (Chrome Web Store) - Maximum impact

These icons prioritize element size over background, ensuring maximum visibility.
`;

fs.writeFileSync(path.join(iconsDir, 'README.md'), readme);
console.log('📚 Created README.md with MASSIVE icon documentation');

console.log('\n🎨 These MASSIVE icons should dominate the entire space!');
console.log('Key improvements:');
console.log('- Star now fills 90% of the icon space');
console.log('- Arrow is much larger and more prominent');
console.log('- Background is minimal, elements dominate');
console.log('- White outlines for maximum contrast'); 