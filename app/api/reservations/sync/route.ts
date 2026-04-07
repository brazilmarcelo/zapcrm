/**
 * Sync reservations from tenant-linked reservation apps into CRM contacts.
 *
 * GET/POST /api/reservations/sync
 *
 * Can be triggered by an authenticated tenant admin or by Vercel Cron
 * using `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { normalizePhoneE164 } from '@/lib/phone';
import { createClient as createExternalSupabaseClient } from '@supabase/supabase-js';

export const maxDuration = 60;

type SyncTarget = {
  organization_id: string;
  reservation_supabase_url: string;
  reservation_supabase_key: string;
};

type SyncResult = {
  organizationId: string;
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  totalReservations: number;
};

function mergeReservationTag(existingNotes: string | null | undefined, reservationTag: string) {
  const notes = String(existingNotes || '').trim();
  if (!notes) return reservationTag;
  if (notes.includes(reservationTag)) return notes;
  return `${notes}\n${reservationTag}`;
}

async function getSyncTargets(request: Request): Promise<
  | { ok: true; targets: SyncTarget[] }
  | { ok: false; response: NextResponse<{ error: string }> }
> {
  const admin = createStaticAdminClient();
  const url = new URL(request.url);
  const requestedOrganizationId = url.searchParams.get('organizationId')?.trim() || '';
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    let query = admin
      .from('organization_settings')
      .select(
        'organization_id, reservation_supabase_url, reservation_supabase_key, reservation_integration_enabled',
      )
      .eq('reservation_integration_enabled', true);

    if (requestedOrganizationId) {
      query = query.eq('organization_id', requestedOrganizationId);
    }

    const { data, error } = await query;
    if (error) {
      return {
        ok: false,
        response: NextResponse.json({ error: error.message }, { status: 500 }),
      };
    }

    return {
      ok: true,
      targets: (data || []).filter(
        (item) => item.reservation_supabase_url && item.reservation_supabase_key,
      ) as SyncTarget[],
    };
  }

  const appSupabase = await createClient();
  const {
    data: { user },
  } = await appSupabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await appSupabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id || profile.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  const { data: settings, error: settingsError } = await admin
    .from('organization_settings')
    .select(
      'organization_id, reservation_supabase_url, reservation_supabase_key, reservation_integration_enabled',
    )
    .eq('organization_id', profile.organization_id)
    .eq('reservation_integration_enabled', true)
    .maybeSingle();

  if (settingsError) {
    return {
      ok: false,
      response: NextResponse.json({ error: settingsError.message }, { status: 500 }),
    };
  }

  if (!settings?.reservation_supabase_url || !settings?.reservation_supabase_key) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No reservation credentials' }, { status: 400 }),
    };
  }

  return {
    ok: true,
    targets: [
      {
        organization_id: settings.organization_id,
        reservation_supabase_url: settings.reservation_supabase_url,
        reservation_supabase_key: settings.reservation_supabase_key,
      },
    ],
  };
}

async function syncReservationsForOrganization(
  supabase: ReturnType<typeof createStaticAdminClient>,
  target: SyncTarget,
): Promise<SyncResult> {
  const reservationSupabase = createExternalSupabaseClient(
    target.reservation_supabase_url,
    target.reservation_supabase_key,
  );

  const { data: reservations, error: resErr } = await reservationSupabase
    .from('reservations')
    .select('*, customers(name, phone, email), units(name, slug)')
    .in('status', ['confirmed', 'pending', 'seated'])
    .order('created_at', { ascending: false })
    .limit(100);

  if (resErr) throw resErr;
  if (!reservations || reservations.length === 0) {
    return {
      organizationId: target.organization_id,
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      totalReservations: 0,
    };
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const reservation of reservations) {
    const customer = reservation.customers as {
      name: string;
      phone: string;
      email: string | null;
    } | null;
    const unit = reservation.units as { name: string; slug: string } | null;

    if (!customer?.phone) {
      skipped++;
      continue;
    }

    const phone = normalizePhoneE164(customer.phone);
    if (!phone) {
      skipped++;
      continue;
    }

    const phoneLast8 = phone.replace(/\D/g, '').slice(-8);
    const reservationTag = `[RESERVA:${reservation.confirmation_code}|${reservation.reservation_date}|${(reservation.reservation_time || '').substring(0, 5)}|${reservation.pax}|${unit?.name || ''}|${reservation.status}]`;

    let existingContact:
      | { id: string; phone: string | null; email: string | null; notes: string | null }
      | null;

    const { data: exactContact } = await supabase
      .from('contacts')
      .select('id, phone, email, notes')
      .eq('organization_id', target.organization_id)
      .eq('phone', phone)
      .limit(1)
      .maybeSingle();

    existingContact = exactContact;

    if (!existingContact && phoneLast8) {
      const { data: fallbackContact } = await supabase
        .from('contacts')
        .select('id, phone, email, notes')
        .eq('organization_id', target.organization_id)
        .or(`phone.like.%${phoneLast8}%`)
        .limit(1)
        .maybeSingle();
      existingContact = fallbackContact;
    }

    let contactId: string;

    if (existingContact?.id) {
      contactId = existingContact.id;

      await supabase
        .from('contacts')
        .update({
          temperature: 'warm',
          stage: 'CUSTOMER',
          last_interaction: new Date().toISOString(),
          notes: mergeReservationTag(existingContact.notes, reservationTag),
          ...(customer.email && !existingContact.email ? { email: customer.email } : {}),
        })
        .eq('id', contactId);

      updated++;
    } else {
      const { data: newContact, error: createErr } = await supabase
        .from('contacts')
        .insert({
          organization_id: target.organization_id,
          name: customer.name || 'Cliente Reserva',
          phone,
          email: customer.email || null,
          status: 'ACTIVE',
          stage: 'CUSTOMER',
          source: 'WEBSITE',
          temperature: 'warm',
          notes: reservationTag,
        })
        .select('id')
        .single();

      if (createErr || !newContact) {
        console.error('[reservation-sync] Failed to create contact:', createErr);
        skipped++;
        continue;
      }

      contactId = newContact.id;
      created++;
    }

    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('contact_id', contactId)
      .limit(1)
      .maybeSingle();

    if (conversation) {
      const memoryKey = `reserva_${reservation.confirmation_code}`;
      const memoryValue = `Reserva ${reservation.confirmation_code}: ${reservation.reservation_date} às ${reservation.reservation_time}, ${reservation.pax} pessoas na ${unit?.name || 'unidade'} (status: ${reservation.status})`;

      await supabase.from('whatsapp_chat_memories').upsert(
        {
          conversation_id: conversation.id,
          organization_id: target.organization_id,
          contact_id: contactId,
          memory_type: 'fact',
          key: memoryKey,
          value: memoryValue,
          confidence: 1.0,
          source_message_id: null,
        },
        {
          onConflict: 'conversation_id,key',
        },
      );
    }

    const activityTitle = `Reserva ${reservation.confirmation_code} - ${unit?.name || ''}`;
    const activityDesc = `Data: ${reservation.reservation_date} às ${reservation.reservation_time}\nPessoas: ${reservation.pax}\nStatus: ${reservation.status}\nCódigo: ${reservation.confirmation_code}`;

    const { data: existingActivity } = await supabase
      .from('activities')
      .select('id')
      .eq('contact_id', contactId)
      .like('title', `%${reservation.confirmation_code}%`)
      .limit(1);

    if (!existingActivity || existingActivity.length === 0) {
      await supabase.from('activities').insert({
        organization_id: target.organization_id,
        contact_id: contactId,
        title: activityTitle,
        description: activityDesc,
        type: 'note',
        date: reservation.created_at || new Date().toISOString(),
        completed: reservation.status !== 'confirmed' && reservation.status !== 'pending',
      });
    }
  }

  return {
    organizationId: target.organization_id,
    synced: created + updated,
    created,
    updated,
    skipped,
    totalReservations: reservations.length,
  };
}

async function handleSyncRequest(request: Request) {
  const targetResult = await getSyncTargets(request);
  if (!targetResult.ok) return targetResult.response;

  if (targetResult.targets.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, targets: [] });
  }

  const supabase = createStaticAdminClient();

  try {
    const results: SyncResult[] = [];

    for (const target of targetResult.targets) {
      results.push(await syncReservationsForOrganization(supabase, target));
    }

    return NextResponse.json({
      ok: true,
      synced: results.reduce((sum, item) => sum + item.synced, 0),
      created: results.reduce((sum, item) => sum + item.created, 0),
      updated: results.reduce((sum, item) => sum + item.updated, 0),
      skipped: results.reduce((sum, item) => sum + item.skipped, 0),
      total_reservations: results.reduce((sum, item) => sum + item.totalReservations, 0),
      targets: results,
    });
  } catch (err) {
    console.error('[reservation-sync] Error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleSyncRequest(request);
}

export async function POST(request: Request) {
  return handleSyncRequest(request);
}
