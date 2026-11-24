# MKEditor product screenshots

The product page uses fresh captures of the built **MKEditor v5.0.0 desktop application**. The interface is the production React/Monaco renderer, captured in an isolated Electron session at a 1600 × 1000 logical viewport and 2× device scale, producing 3200 × 2000 PNG originals. The page uses lossless WebP derivatives at full size, 1600px and 640px widths. Smaller derivatives use Lanczos resizing before encoding; full-size images preserve the capture pixels.

The **Fieldnotes** workspace, document text, assistant conversation and public connection state are illustrative demo data. No real user documents, account credentials or live provider calls are used. Drive views run the production `CloudService` and `GoogleDrive` adapter against a local HTTP fixture. The screenshots show real application components; the UI is not painted, generated or reconstructed for the website.

| Asset | View |
| --- | --- |
| `editor-dark` | Editor, file explorer and live preview in dark mode |
| `editor-light` | The same writing workspace in light mode |
| `assistant` | Optional assistant beside the editor, with an illustrative conversation |
| `google-drive` | Demo Drive documents and the top-toolbar storage selector |
| `providers` | OpenAI, Anthropic and Ollama provider settings |
| `preferences` | Editor preferences |
| `export` | HTML/PDF export preferences |
| `shortcuts` | Keyboard shortcut reference |
| `recovery` | Comparison after a fixture-induced Drive save conflict |

Files live in `assets/screenshots/`. Each basename has `.webp`, `-1600.webp` and `-640.webp` versions. Use responsive derivatives in page layouts and the full image for enlarged viewing. Preserve the original aspect ratio; do not crop away controls to imply a different product layout.

The portfolio project gallery reuses five of these captures: editor-dark, assistant, google-drive, providers and recovery. Existing product screenshot filenames also receive fresh captures so old inbound image links keep working.

The originals are captured by `scripts/capture-mkeditor.cjs` in the portfolio repository; it requires a current MKEditor checkout, its built Electron output and the local Drive test fixture. `scripts/prepare-mkeditor-assets.ps1` validates the nine capture dimensions, runs the FFmpeg lossless WebP conversions, and updates the responsive assets, portfolio gallery and legacy filename replacements. See the portfolio README for commands. These helpers are not part of website production runtime or visitor downloads. The locally bundled Geist font retains its supplied license at `assets/fonts/Geist-LICENSE.txt`.

The unmodified Google Drive mark is Google's [official product logo](https://www.gstatic.com/images/branding/productlogos/drive_2026/v2/web-64dp/logo_drive_2026_color_2x_web_64dp.png), used according to its [Drive branding guidance](https://developers.google.com/workspace/drive/api/guides/branding). Google Drive is a trademark of Google LLC.

The screenshots demonstrate v5.0 development builds. Published desktop installers are versioned independently; the product page resolves available GitHub releases per operating system. A v5.0 screenshot must not be presented as evidence that a v5.0 installer has been published.
