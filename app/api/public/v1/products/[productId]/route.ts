import { NextResponse } from 'next/server';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { sanitizeUUID } from '@/lib/supabase/utils';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { productId } = await params;
  const id = sanitizeUUID(productId);
  if (!id) {
    return NextResponse.json({ error: 'Invalid product ID', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('products')
    .select('id,name,description,price,sku,active,created_at,updated_at')
    .eq('organization_id', auth.organizationId)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Product not found', code: 'NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      id: data.id,
      name: data.name,
      description: data.description ?? null,
      price: data.price != null ? Number(data.price) : null,
      sku: data.sku ?? null,
      active: data.active,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { productId } = await params;
  const id = sanitizeUUID(productId);
  if (!id) {
    return NextResponse.json({ error: 'Invalid product ID', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

  if (typeof body.name === 'string') updateData.name = body.name;
  if (typeof body.description === 'string') updateData.description = body.description;
  if (typeof body.price === 'number') updateData.price = body.price;
  if (typeof body.sku === 'string') updateData.sku = body.sku;
  if (typeof body.active === 'boolean') updateData.active = body.active;

  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('products')
    .update(updateData)
    .eq('organization_id', auth.organizationId)
    .eq('id', id)
    .select('id,name,description,price,sku,active,created_at,updated_at')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Product not found', code: 'NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { productId } = await params;
  const id = sanitizeUUID(productId);
  if (!id) {
    return NextResponse.json({ error: 'Invalid product ID', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();
  const { error } = await sb
    .from('products')
    .delete()
    .eq('organization_id', auth.organizationId)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });

  return NextResponse.json({ success: true });
}