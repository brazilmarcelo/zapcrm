import React from 'react';
import { Check } from 'lucide-react';

/**
 * Componente React `InboxZeroState`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export const InboxZeroState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-500/30">
        <Check size={48} className="text-white" />
      </div>
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Inbox Zero! 🎉
      </h2>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
        Você zerou tudo. Aproveite o momento ou planeje o futuro.
      </p>
    </div>
  );
};

