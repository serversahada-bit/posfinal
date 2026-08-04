import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';

const prisma = new PrismaClient();

export default async function LandingPageViewer({ params }: { params: { slug: string } }) {
  const { slug } = await params;
  
  const landingPage = await prisma.landing_pages.findUnique({
    where: { slug: slug }
  });

  if (!landingPage) {
    notFound();
  }

  // Bungkus HTML dalam dokumen lengkap agar CSS aplikasi tidak bocor ke halaman LP
  const fullHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${landingPage.title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f3f4f6;
      color: #111827;
      -webkit-font-smoothing: antialiased;
    }
    a { text-decoration: none; color: inherit; }
    img { max-width: 100%; display: block; }
    p { margin: 0; }
    h1,h2,h3,h4,h5,h6 { margin: 0; }
    ul, ol { list-style: none; padding: 0; margin: 0; }
    button { cursor: pointer; border: none; background: none; }
    .container {
      max-width: 480px;
      margin: 0 auto;
      background: #fff;
      min-height: 100vh;
      overflow: hidden;
      box-shadow: 0 4px 32px rgba(0,0,0,0.10);
    }
  </style>
</head>
<body>
  <div class="container">
    ${landingPage.html_data}
  </div>
</body>
</html>`;

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <iframe
        srcDoc={fullHtml}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title={landingPage.title}
      />
    </div>
  );
}
