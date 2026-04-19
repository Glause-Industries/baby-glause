from PIL import Image, ImageDraw
import math, os

def make_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background circle - dark espresso
    draw.ellipse([0, 0, size-1, size-1], fill='#211e1a')
    
    # Subtle rose glow in upper half
    for r in range(size//2, 0, -1):
        alpha = int(12 * (1 - r/(size//2)))
        draw.ellipse([size//2-r, size//4-r, size//2+r, size//4+r], 
                     fill=(196, 135, 122, alpha))
    
    # Draw a simple heart shape
    cx, cy = size//2, size//2
    s = size * 0.28
    
    # Heart using bezier approximation with polygon
    heart_pts = []
    for i in range(360):
        t = math.radians(i)
        # Heart parametric equations
        x = s * 16 * (math.sin(t)**3) / 16
        y = -s * (13*math.cos(t) - 5*math.cos(2*t) - 2*math.cos(3*t) - math.cos(4*t)) / 16
        heart_pts.append((cx + x, cy + y - size*0.05))
    
    draw.polygon(heart_pts, fill='#c4877a')
    
    # Small inner highlight on heart
    inner_pts = []
    scale = 0.45
    for i in range(360):
        t = math.radians(i)
        x = s * scale * 16 * (math.sin(t)**3) / 16
        y = -s * scale * (13*math.cos(t) - 5*math.cos(2*t) - 2*math.cos(3*t) - math.cos(4*t)) / 16
        inner_pts.append((cx + x - size*0.03, cy + y - size*0.08))
    draw.polygon(inner_pts, fill='#d4a090')
    
    return img

sizes = [16, 32, 57, 60, 72, 76, 114, 120, 144, 152, 167, 180, 192, 512]
os.makedirs('/home/user/workspace/baby-glause/icons', exist_ok=True)

for s in sizes:
    img = make_icon(s)
    img.save(f'/home/user/workspace/baby-glause/icons/icon-{s}x{s}.png')
    print(f'Generated {s}x{s}')

# Also save the apple touch icon at root level
make_icon(180).save('/home/user/workspace/baby-glause/apple-touch-icon.png')
make_icon(32).save('/home/user/workspace/baby-glause/favicon-32x32.png')
make_icon(16).save('/home/user/workspace/baby-glause/favicon-16x16.png')
print('All icons generated!')
