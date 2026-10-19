# Writes the benchmark's photo / logo / text test images into ./images (needs: pip install scikit-image)
import os, numpy as np
from skimage import data, io, img_as_ubyte
os.makedirs("images", exist_ok=True)
for name in ["camera", "astronaut", "coffee", "horse", "text", "logo", "cat", "rocket"]:
    im = getattr(data, name)()
    if im.dtype == bool: im = (im * 255).astype(np.uint8)
    io.imsave(f"images/{name}.png", img_as_ubyte(im), check_contrast=False)
    print(name, im.shape)
