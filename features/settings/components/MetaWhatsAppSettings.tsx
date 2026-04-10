'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Save, Loader2, Check, AlertCircle, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

/**
 * Componente React `MetaWhatsAppSettings`.
 * Configurações de conexão com a Meta Cloud API para WhatsApp.
 */
export const MetaWhatsAppSettings: React.FC = () => {
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveResult, setSaveResult] = useState<ConnectionTestResult | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings/meta-whatsapp');
        if (!res.ok) throw new Error('Falha ao carregar configurações');
        const data = await res.json();
        setBusinessAccountId(data.businessAccountId || '');
        setAccessToken(data.accessToken || '');
      } catch (err: any) {
        console.error('Erro ao carregar configurações da Meta:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/settings/meta-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessAccountId: businessAccountId.trim(),
          accessToken: accessToken.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveResult({ ok: false, message: data?.error || 'Erro ao salvar' });
        return;
      }
      setSaveResult({ ok: true, message: 'Configurações salvas com sucesso' });
    } catch (err: any) {
      setSaveResult({ ok: false, message: err?.message || 'Erro ao salvar configurações' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!accessToken.trim()) {
      setTestResult({ ok: false, message: 'Informe o Access Token da Meta' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/meta-whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: accessToken.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ ok: true, message: data.message || 'Conexão bem-sucedida!' });
      } else {
        setTestResult({ ok: false, message: data?.error || 'Erro na conexão' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message || 'Erro ao testar conexão' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Meta Cloud API (WhatsApp)</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure a conexão com a API oficial do WhatsApp via Meta Business
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Meta Business Account ID
          </label>
          <input
            type="text"
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
            placeholder="Ex: 987654321012345"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400"
          />
          <p className="text-xs text-slate-500 mt-1">
            Encontre no{' '}
            <a
              href="https://business.facebook.com/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Business Manager <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Meta Access Token
          </label>
          <div className="relative">
            <input
              type={showAccessToken ? 'text' : 'password'}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Cole seu access token aqui..."
              className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowAccessToken(!showAccessToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showAccessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gere um token temporário no{' '}
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Meta Developers <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        {saveResult && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              saveResult.ok
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}
          >
            {saveResult.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-sm">{saveResult.message}</span>
          </div>
        )}

        {testResult && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              testResult.ok
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}
          >
            {testResult.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-sm">{testResult.message}</span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Configurações
          </button>

          <button
            onClick={handleTestConnection}
            disabled={testing || !accessToken.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 disabled:opacity-50 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Testar Conexão
          </button>
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
            Configuração do Webhook
          </h4>
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
            Após salvar, configure o webhook no seu app da Meta para receber mensagens neste URL:
          </p>
          <code className="block p-3 bg-white dark:bg-black/30 rounded text-xs text-slate-700 dark:text-slate-300 break-all">
            https://seudominio.com/api/whatsapp/webhook
          </code>
        </div>
      </div>
    </div>
  );
};