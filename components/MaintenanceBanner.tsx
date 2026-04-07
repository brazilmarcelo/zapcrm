/**
 * MaintenanceBanner Component
 * T007: Displays a banner about AI features being temporarily disabled
 * 
 * Usage: Import and render at top of App layout
 */
import React from 'react';

interface MaintenanceBannerProps {
  /** Whether to show the banner */
  show?: boolean;
  /** Custom message to display */
  message?: string;
  /** Callback when user dismisses the banner */
  onDismiss?: () => void;
}

/**
 * Componente React `MaintenanceBanner`.
 *
 * @param {MaintenanceBannerProps} {
  show = true,
  message = '🔒 Funcionalidades de IA temporariamente desativadas para atualizações de segurança. Voltarão em breve.',
  onDismiss,
} - Parâmetro `{
  show = true,
  message = '🔒 Funcionalidades de IA temporariamente desativadas para atualizações de segurança. Voltarão em breve.',
  onDismiss,
}`.
 * @returns {Element | null} Retorna um valor do tipo `Element | null`.
 */
export const MaintenanceBanner: React.FC<MaintenanceBannerProps> = ({
  show = true,
  message = '🔒 Funcionalidades de IA temporariamente desativadas para atualizações de segurança. Voltarão em breve.',
  onDismiss,
}) => {
  const [dismissed, setDismissed] = React.useState(false);
  
  if (!show || dismissed) return null;
  
  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };
  
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-800 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center flex-1">
          {message}
        </p>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 text-sm font-medium"
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default MaintenanceBanner;
