# Student Avatar Asset Contract

The student portal prototype uses CSS placeholders so it remains reviewable before final art exists. The filenames in `manifest.json` are the intended replacement points for generated avatar art.

## Layer rules

- Export every asset on the same transparent `1024 × 1024` canvas.
- Keep the character anchor, scale, and crop identical across all files.
- Use transparent WebP when possible; transparent PNG is also acceptable if the manifest is updated.
- Base avatars render first, outfits second, and accessories last.
- Do not bake clothing or accessories into a base avatar if the item should be selectable.
- Keep filenames stable after application code begins consuming the manifest.

## Folders

- `avatars/`: body, head, hair, and default face layer.
- `outfits/`: clothing layers aligned to every compatible base.
- `accessories/`: hats, glasses, badges, and other foreground layers.

The prototype currently references `avatar-01.webp` through `avatar-03.webp`, `outfit-01.webp` through `outfit-03.webp`, and `accessory-01.webp` through `accessory-02.webp`. Missing images are intentional at this stage; CSS stand-ins show the interaction without committing the product to placeholder art.
