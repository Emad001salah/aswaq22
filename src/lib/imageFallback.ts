/**
 * Safe Image Fallback Helper for Aswaq 22
 * Provides inline SVG Data URIs and robust error handlers to guarantee zero broken image boxes across the platform.
 */

export const SVG_PLACEHOLDER_AD = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" fill="none"><rect width="800" height="600" fill="%230f172a"/><path d="M400 220L480 340H320L400 220Z" fill="%2310b981" opacity="0.6"/><path d="M460 270L520 340H400L460 270Z" fill="%23059669" opacity="0.8"/><circle cx="340" cy="200" r="30" fill="%23f59e0b" opacity="0.8"/><text x="50%" y="78%" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" fill="%2394a3b8" text-anchor="middle">أَسْوَاق 22 - صورة المعاينة</text></svg>`;

export const SVG_PLACEHOLDER_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none"><rect width="120" height="120" rx="30" fill="%2310b981"/><text x="50%" y="65%" font-family="system-ui, sans-serif" font-size="64" font-weight="900" fill="%23ffffff" text-anchor="middle">أ</text></svg>`;

export function handleAdImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  if (target.src !== SVG_PLACEHOLDER_AD) {
    target.src = SVG_PLACEHOLDER_AD;
  }
}

export function handleLogoImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  if (target.src !== SVG_PLACEHOLDER_LOGO) {
    target.src = SVG_PLACEHOLDER_LOGO;
  }
}
