import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { normalizeText } from '@/lib/public-api/sanitize';

export const runtime = 'nodejs';

const ProductUpsertSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  price: z.number().optional(),
  sku: z.string().optional(),
  active: z.boolean().optional(),
}).strict();

export async function GET(request: Request) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const active = url.searchParams.get('active');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const sb = createStaticAdminClient();
  let query = sb
    .from('products')
    .select('id,name,description,price,sku,active,created_at,updated_at', { count: 'exact' })
    .eq('organization_id', auth.organizationId);

  if (active !== null) {
    query = query.eq('active', active === 'true');
  }

  if (q) {
    const normalizedQ = normalizeText(q);
    query = query.or(`name.ilike.%${normalizedQ}%,description.ilike.%${normalizedQ}%,sku.ilike.%${normalizedQ}%`);
  }

  const { data, count, error } = await query
    .order('name')
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });

  const total = count ?? 0;
  const nextOffset = offset + limit;
  const hasMore = nextOffset < total;

  return NextResponse.json({
    data: (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      price: p.price != null ? Number(p.price) : null,
      sku: p.sku ?? null,
      active: p.active,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
    pagination: {
      total,
      offset,
      limit,
      hasMore,
    },
  });
}

export async function POST(request: Request) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = ProductUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  if (!parsed.data.name) {
    return NextResponse.json({ error: 'Name is required', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from('products')
    .insert({
      organization_id: auth.organizationId,
      name: normalizeText(parsed.data.name),
      description: parsed.data.description ? normalizeText(parsed.data.description) : null,
      price: parsed.data.price ?? 0,
      sku: parsed.data.sku ? normalizeText(parsed.data.sku) : null,
      active: parsed.data.active ?? true,
      created_at: now,
      updated_at: now,
    })
    .select('id,name,description,price,sku,active,created_at,updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}