export const VERSION = '4.0.0';
export const MAC_VERSION = '3.6.0';

export const REPO = 'versyxdigital/mkeditor';
export const REPO_URL = `https://github.com/${REPO}`;

export const SUPPORT_URL = 'https://donate.stripe.com/5kQaEX5Md80n3G5ans2Ry05';

export const releaseUrl = (file: string) => `${REPO_URL}/releases/download/v${VERSION}/${file}`;
export const macReleaseUrl = (file: string) => `${REPO_URL}/releases/download/v${MAC_VERSION}/${file}`;

export type Platform = {
  key: 'windows' | 'macos' | 'linux';
  label: string;
  format: string;
  version: string;
  iconClass: string;
  href: string;
  builtOn: string;
};

export const PLATFORMS: Platform[] = [
  {
    key: 'windows',
    label: 'Windows',
    format: '.exe',
    version: VERSION,
    iconClass: 'fa-brands fa-windows',
    href: releaseUrl(`mkeditor-setup-${VERSION}.exe`),
    builtOn: '19th May 2026',
  },
  {
    key: 'macos',
    label: 'MacOS',
    format: '.pkg',
    version: MAC_VERSION,
    iconClass: 'fa-brands fa-apple',
    href: macReleaseUrl(`mkeditor-setup-${MAC_VERSION}.pkg`),
    builtOn: '28th August 2025',
  },
  {
    key: 'linux',
    label: 'Linux',
    format: '.deb',
    version: VERSION,
    iconClass: 'fa-brands fa-linux',
    href: releaseUrl(`mkeditor-setup-${VERSION}.deb`),
    builtOn: '19th May 2026',
  },
];
