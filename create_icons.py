from PIL import Image, ImageDraw
import os

# Create icons directory if it doesn't exist
os.makedirs('dist/icons', exist_ok=True)

# Create simple colored icons
for size in [16, 48, 128]:
    img = Image.new('RGB', (size, size), color='#4CAF50')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple arrow up
    arrow_size = size // 3
    center_x, center_y = size // 2, size // 2
    
    # Triangle points
    points = [
        (center_x, center_y - arrow_size // 2),
        (center_x - arrow_size // 2, center_y + arrow_size // 2),
        (center_x + arrow_size // 2, center_y + arrow_size // 2)
    ]
    
    draw.polygon(points, fill='white')
    img.save(f'dist/icons/icon{size}.png')
    print(f'Created icon{size}.png') 