import { NextResponse } from 'next/server';
import { getPublicApiOpenApiDocument } from '@/lib/public-api/openapi';

export const runtime = 'nodejs';

export async function GET() {
  const doc = getPublicApiOpenApiDocument();
  return NextResponse.json(doc, {
    headers: {
      // Cache lightly; keep it fresh during rollout.
      'Cache-Control': 'public, max-age=60',
    },
  });
}

