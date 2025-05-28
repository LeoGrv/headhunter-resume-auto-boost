#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Ensure icons directory exists
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('🎨 Creating beautiful full-size icons for Chrome extension...');

// Create beautiful icons that fill the entire space
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
    <filter id="glow${size}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Full background with beautiful gradient -->
  <rect x="0" y="0" width="${size}" height="${size}" fill="url(#bgGrad${size})" rx="${size/8}"/>
  
  <!-- Large central star that fills most of the space -->
  <g transform="translate(${size/2}, ${size/2})">
    <path d="M0,${-size*0.35} L${size*0.12},${-size*0.12} L${size*0.35},0 L${size*0.12},${size*0.12} L0,${size*0.35} L${-size*0.12},${size*0.12} L${-size*0.35},0 L${-size*0.12},${-size*0.12} Z" 
          fill="url(#starGrad${size})" filter="url(#glow${size})"/>
  </g>
  
  <!-- Large upward arrow in the center -->
  <g transform="translate(${size/2}, ${size/2})">
    <path d="M0,${-size*0.2} L${size*0.15},${-size*0.05} L${size*0.08},${-size*0.05} L${size*0.08},${size*0.15} L${-size*0.08},${size*0.15} L${-size*0.08},${-size*0.05} L${-size*0.15},${-size*0.05} Z" 
          fill="url(#arrowGrad${size})" filter="url(#glow${size})"/>
  </g>
  
  <!-- Corner accent elements -->
  <circle cx="${size*0.85}" cy="${size*0.15}" r="${size*0.08}" fill="white" opacity="0.8" filter="url(#glow${size})"/>
  <circle cx="${size*0.15}" cy="${size*0.85}" r="${size*0.08}" fill="white" opacity="0.8" filter="url(#glow${size})"/>
  
  <!-- Small decorative stars in corners -->
  <g transform="translate(${size*0.2}, ${size*0.2})">
    <path d="M0,${-size*0.06} L${size*0.02},${-size*0.02} L${size*0.06},0 L${size*0.02},${size*0.02} L0,${size*0.06} L${-size*0.02},${size*0.02} L${-size*0.06},0 L${-size*0.02},${-size*0.02} Z" 
          fill="white" opacity="0.6"/>
  </g>
  <g transform="translate(${size*0.8}, ${size*0.8})">
    <path d="M0,${-size*0.06} L${size*0.02},${-size*0.02} L${size*0.06},0 L${size*0.02},${size*0.02} L0,${size*0.06} L${-size*0.02},${size*0.02} L${-size*0.06},0 L${-size*0.02},${-size*0.02} Z" 
          fill="white" opacity="0.6"/>
  </g>
  
  <!-- Subtle border for definition -->
  <rect x="1" y="1" width="${size-2}" height="${size-2}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1" rx="${size/8-1}"/>
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

console.log('\n🎉 Beautiful full-size icons created successfully!');

// Create README for icons
const readme = `# Chrome Extension Icons - Full Size Beautiful Version

## Design Features
- **Full-size design**: Icons fill the entire space with no wasted area
- **Beautiful gradient background**: Purple to pink gradient for modern look
- **Large central star**: Prominent boost symbol with warm gradient
- **Bold arrow**: Clear upward pointing arrow with blue gradient
- **Corner accents**: White circles and small stars for visual interest
- **Subtle glow effects**: Soft lighting for premium appearance
- **Rounded corners**: Modern app-like appearance

## Color Palette
- Background: #667eea → #764ba2 → #f093fb (Purple to Pink)
- Star: #ffecd2 → #fcb69f (Warm Orange)
- Arrow: #4facfe → #00f2fe (Blue Cyan)
- Accents: White with various opacities

## Sizes Generated
- 16x16px (toolbar) - Simplified for small size
- 32x32px (extension management)
- 48x48px (extension details)
- 128x128px (Chrome Web Store)

These icons are designed to be highly visible, fill the entire icon space, and look beautiful in Chrome.
`;

fs.writeFileSync(path.join(iconsDir, 'README.md'), readme);
console.log('📚 Created README.md with icon documentation');

console.log('\n🎨 These beautiful full-size icons should look amazing in Chrome!');
console.log('Key improvements:');
console.log('- Icons now fill the entire space');
console.log('- Larger, more prominent elements');
console.log('- Beautiful gradients and glow effects');
console.log('- Modern rounded rectangle design'); 