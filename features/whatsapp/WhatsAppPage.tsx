'use client';

import { useEffect, useState } from 'react';
import { ConversationList } from './components/ConversationList';
import { MessageThread } from './components/MessageThread';
import { WhatsAppSetup } from './components/WhatsAppSetup';
import { WhatsAppAISettings } from './components/WhatsAppAISettings';
import { IntelligencePanel } from './components/IntelligencePanel';
import { useStartWhatsAppConversation, useWhatsAppInstances } from '@/lib/query/whatsapp';
import type { WhatsAppConversation } from '@/types/whatsapp';
import {
  ArrowLeft,
  Bot,
  Brain,
  Loader2,
  MessageSquare,
  PhoneCall,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import { useBranding } from '@/context/BrandingContext';

type Tab = 'chat' | 'settings' | 'ai';

export function WhatsAppPage() {
  const { data: instances, isLoading, error } = useWhatsAppInstances();
  const { branding } = useBranding();
  const [tab, setTab] = useState<Tab>('chat');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [showIntelligence, setShowIntelligence] = useState(true);
  const [showNewConversation, setShowNewConversation] = useState(false);

  useEffect(() => {
    if (!instances || instances.length === 0) return;
    if (selectedInstanceId && instances.some((instance) => instance.id === selectedInstanceId)) return;

    const preferred = instances.find((instance) => instance.status === 'connected') || instances[0];
    setSelectedInstanceId(preferred?.id || null);
  }, [instances, selectedInstanceId]);

  useEffect(() => {
    if (selectedConversation && selectedConversation.instance_id !== selectedInstanceId) {
      setSelectedConversation(null);
    }
  }, [selectedConversation, selectedInstanceId]);

  const hasInstances = Boolean(instances && instances.length > 0);
  const selectedInstance = instances?.find((instance) => instance.id === selectedInstanceId) || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    const isTableMissing =
      error.message?.includes('whatsapp_instances') ||
      error.message?.includes('relation') ||
      error.message?.includes('42P01');
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            {isTableMissing ? 'Configuração pendente' : 'Erro ao carregar'}
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            {isTableMissing
              ? 'As tabelas do WhatsApp ainda não foram criadas no banco de dados. Execute a migration do Supabase para habilitar esse módulo.'
              : `Não foi possível carregar as instâncias do WhatsApp: ${error.message}`}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!hasInstances) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-green-500/10">
                <MessageSquare className="w-6 h-6 text-green-500" />
              </div>
              WhatsApp
            </h1>
            <p className="text-slate-500 mt-2">
              Conecte o WhatsApp do seu white-label para gerenciar conversas e ativar o agente de I.A.
            </p>
          </div>
          <WhatsAppSetup />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-white/10">
        <TabButton active={tab === 'chat'} onClick={() => setTab('chat')} icon={MessageSquare} label="Conversas" />
        <TabButton active={tab === 'ai'} onClick={() => setTab('ai')} icon={Bot} label="Agente I.A." />
        <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon={Settings} label="Conexão" />
      </div>

      {tab === 'settings' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto">
            <WhatsAppSetup />
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto">
            <WhatsAppAISettings />
          </div>
        </div>
      )}

      {tab === 'chat' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex flex-col gap-3 px-4 py-3 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{branding.brandName} WhatsApp</div>
              <div className="text-xs text-slate-500">
                Navegue entre instâncias, sincronize chats e crie conversas por conta.
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedInstanceId || ''}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-bg text-sm text-slate-900 dark:text-white"
              >
                {instances?.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name} {instance.phone ? `· ${instance.phone}` : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowNewConversation(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova conversa
              </button>
            </div>
          </div>

          <div className="flex-1 flex min-h-0">
            <div className={`w-80 shrink-0 ${selectedConversation ? 'hidden lg:flex lg:flex-col' : 'flex flex-col flex-1 lg:flex-none'}`}>
              <ConversationList
                selectedId={selectedConversation?.id}
                onSelect={(conversation) => setSelectedConversation(conversation)}
                instanceId={selectedInstanceId || undefined}
              />
            </div>

            <div className={`flex-1 min-w-0 ${selectedConversation ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}`}>
              {selectedConversation ? (
                <>
                  <div className="lg:hidden">
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-primary-500 hover:bg-primary-500/5 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Voltar
                    </button>
                  </div>
                  <MessageThread
                    conversation={selectedConversation}
                    onToggleIntelligence={() => setShowIntelligence((current) => !current)}
                    showIntelligenceActive={showIntelligence}
                  />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-sm px-6">
                    <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-10 h-10 text-green-500/50" />
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {branding.brandName} WhatsApp
                    </h3>
                    <p className="text-sm text-slate-500">
                      {selectedInstance
                        ? `Selecione uma conversa da instância ${selectedInstance.name}.`
                        : 'Selecione uma instância para começar.'}
                    </p>
                    {selectedInstance?.status !== 'connected' && (
                      <p className="text-xs text-amber-500 mt-3">
                        Esta instância ainda não está conectada. Vá para a aba &quot;Conexão&quot; para escanear o QR code.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedConversation && showIntelligence && (
              <div className="hidden xl:flex w-72 shrink-0">
                <IntelligencePanel conversation={selectedConversation} />
              </div>
            )}
          </div>
        </div>
      )}

      {showNewConversation && selectedInstanceId && (
        <NewConversationModal
          defaultInstanceId={selectedInstanceId}
          instances={instances || []}
          onClose={() => setShowNewConversation(false)}
          onCreated={(conversation) => {
            setSelectedInstanceId(conversation.instance_id);
            setSelectedConversation(conversation);
            setShowNewConversation(false);
          }}
        />
      )}
    </div>
  );
}

function NewConversationModal({
  defaultInstanceId,
  instances,
  onClose,
  onCreated,
}: {
  defaultInstanceId: string;
  instances: Array<{ id: string; name: string; phone?: string }>;
  onClose: () => void;
  onCreated: (conversation: WhatsAppConversation) => void;
}) {
  const startConversation = useStartWhatsAppConversation();
  const [instanceId, setInstanceId] = useState(defaultInstanceId);
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const conversation = await startConversation.mutateAsync({
      instanceId,
      phone,
      contactName: contactName.trim() || undefined,
    });
    onCreated(conversation);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Nova conversa</h3>
            <p className="text-sm text-slate-500">Escolha a instância e o telefone para abrir um novo chat.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="space-y-1.5 block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Instância</span>
            <select
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-white"
            >
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.name} {instance.phone ? `· ${instance.phone}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome do contato</span>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-white"
              placeholder="Ex: Número 1"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Telefone</span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-dark-bg px-4">
              <PhoneCall className="w-4 h-4 text-slate-400" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full py-2.5 bg-transparent text-slate-900 dark:text-white outline-none"
                placeholder="+55 11 99999-9999"
              />
            </div>
          </label>

          {startConversation.error && (
            <p className="text-sm text-red-500">{startConversation.error.message}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={startConversation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 disabled:opacity-60"
            >
              {startConversation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar conversa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
          : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
