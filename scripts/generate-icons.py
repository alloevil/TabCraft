#!/usr/bin/env python3
"""Generate TabCraft extension icons (16, 48, 128px) as SVG-based PNG."""
import struct
import zlib
import os

def create_png(width, height, pixels):
    """Create a minimal PNG from RGBA pixel data."""
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))

    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter none
        for x in range(width):
            idx = (y * width + x) * 4
            raw += pixels[idx:idx+4]

    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend


def draw_icon(size):
    """Draw a stylized 'TC' icon with a tab/craft feel."""
    pixels = bytearray(size * size * 4)

    cx, cy = size // 2, size // 2
    r = size * 0.42

    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4
            dx = x - cx
            dy = y - cy
            dist = (dx*dx + dy*dy) ** 0.5

            # Rounded square background
            corner_r = size * 0.18
            half = size * 0.44
            in_square = (abs(dx) <= half and abs(dy) <= half)

            # Check corners
            if in_square:
                if abs(dx) > half - corner_r and abs(dy) > half - corner_r:
                    cdx = abs(dx) - (half - corner_r)
                    cdy = abs(dy) - (half - corner_r)
                    if (cdx*cdx + cdy*cdy) > corner_r * corner_r:
                        in_square = False

            if in_square:
                # Gradient from indigo to purple
                t = (y / size)
                r_c = int(79 + t * 40)   # 79 -> 119
                g_c = int(70 + t * (-10))  # 70 -> 60
                b_c = int(229 - t * 40)  # 229 -> 189

                # Tab fold in top-right corner
                fold_size = size * 0.22
                if x > size - fold_size and y < fold_size:
                    fx = x - (size - fold_size)
                    fy = y
                    if fx + fy < fold_size * 0.7:
                        # Fold triangle - lighter
                        r_c = min(255, r_c + 40)
                        g_c = min(255, g_c + 40)
                        b_c = min(255, b_c + 40)
                    else:
                        # Above fold - shadow
                        r_c = max(0, r_c - 30)
                        g_c = max(0, g_c - 30)
                        b_c = max(0, b_c - 30)

                # "T" letter
                t_bar_w = size * 0.24
                t_stem_w = size * 0.10
                t_bar_y = size * 0.30
                t_bar_h = size * 0.08
                t_stem_x = cx - t_stem_w / 2
                t_stem_top = t_bar_y + t_bar_h

                # "C" letter
                c_x = cx - size * 0.05
                c_y = size * 0.50
                c_r_outer = size * 0.18
                c_r_inner = size * 0.12
                c_gap = size * 0.08

                is_t = False
                is_c = False

                # T bar
                if (t_bar_y <= y <= t_bar_y + t_bar_h) and (cx - t_bar_w/2 <= x <= cx + t_bar_w/2):
                    is_t = True
                # T stem
                if (t_bar_y + t_bar_h <= y <= size * 0.62) and (t_stem_x <= x <= t_stem_x + t_stem_w):
                    is_t = True

                # C shape (arc with gap on right)
                c_dist = ((x - c_x)**2 + (y - c_y)**2) ** 0.5
                if c_r_inner <= c_dist <= c_r_outer:
                    # Check angle - gap on right side
                    import math
                    angle = math.atan2(y - c_y, x - c_x)
                    angle_deg = math.degrees(angle)
                    if angle_deg < -30 or angle_deg > 210:
                        is_c = True

                if is_t or is_c:
                    # White letters
                    pixels[idx] = 255
                    pixels[idx+1] = 255
                    pixels[idx+2] = 255
                    pixels[idx+3] = 255
                else:
                    pixels[idx] = r_c
                    pixels[idx+1] = g_c
                    pixels[idx+2] = b_c
                    pixels[idx+3] = 255
            else:
                # Transparent
                pixels[idx] = 0
                pixels[idx+1] = 0
                pixels[idx+2] = 0
                pixels[idx+3] = 0

    return bytes(pixels)


# Generate icons
icons_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'icons')
os.makedirs(icons_dir, exist_ok=True)

for size in [16, 48, 128]:
    pixels = draw_icon(size)
    png_data = create_png(size, size, pixels)
    path = os.path.join(icons_dir, f'icon-{size}.png')
    with open(path, 'wb') as f:
        f.write(png_data)
    print(f'Generated {path} ({len(png_data)} bytes)')

print('Done!')
