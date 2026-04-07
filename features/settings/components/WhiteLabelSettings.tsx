'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from 'react';
import { Loader2, Palette, Save, Upload, Wand2 } from 'lucide-react';
import { useBranding } from '@/context/BrandingContext';
import { useToast } from '@/context/ToastContext';
import { slugify } from '@/lib/utils/slugify';
import { getBrandInitials } from '@/lib/branding/defaults';

type FormState = {
  brandName: string;
  legalName: string;
  slug: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  supportPhone: string;
  reservationUrl: string;
  assistantName: string;
  assistantRole: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
};

const DEFAULT_FORM: FormState = {
  brandName: '',
  legalName: '',
  slug: '',
  tagline: '',
  logoUrl: '',
  primaryColor: '#16a34a',
  accentColor: '#0f172a',
  supportEmail: '',
  supportPhone: '',
  reservationUrl: '',
  assistantName: 'Assistente IA',
  assistantRole: 'Assistente comercial',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
};

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo do logo.'));
    reader.readAsDataURL(file);
  });
}

export function WhiteLabelSettings() {
  const { branding, refreshBranding } = useBranding();
  const { addToast } = useToast();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      brandName: branding.brandName,
      legalName: branding.legalName,
      slug: branding.slug,
      tagline: branding.tagline,
      logoUrl: branding.logoUrl,
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
      supportEmail: branding.supportEmail,
      supportPhone: branding.supportPhone,
      reservationUrl: branding.reservationUrl,
      assistantName: branding.assistantName,
      assistantRole: branding.assistantRole,
      ownerName: branding.ownerName,
      ownerEmail: branding.ownerEmail,
      ownerPhone: branding.ownerPhone,
    });
  }, [branding]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      addToast('Use um logo menor que 1.5 MB.', 'error');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      updateField('logoUrl', dataUrl);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Falha ao carregar o logo.', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          slug: slugify(form.slug || form.brandName),
          onboardingCompleted: true,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Falha ao salvar branding (HTTP ${res.status})`);
      }

      await refreshBranding();
      addToast('White-label atualizado com sucesso.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Falha ao salvar white-label.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const initials = getBrandInitials(form.brandName || branding.brandName);

  return (
    <div className="mb-12 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary-500" />
            White-Label
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Defina nome, identidade visual, links e dados operacionais do seu CRM vendável.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 bg-slate-50 dark:bg-black/20">
          {form.logoUrl ? (
            <img src={form.logoUrl} alt={form.brandName} className="w-12 h-12 rounded-2xl object-cover" />
          ) : (
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-semibold"
              style={{ background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor})` }}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 dark:text-white truncate">{form.brandName || 'Seu CRM'}</div>
            <div className="text-xs text-slate-500 truncate">{form.slug || 'slug-do-projeto'}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome comercial</span>
          <input value={form.brandName} onChange={(e) => updateField('brandName', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="Seu CRM" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Razão social</span>
          <input value={form.legalName} onChange={(e) => updateField('legalName', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="Empresa dona do white-label" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Slug</span>
          <input value={form.slug} onChange={(e) => updateField('slug', slugify(e.target.value))} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="nosso-crm" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tagline</span>
          <input value={form.tagline} onChange={(e) => updateField('tagline', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="CRM com WhatsApp, IA e operação comercial" />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Logo</span>
          <div className="flex flex-col gap-3 md:flex-row">
            <input value={form.logoUrl} onChange={(e) => updateField('logoUrl', e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="Cole uma URL ou envie um arquivo" />
            <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5">
              <Upload className="w-4 h-4" />
              Enviar logo
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </label>
          </div>
        </label>
        <div className="grid grid-cols-2 gap-4 md:col-span-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cor principal</span>
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20">
              <Palette className="w-4 h-4 text-slate-400" />
              <input type="color" value={form.primaryColor} onChange={(e) => updateField('primaryColor', e.target.value)} />
              <span className="text-sm text-slate-600 dark:text-slate-300">{form.primaryColor}</span>
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cor de apoio</span>
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20">
              <Palette className="w-4 h-4 text-slate-400" />
              <input type="color" value={form.accentColor} onChange={(e) => updateField('accentColor', e.target.value)} />
              <span className="text-sm text-slate-600 dark:text-slate-300">{form.accentColor}</span>
            </div>
          </label>
        </div>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">E-mail de suporte</span>
          <input value={form.supportEmail} onChange={(e) => updateField('supportEmail', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="suporte@seudominio.com" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Telefone de suporte</span>
          <input value={form.supportPhone} onChange={(e) => updateField('supportPhone', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="+55 11 99999-9999" />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Link de reservas</span>
          <input value={form.reservationUrl} onChange={(e) => updateField('reservationUrl', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="https://reservas.seudominio.com" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome da I.A.</span>
          <input value={form.assistantName} onChange={(e) => updateField('assistantName', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="Assistente IA" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Função da I.A.</span>
          <input value={form.assistantRole} onChange={(e) => updateField('assistantRole', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="Assistente comercial" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome do dono</span>
          <input value={form.ownerName} onChange={(e) => updateField('ownerName', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="Nome do responsável" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">E-mail do dono</span>
          <input value={form.ownerEmail} onChange={(e) => updateField('ownerEmail', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="admin@seudominio.com" />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Telefone do dono</span>
          <input value={form.ownerPhone} onChange={(e) => updateField('ownerPhone', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" placeholder="+55 11 98888-7777" />
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-500 transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar white-label
        </button>
      </div>
    </div>
  );
}
