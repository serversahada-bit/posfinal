export const dynamic = 'force-dynamic';

import { GET as getOlahan } from '@/app/api/olahan/route';

export async function GET(request: Request) {
  return getOlahan(request);
}
