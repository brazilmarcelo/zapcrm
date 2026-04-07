import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { normalizePhoneE164, toWhatsAppPhone } from '@/lib/phone';
import { getInstance, getOrCreateConversation, updateConversation } from '@/lib/supabase/whatsapp';

const StartConversationSchema = z.object({
  instanceId: z.string().uuid(),
  phone: z.string().min(8).max(40),
  contactName: z.string().min(1).max(160).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = StartConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const phoneDigits = toWhatsAppPhone(parsed.data.phone);
  const phoneE164 = normalizePhoneE164(parsed.data.phone);

  if (!phoneDigits || phoneDigits.length < 10) {
    return NextResponse.json({ error: 'Telefone inválido para WhatsApp.' }, { status: 400 });
  }

  const instance = await getInstance(supabase, parsed.data.instanceId);
  if (!instance || instance.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  let contact = null as null | { id: string; name: string; avatar: string | null; phone: string | null };

  if (phoneE164) {
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, name, avatar, phone')
      .eq('organization_id', profile.organization_id)
      .eq('phone', phoneE164)
      .maybeSingle();

    contact = existingContact;
  }

  if (!contact) {
    const displayName = parsed.data.contactName?.trim() || phoneDigits;
    const { data: newContact, error: createContactError } = await supabase
      .from('contacts')
      .insert({
        organization_id: profile.organization_id,
        name: displayName,
        phone: phoneE164 || `+${phoneDigits}`,
        status: 'ACTIVE',
        stage: 'LEAD',
        owner_id: user.id,
      })
      .select('id, name, avatar, phone')
      .single();

    if (createContactError || !newContact) {
      return NextResponse.json({ error: createContactError?.message || 'Failed to create contact' }, { status: 500 });
    }

    contact = newContact;
  }

  const conversation = await getOrCreateConversation(
    supabase,
    profile.organization_id,
    parsed.data.instanceId,
    phoneDigits,
    parsed.data.contactName?.trim() || contact.name,
    contact.avatar || undefined,
    false,
  );

  await updateConversation(supabase, conversation.id, {
    contact_id: contact.id,
    contact_name: parsed.data.contactName?.trim() || contact.name,
    contact_photo: contact.avatar || conversation.contact_photo,
  });

  return NextResponse.json({
    data: {
      ...conversation,
      contact_id: contact.id,
      contact_name: parsed.data.contactName?.trim() || contact.name,
      contact_photo: contact.avatar || conversation.contact_photo,
    },
  }, { status: 201 });
}
