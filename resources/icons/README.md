# XClaw Application Icons

This directory stores the master brand icon for the desktop app.
The visual direction follows OpenClaw's lobster mascot semantics while keeping
XClaw's own application packaging chain.

## Required Files

| File | Platform | Description |
|------|----------|-------------|
| `icon.svg` | Source | Vector source for all icons |
| `favicon.svg` | Source | Browser favicon source |
| `icon.icns` | macOS | Apple Icon Image format |
| `icon.ico` | Windows | Windows ICO format |
| `icon.png` | All | 512x512 PNG fallback |
| `16x16.png` - `512x512.png` | Linux | PNG set for Linux |
| `tray-icon-template.svg` | Source | macOS tray icon template source |
| `tray-icon-Template.png` | macOS | 22x22 status bar icon (note: "Template" suffix required) |
| `public/favicon.svg` | Web | Browser SVG favicon |
| `public/favicon.ico` | Web | Browser ICO favicon |
| `public/apple-touch-icon.png` | Web | Apple touch icon |

## Generating Icons

### Using the Script

```bash
pnpm run icons
```

## Design Guidelines

### Application Icon
- **Primary Motif**: OpenClaw-style lobster mascot
- **Canvas**: Rounded square desktop icon card for the app asset, transparent for favicon
- **Color**: Red body gradient with cyan eye highlights
- **Small Sizes**: Keep the silhouette readable before adding detail
- **Quality**: Use layered gradients, soft shadows and high-resolution vector source instead of relying on raster upscaling

### macOS Tray Icon
- **Format**: Single-color (black) on transparent background
- **Size**: 22x22 pixels (system automatically handles @2x retina)
- **Naming**: Must end with "Template.png" for automatic template mode
- **Design**: Simplified monochrome lobster silhouette
- **Source**: Use `tray-icon-template.svg` as the source
- **Important**: Must be pure black (#000000) on transparent background - no gradients or colors

## Updating the Icon

1. Edit `resources/icons/icon.svg`
2. Edit `resources/icons/favicon.svg`
3. Edit `resources/icons/tray-icon-template.svg`
4. Run `pnpm run icons`
5. Verify `resources/icons/*` and `public/favicon*`
6. Commit the source and generated outputs together
