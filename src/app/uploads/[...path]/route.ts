import { access, readdir, readFile } from 'fs/promises';
import path from 'path';
import { getUploadRoot } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPLOAD_ROOT = getUploadRoot();

const MIME_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function isSafePathSegment(segment: string) {
  return segment !== '' && segment !== '.' && segment !== '..' && !segment.includes('\\') && !segment.includes('\0');
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findCaseInsensitiveMatch(directory: string, requestedFileName: string) {
  const entries = await readdir(directory);
  const lowerName = requestedFileName.toLowerCase();
  const directMatch = entries.find((entry) => entry.toLowerCase() === lowerName);

  if (directMatch) {
    return path.join(directory, directMatch);
  }

  const requestedParsed = path.parse(requestedFileName);
  const fallbackNames = new Set<string>([requestedParsed.name.toLowerCase()]);

  if (requestedParsed.name.startsWith('proof_')) {
    fallbackNames.add(requestedParsed.name.replace(/^proof_/, '').toLowerCase());
  } else {
    fallbackNames.add(`proof_${requestedParsed.name}`.toLowerCase());
  }

  const byStemMatch = entries.find((entry) => fallbackNames.has(path.parse(entry).name.toLowerCase()));

  return byStemMatch ? path.join(directory, byStemMatch) : null;
}

async function resolveUploadPath(parts: string[]) {
  if (parts.length === 0 || parts.some((part) => !isSafePathSegment(part))) {
    return null;
  }

  const requestedPath = path.join(UPLOAD_ROOT, ...parts);
  const normalizedRequestedPath = path.normalize(requestedPath);

  if (normalizedRequestedPath !== UPLOAD_ROOT && !normalizedRequestedPath.startsWith(`${UPLOAD_ROOT}${path.sep}`)) {
    return null;
  }

  if (await fileExists(normalizedRequestedPath)) {
    return normalizedRequestedPath;
  }

  const directory = path.dirname(normalizedRequestedPath);
  if (!(await fileExists(directory))) {
    return null;
  }

  return findCaseInsensitiveMatch(directory, path.basename(normalizedRequestedPath));
}

function getContentType(filePath: string) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

export async function GET(_request: Request, context: RouteContext<'/uploads/[...path]'>) {
  const { path: requestedPath = [] } = await context.params;
  const resolvedPath = await resolveUploadPath(requestedPath);

  if (!resolvedPath) {
    return new Response('File not found', { status: 404 });
  }

  try {
    const fileBuffer = await readFile(resolvedPath);

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=0',
        'Content-Length': String(fileBuffer.byteLength),
        'Content-Type': getContentType(resolvedPath),
      },
    });
  } catch (error) {
    console.error('[GET /uploads/[...path]] Failed to read file:', error);
    return new Response('File not found', { status: 404 });
  }
}
