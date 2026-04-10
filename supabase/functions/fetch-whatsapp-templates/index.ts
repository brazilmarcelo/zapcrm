import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Buscar organization
    const { data: settings, error: settingsError } = await supabase
      .from('organization_settings')
      .select('meta_business_account_id, meta_access_token_encrypted')
      .limit(1)
      .single()

    if (settingsError || !settings?.meta_business_account_id) {
      return new Response(
        JSON.stringify({ error: 'Meta not configured' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Buscar templates da Meta
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${settings.meta_business_account_id}/message_templates`,
      {
        headers: {
          'Authorization': `Bearer ${settings.meta_access_token_encrypted}`,
        },
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch templates', details: data }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const templates = data?.data || []

    // Salvar templates no banco
    for (const template of templates) {
      if (template.status === 'APPROVED') {
        await supabase.from('whatsapp_templates').upsert({
          organization_id: settings.organization_id,
          meta_template_id: template.id,
          name: template.name,
          language: template.language,
          category: template.category,
          status: template.status,
          content: { components: template.components },
          components: template.components,
        }, {
          onConflict: 'organization_id,meta_template_id'
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        count: templates.filter(t => t.status === 'APPROVED').length 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})