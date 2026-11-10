/**
 * Content display switches.
 *
 * `showPendingFields` — when true, content slots that the source material does
 * not cover are rendered as clearly marked "pending" placeholders instead of
 * being hidden. Set to false to hide every placeholder once the content is
 * filled in (or before publishing with gaps).
 */
export const contentConfig = {
  showPendingFields: false,
  /**
   * The "Tech we work with" section. When false the section, its menu link and
   * the links into it from project pages are hidden; nothing is deleted. Set
   * to true to bring it back.
   */
  showTechnologies: false,
  /** Primary factual reference for everything in this folder. */
  sourceSite: 'https://sentrychris.github.io/',
  /** Date the source material was last read. */
  verifiedOn: '2026-11-10',
} as const;
