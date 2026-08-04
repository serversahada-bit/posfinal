import { access, mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';

const DEFAULT_UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

function sanitizeSegments(segments: string[]) {
  return segments
    .flatMap((segment) => segment.split('/'))
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..' && !segment.includes('\\') && !segment.includes('\0'));
}

export function getUploadRoot() {
  const customRoot = process.env.UPLOAD_ROOT?.trim();
  return customRoot ? path.resolve(customRoot) : DEFAULT_UPLOAD_ROOT;
}

export function getUploadDir(...segments: string[]) {
  return path.join(getUploadRoot(), ...sanitizeSegments(segments));
}

export async function ensureUploadDir(...segments: string[]) {
  const dir = getUploadDir(...segments);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function buildUploadUrl(...segments: string[]) {
  return `/${['uploads', ...sanitizeSegments(segments)].join('/')}`;
}

export async function saveUploadBuffer(segments: string[], filename: string, buffer: Buffer | Uint8Array) {
  const dir = await ensureUploadDir(...segments);
  const absolutePath = path.join(dir, filename);
  await writeFile(absolutePath, buffer);

  return {
    absolutePath,
    url: buildUploadUrl(...segments, filename),
  };
}

export function resolveStoredUploadPath(storedUrl: string | null | undefined) {
  if (!storedUrl) return null;

  const trimmed = storedUrl.replace(/^\/+/, '');
  if (!trimmed.startsWith('uploads/')) {
    return null;
  }

  const relative = trimmed.slice('uploads/'.length);
  const resolved = path.normalize(path.join(getUploadRoot(), relative.replace(/\//g, path.sep)));
  const uploadRoot = getUploadRoot();

  if (resolved !== uploadRoot && !resolved.startsWith(`${uploadRoot}${path.sep}`)) {
    return null;
  }

  return resolved;
}

export async function deleteStoredUpload(storedUrl: string | null | undefined) {
  const targetPath = resolveStoredUploadPath(storedUrl);
  if (!targetPath) return;

  try {
    await access(targetPath);
    await unlink(targetPath);
  } catch {
    // Ignore missing files on cleanup.
  }
}

export function resolveLocalAssetPath(src: string) {
  const trimmed = src.replace(/^\/+/, '');
  if (trimmed.startsWith('uploads/')) {
    return resolveStoredUploadPath(`/${trimmed}`);
  }

  return path.join(process.cwd(), 'public', trimmed.replace(/\//g, path.sep));
}
