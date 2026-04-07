import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface InboxBriefingProps {
  briefing: string | null;
  isLoading: boolean;
  stats: {
    overdueCount: number;
    todayCount: number;
    suggestionsCount: number;
    totalPending: number;
  };
}

/**
 * Componente React `InboxBriefing`.
 *
 * @param {InboxBriefingProps} { 
  briefing, 
  isLoading,
  stats 
} - Parâmetro `{ 
  briefing, 
  isLoading,
  stats 
}`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export const InboxBriefing: React.FC<InboxBriefingProps> = ({ 
  briefing, 
  isLoading,
  stats 
}) => {
  return (
    <div className="relative mb-8 p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 text-white overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/10 rounded-xl">
            <Sparkles size={20} className="text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Bom dia! 👋</h2>
            <p className="text-sm text-slate-400">Seu briefing diário</p>
          </div>
        </div>

        {/* Briefing content */}
        <div className="mb-6">
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="animate-spin" size={16} />
              <span className="text-sm">Analisando seu dia...</span>
            </div>
          ) : (
            <p className="text-slate-200 leading-relaxed">
              {briefing || 'Vamos começar o dia! Confira suas atividades abaixo.'}
            </p>
          )}
        </div>

        {/* Stats pills */}
        <div className="flex flex-wrap gap-2">
          {stats.overdueCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-300 rounded-full text-sm">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              {stats.overdueCount} atrasado{stats.overdueCount > 1 ? 's' : ''}
            </div>
          )}
          {stats.todayCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-full text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              {stats.todayCount} para hoje
            </div>
          )}
          {stats.suggestionsCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-500/20 text-primary-300 rounded-full text-sm">
              <Sparkles size={14} />
              {stats.suggestionsCount} sugestão{stats.suggestionsCount > 1 ? 'ões' : ''}
            </div>
          )}
          {stats.totalPending === 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-full text-sm">
              ✨ Inbox Zero!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
