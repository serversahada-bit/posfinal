export type BlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'list'
  | 'testimonial'
  | 'pricing';

export interface Block {
  id: string;
  type: BlockType;
  content: Record<string, string>;
  styles: Record<string, string>;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

export function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function renderBlocksToHtml(blocks: Block[]) {
  return blocks
    .map((block) => {
      const s = block.styles;

      switch (block.type) {
        case 'heading':
          return `<h2 style="font-size:${s.fontSize};font-weight:${s.fontWeight};color:${s.color};text-align:${s.textAlign};padding:${s.padding}">${nl2br(
            block.content.text || ''
          )}</h2>`;
        case 'text':
          return `<p style="font-size:${s.fontSize};color:${s.color};text-align:${s.textAlign};line-height:${s.lineHeight};padding:${s.padding};white-space:pre-wrap">${nl2br(
            block.content.text || ''
          )}</p>`;
        case 'image':
          return block.content.src
            ? `<img src="${escapeHtml(block.content.src)}" alt="${escapeHtml(
                block.content.alt || ''
              )}" style="width:${s.width};border-radius:${s.borderRadius};padding:${s.padding}" />`
            : '';
        case 'button':
          return `<div style="margin:8px 16px"><a href="${escapeHtml(
            block.content.href || '#'
          )}" style="background-color:${s.backgroundColor};color:${s.color};font-size:${s.fontSize};font-weight:${s.fontWeight};padding:${s.padding};border-radius:${s.borderRadius};display:block;text-align:${s.textAlign};text-decoration:none;box-sizing:border-box">${nl2br(
            block.content.text || ''
          )}</a></div>`;
        case 'divider':
          return `<hr style="border-color:${s.borderColor};margin:${s.margin}" />`;
        case 'list':
          return `<div style="font-size:${s.fontSize};color:${s.color};padding:${s.padding};line-height:${s.lineHeight};white-space:pre-wrap">${nl2br(
            block.content.items || ''
          )}</div>`;
        case 'testimonial':
          return `<div style="background-color:${s.backgroundColor};border-radius:${s.borderRadius};padding:${s.padding};margin:${s.margin}"><div style="color:#fbbf24;font-size:18px;margin-bottom:8px">${'★'.repeat(
            Number(block.content.rating || '0')
          )}</div><p style="font-size:13px;font-style:italic;color:#374151">${nl2br(
            block.content.quote || ''
          )}</p><div style="font-size:12px;font-weight:700;margin-top:8px">${nl2br(
            block.content.name || ''
          )}</div></div>`;
        case 'pricing':
          return `<div style="text-align:${s.textAlign};padding:${s.padding};background-color:${s.backgroundColor};border-radius:${s.borderRadius};margin:${s.margin}"><div style="font-size:13px;color:#9ca3af;text-decoration:line-through;margin-bottom:4px">${nl2br(
            block.content.originalPrice || ''
          )}</div><div style="font-size:28px;font-weight:900;color:#dc2626;margin-bottom:4px">${nl2br(
            block.content.salePrice || ''
          )}</div><span style="background:#fef9c3;color:#92400e;font-size:11px;font-weight:700;padding:2px 10px;border-radius:50px">${nl2br(
            block.content.label || ''
          )}</span></div>`;
        default:
          return '';
      }
    })
    .join('\n');
}

export function buildStoredHtml(blocks: Block[]) {
  return `<div style="max-width:480px;margin:0 auto;font-family:sans-serif;background:#fff;overflow:hidden">
${renderBlocksToHtml(blocks)}
</div>`;
}

export function buildStaticPageDocument({
  title,
  bodyHtml,
}: {
  title: string;
  bodyHtml: string;
}) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <main class="lp-shell">
    <div class="lp-container">
${bodyHtml}
    </div>
  </main>
  <script src="./script.js" defer></script>
</body>
</html>`;
}

export function buildStaticPageCss() {
  return `*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top, #fdf4ff 0%, #eff6ff 45%, #f8fafc 100%);
  color: #111827;
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
}

img {
  display: block;
  max-width: 100%;
}

.lp-shell {
  min-height: 100vh;
  padding: 24px 16px;
}

.lp-container {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 30px 60px -30px rgba(15, 23, 42, 0.35);
}

@media (max-width: 640px) {
  .lp-shell {
    padding: 0;
  }

  .lp-container {
    max-width: 100%;
    min-height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }
}`;
}

export function buildStaticPageScript() {
  return `document.addEventListener("click", function(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const anchor = target.closest("a");
  if (!anchor) return;

  const href = anchor.getAttribute("href") || "";
  if (href.startsWith("#")) {
    event.preventDefault();
  }
});`;
}
