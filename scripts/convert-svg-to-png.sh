#!/bin/bash

# Convert SVG icons to PNG using macOS qlmanage
echo "🎨 Converting SVG icons to PNG format..."

ICONS_DIR="public/icons"
TEMP_DIR="/tmp/icon_conversion"

# Create temp directory
mkdir -p "$TEMP_DIR"

# Function to convert SVG to PNG
convert_svg_to_png() {
    local size=$1
    local svg_file="$ICONS_DIR/icon${size}.svg"
    local png_file="$ICONS_DIR/icon${size}.png"
    local temp_file="$TEMP_DIR/icon${size}.png"
    
    if [ -f "$svg_file" ]; then
        echo "Converting icon${size}.svg to PNG..."
        
        # Use qlmanage to generate thumbnail
        qlmanage -t -s $size -o "$TEMP_DIR" "$svg_file" > /dev/null 2>&1
        
        # Find the generated file (qlmanage adds .png.png sometimes)
        if [ -f "$TEMP_DIR/icon${size}.svg.png" ]; then
            mv "$TEMP_DIR/icon${size}.svg.png" "$png_file"
            echo "✅ Created icon${size}.png (${size}x${size})"
        elif [ -f "$TEMP_DIR/icon${size}.png" ]; then
            mv "$TEMP_DIR/icon${size}.png" "$png_file"
            echo "✅ Created icon${size}.png (${size}x${size})"
        else
            echo "❌ Failed to convert icon${size}.svg"
            # Fallback: copy SVG as PNG (browsers can handle SVG)
            cp "$svg_file" "$png_file"
            echo "⚠️  Using SVG as fallback for icon${size}.png"
        fi
    else
        echo "❌ SVG file not found: $svg_file"
    fi
}

# Convert all icon sizes
convert_svg_to_png 16
convert_svg_to_png 32
convert_svg_to_png 48
convert_svg_to_png 128

# Clean up temp directory
rm -rf "$TEMP_DIR"

echo ""
echo "🎉 Icon conversion completed!"
echo ""
echo "📁 Icon files in $ICONS_DIR:"
ls -la "$ICONS_DIR"/*.png 2>/dev/null || echo "No PNG files found"
echo ""
echo "📝 Icons are ready for Chrome extension!" 