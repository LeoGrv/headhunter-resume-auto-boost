#!/bin/bash

# HeadHunter Resume Auto-Boost Extension
# Icon Creation Script

echo "Creating Chrome extension icons..."

# Create icons directory if it doesn't exist
mkdir -p public/icons

# Source icon (macOS generic app icon)
SOURCE_ICON="/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns"

# Check if source icon exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo "Error: Source icon not found at $SOURCE_ICON"
    echo "This script is designed for macOS. Please create icons manually."
    exit 1
fi

# Create icons with different sizes
echo "Creating icon16.png (16x16)..."
sips -s format png -z 16 16 "$SOURCE_ICON" --out public/icons/icon16.png

echo "Creating icon32.png (32x32)..."
sips -s format png -z 32 32 "$SOURCE_ICON" --out public/icons/icon32.png

echo "Creating icon48.png (48x48)..."
sips -s format png -z 48 48 "$SOURCE_ICON" --out public/icons/icon48.png

echo "Creating icon128.png (128x128)..."
sips -s format png -z 128 128 "$SOURCE_ICON" --out public/icons/icon128.png

echo "Icons created successfully!"
echo ""
echo "Icon files:"
ls -la public/icons/

echo ""
echo "To rebuild the extension with new icons, run: npm run build" 