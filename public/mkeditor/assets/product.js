/* Progressive enhancements. Reading the page and following links need no JavaScript. */
(() => {
  const hero = document.getElementById("hero-screenshot");
  const heroLink = document.getElementById("hero-screenshot-link");
  const themeButtons = [...document.querySelectorAll("[data-theme-shot]")];

  for (const button of themeButtons) {
    button.addEventListener("click", () => {
      const theme = button.dataset.themeShot;
      if (!hero || !["dark", "light"].includes(theme)) return;
      const base = `./assets/screenshots/editor-${theme}`;
      const [width, height] = [1919, 1079];
      hero.width = width;
      hero.height = height;
      hero.src = `${base}-1600.webp`;
      hero.srcset = `${base}-640.webp 640w, ${base}-1600.webp 1600w, ${base}.webp ${width}w`;
      hero.alt = `MKEditor in ${theme} mode, with a file explorer, Markdown editor and live preview.`;
      if (heroLink) {
        heroLink.href = `${base}.webp`;
        heroLink.dataset.caption = `Editor and preview in ${theme} mode`;
      }
      for (const choice of themeButtons) {
        choice.setAttribute("aria-pressed", String(choice === button));
      }
    });
  }

  const viewer = document.getElementById("screenshot-viewer");
  const viewerImage = document.getElementById("viewer-image");
  const viewerCaption = document.getElementById("viewer-caption");
  const originalLink = document.querySelector("[data-viewer-original]");
  let lastTrigger;

  if (viewer && viewerImage && typeof viewer.showModal === "function") {
    for (const link of document.querySelectorAll("a[data-screenshot]")) {
      link.addEventListener("click", (event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const caption =
          link.dataset.caption ||
          link.querySelector("img")?.alt ||
          "MKEditor screenshot";
        viewerImage.src = link.href;
        viewerImage.alt = link.querySelector("img")?.alt || caption;
        if (viewerCaption) viewerCaption.textContent = caption;
        if (originalLink) originalLink.href = link.href;
        lastTrigger = link;
        viewer.showModal();
        event.preventDefault();
      });
    }

    for (const button of document.querySelectorAll("[data-viewer-close]")) {
      button.addEventListener("click", () => viewer.close());
    }
    viewer.addEventListener("click", (event) => {
      if (event.target !== viewer) return;
      const rect = viewer.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        viewer.close();
    });
    viewer.addEventListener("close", () => {
      lastTrigger?.focus({ preventScroll: true });
    });
  }

  async function refreshDownloads() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(
        "https://api.github.com/repos/versyxdigital/mkeditor/releases?per_page=30",
        {
          signal: controller.signal,
          credentials: "omit",
          cache: "force-cache",
        },
      );
      if (!response.ok) return;
      const releases = await response.json();
      if (!Array.isArray(releases)) return;
      const published = releases.filter(
        (release) =>
          release &&
          !release.draft &&
          !release.prerelease &&
          Array.isArray(release.assets),
      );
      const formats = {
        windows: /\.exe$/i,
        macos: /\.pkg$/i,
        linux: /\.deb$/i,
      };
      for (const [platform, format] of Object.entries(formats)) {
        let result;
        for (const release of published) {
          const asset = release.assets.find((entry) => {
            if (
              !entry ||
              typeof entry.name !== "string" ||
              !format.test(entry.name)
            )
              return false;
            try {
              const url = new URL(entry.browser_download_url);
              return (
                url.protocol === "https:" &&
                url.hostname === "github.com" &&
                url.pathname.startsWith(
                  "/versyxdigital/mkeditor/releases/download/",
                )
              );
            } catch {
              return false;
            }
          });
          if (asset && typeof release.tag_name === "string") {
            result = { asset, version: release.tag_name };
            break;
          }
        }
        if (!result) continue;
        for (const link of document.querySelectorAll(
          `[data-download="${platform}"]`,
        )) {
          link.href = result.asset.browser_download_url;
        }
        for (const label of document.querySelectorAll(
          `[data-version="${platform}"]`,
        )) {
          label.textContent = result.version;
        }
      }
    } catch {
      // Keep the real, published installer links already present in the HTML.
    } finally {
      clearTimeout(timeout);
    }
  }

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(refreshDownloads, { timeout: 1500 });
  } else {
    setTimeout(refreshDownloads, 0);
  }
})();
