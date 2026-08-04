export const dynamic = 'force-dynamic';

import { POST as postOlahanTemplate } from '@/app/api/olahan/template/route';

export async function POST(request: Request) {
  return postOlahanTemplate(request);
}
