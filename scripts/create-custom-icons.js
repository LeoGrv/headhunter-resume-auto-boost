#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Ensure icons directory exists
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('🎨 Creating beautiful custom icons for Chrome extension...');

// Create stylish and visible icons with better contrast
function createIcon(size) {
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF6B6B;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#4ECDC4;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#45B7D1;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFE66D;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FF6B6B;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background circle with vibrant gradient -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="url(#bgGrad)" filter="url(#shadow)" />
  
  <!-- Inner ring for depth -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 6}" fill="none" stroke="white" stroke-width="2" opacity="0.3" />
  
  <!-- Central star/boost icon -->
  <g transform="translate(${size/2}, ${size/2})">
    <path d="M0,${-size/4} L${size/8},${-size/8} L${size/4},0 L${size/8},${size/8} L0,${size/4} L${-size/8},${size/8} L${-size/4},0 L${-size/8},${-size/8} Z" 
          fill="url(#starGrad)" filter="url(#shadow)" />
  </g>
  
  <!-- Arrow pointing up (boost symbol) -->
  <g transform="translate(${size/2}, ${size/2})">
    <path d="M0,${-size/6} L${size/12},${-size/12} L${size/24},${-size/12} L${size/24},${size/8} L${-size/24},${size/8} L${-size/24},${-size/12} L${-size/12},${-size/12} Z" 
          fill="white" opacity="0.9" />
  </g>
  
  <!-- Accent dots for visual interest -->
  <circle cx="${size - size/6}" cy="${size/6}" r="${size/16}" fill="white" opacity="0.7" />
  <circle cx="${size/6}" cy="${size - size/6}" r="${size/16}" fill="white" opacity="0.7" />
  
  <!-- Small sparkles -->
  <g transform="translate(${size/4}, ${size/4})">
    <path d="M0,-3 L1,-1 L3,0 L1,1 L0,3 L-1,1 L-3,0 L-1,-1 Z" fill="white" opacity="0.6" />
  </g>
  <g transform="translate(${size - size/4}, ${size - size/4})">
    <path d="M0,-3 L1,-1 L3,0 L1,1 L0,3 L-1,1 L-3,0 L-1,-1 Z" fill="white" opacity="0.6" />
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
    console.log(`✅ Created ${filename} (${size}x${size})`);
});

console.log('\n🎉 Custom SVG icons created successfully!');

// Create README for icons
const readme = `# Chrome Extension Icons

## Design Features
- **Vibrant gradient background**: Red → Teal → Blue for maximum visibility
- **Golden star**: Central boost symbol with gradient
- **White arrow**: Upward pointing arrow symbolizing "boost"
- **Accent elements**: Sparkles and dots for visual interest
- **Drop shadows**: Added depth and professional look

## Color Palette
- Background: #FF6B6B → #4ECDC4 → #45B7D1
- Star: #FFE66D → #FF6B6B
- Accents: White with various opacities

## Sizes Generated
- 16x16px (toolbar)
- 32x32px (extension management)
- 48x48px (extension details)
- 128x128px (Chrome Web Store)

These icons are designed to be highly visible and recognizable in the Chrome browser interface.
`;

fs.writeFileSync(path.join(iconsDir, 'README.md'), readme);
console.log('📚 Created README.md with icon documentation');

console.log('\n📝 Note: For production, consider converting SVG to PNG using:');
console.log('   - Online tools like CloudConvert');
console.log('   - Command line tools like ImageMagick');
console.log('   - Or use the SVG files directly in manifest.json'); 