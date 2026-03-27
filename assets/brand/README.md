# Oh-My-Guard! Brand Assets

This folder contains AI generation prompts for every brand asset and a map of where each generated file should be placed in the repo.

## How to use

1. Open the prompt file for the asset you want to generate
2. Paste the prompt into your AI image generator (Midjourney, DALL-E 3, Adobe Firefly, etc.)
3. Save the generated file using the exact filename listed in the table below
4. Place it in the target path listed

---

## Asset Map

| # | Prompt File | Generate → Save As | Target Path in Repo | Used By |
|---|---|---|---|---|
| 1 | `prompts/01_icon_512x512.md` | `icon-512.png` | `assets/brand/icons/icon-512.png` | Desktop shortcut, app store, installer |
| 2 | `prompts/02_icon_256x256.md` | `icon-256.png` | `assets/brand/icons/icon-256.png` | Windows .ico, macOS Finder, high-DPI taskbar |
| 3 | `prompts/03_icon_32x32.md` | `icon-32.png` | `assets/brand/icons/icon-32.png` | System tray, window title bar |
| 4 | `prompts/04_logo_horizontal_dark.md` | `logo-dark.png` | `assets/brand/logo-dark.png` | Dashboard navbar, login page, README |
| 5 | `prompts/05_logo_horizontal_light.md` | `logo-light.png` | `assets/brand/logo-light.png` | Docs, PDFs, light-themed pages |
| 6 | `prompts/06_favicon_16x16.md` | `favicon.png` | `artifacts/oh-my-guard/public/favicon.png` | Browser tab (React frontend) |
| 7 | `prompts/07_og_image.md` | `opengraph.png` | `artifacts/oh-my-guard/public/opengraph.png` | Social link previews, GitHub preview |
| 8 | `prompts/08_splash_screen.md` | `splash.png` | `assets/brand/splash.png` | Desktop app loader, installer splash |

---

## Where assets are referenced in code

### React Frontend (`artifacts/oh-my-guard/`)
- `public/favicon.png` → referenced in `index.html` as `<link rel="icon">`
- `public/opengraph.png` → referenced in `index.html` as `<meta property="og:image">`
- `public/images/logo.png` → replace with `logo-dark.png` — used in the app navbar

### Python Dashboard (`oh-my-guard/dashboard/`)
- `base.html` navbar logo → replace `src` with path to `logo-dark.png`
- Login page → use `logo-dark.png` centered above the login form

### Installer
- `oh-my-guard/install/install.sh` and `install.ps1` → splash.png can be used by NSSM/desktop shortcut setup
- Windows `.ico` file → bundle `icon-256.png` + `icon-32.png` into a `.ico` using a tool like ImageMagick:
  ```bash
  convert icon-256.png icon-32.png icon.ico
  ```

### README / Docs
- Top of `oh-my-guard/README.md` → add `logo-dark.png` as the header image

---

## Recommended AI tools per asset

| Asset | Best Tool | Notes |
|---|---|---|
| Icons (512, 256, 32) | Midjourney v6 | Add `--ar 1:1 --style raw` |
| Favicon 16x16 | Manual in Figma/Inkscape | AI tools struggle at 16px — trace from 32px version |
| Logo horizontal | Midjourney v6 or Adobe Firefly | Add `--ar 5:1` for horizontal ratio |
| OG image | DALL-E 3 or Midjourney | Add `--ar 1200:630` |
| Splash screen | Midjourney v6 | Add `--ar 16:9` |

---

## Brand colors (reference)

| Name | Hex | Usage |
|---|---|---|
| Navy Background | `#0A0F1E` | All dark backgrounds |
| Shield Body | `#0D1B2A` | Shield interior |
| Cyan Accent | `#00D4FF` | Borders, glow, highlights, "!" |
| Dark Teal | `#0D7377` | Secondary accent, light version |
| White | `#FFFFFF` | Exclamation mark, primary text |
| Muted Grey | `#8899AA` | Subtitles, secondary text |
