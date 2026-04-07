/**
 * @fileoverview Hook de Timeout por Inatividade
 * 
 * Hook de segurança que automaticamente faz logout do usuário
 * após período de inatividade, protegendo contra sessões abandonadas.
 * 
 * @module hooks/useIdleTimeout
 * 
 * Funcionalidades:
 * - Detecção de atividade (mouse, teclado, scroll, touch)
 * - Alerta antes do logout automático
 * - Verificação ao retornar à aba
 * - Persistência do motivo de logout
 * 
 * @example
 * ```tsx
 * function App() {
 *   useIdleTimeout({
 *     timeout: 30 * 60 * 1000, // 30 minutos
 *     warningTime: 5 * 60 * 1000, // Aviso 5 min antes
 *     onWarning: () => toast.warning('Sessão expirando...'),
 *     onTimeout: () => toast.info('Sessão expirada'),
 *   });
 *   
 *   return <MainApp />;
 * }
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

/**
 * Opções de configuração do hook de idle timeout
 * 
 * @interface UseIdleTimeoutOptions
 * @property {number} [timeout=1800000] - Tempo em ms até logout (padrão: 30 min)
 * @property {number} [warningTime=300000] - Tempo em ms antes do logout para aviso (padrão: 5 min)
 * @property {() => void} [onWarning] - Callback ao exibir aviso
 * @property {() => void} [onTimeout] - Callback antes do logout
 * @property {string[]} [events] - Eventos DOM que resetam o timer
 * @property {boolean} [enabled=true] - Se o hook está ativo
 */
interface UseIdleTimeoutOptions {
  timeout?: number;
  warningTime?: number;
  onWarning?: () => void;
  onTimeout?: () => void;
  events?: string[];
  enabled?: boolean;
}

/** Timeout padrão: 30 minutos */
const DEFAULT_TIMEOUT = 30 * 60 * 1000;
/** Tempo de aviso padrão: 5 minutos antes */
const DEFAULT_WARNING_TIME = 5 * 60 * 1000;
/** Eventos padrão que indicam atividade */
const DEFAULT_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'focus',
];

/**
 * Hook para logout automático por inatividade
 * 
 * Monitora atividade do usuário e executa logout automático após
 * período configurado sem interação. Inclui aviso prévio opcional.
 * 
 * @param {UseIdleTimeoutOptions} options - Configurações do timeout
 * @returns {Object} Funções de controle do timer
 * @returns {() => void} return.resetTimer - Reseta manualmente o timer
 * @returns {() => number} return.getRemainingTime - Retorna tempo restante em ms
 * @returns {() => boolean} return.isWarningShown - Se o aviso foi exibido
 * @returns {() => Promise<void>} return.forceLogout - Força logout imediato
 * 
 * @example
 * ```tsx
 * function IdleWarningModal() {
 *   const [showWarning, setShowWarning] = useState(false);
 *   
 *   const { resetTimer, getRemainingTime } = useIdleTimeout({
 *     onWarning: () => setShowWarning(true),
 *   });
 *   
 *   return showWarning ? (
 *     <Modal>
 *       <p>Sessão expira em {Math.floor(getRemainingTime() / 1000)}s</p>
 *       <button onClick={() => { resetTimer(); setShowWarning(false); }}>
 *         Continuar
 *       </button>
 *     </Modal>
 *   ) : null;
 * }
 * ```
 */
export function useIdleTimeout(options: UseIdleTimeoutOptions = {}) {
  const {
    timeout = DEFAULT_TIMEOUT,
    warningTime = DEFAULT_WARNING_TIME,
    onWarning,
    onTimeout,
    events = DEFAULT_EVENTS,
    enabled = true,
  } = options;

  const { signOut } = useAuth();
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const warningIdRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    if (warningIdRef.current) {
      clearTimeout(warningIdRef.current);
      warningIdRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    onTimeout?.();
    
    // Store message for login page
    sessionStorage.setItem('logoutReason', 'idle');
    
    await signOut();
  }, [signOut, onTimeout]);

  const handleWarning = useCallback(() => {
    if (!warningShownRef.current) {
      warningShownRef.current = true;
      onWarning?.();
    }
  }, [onWarning]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    lastActivityRef.current = Date.now();
    warningShownRef.current = false;
    clearTimers();

    // Set warning timer
    if (onWarning && warningTime > 0 && warningTime < timeout) {
      warningIdRef.current = setTimeout(handleWarning, timeout - warningTime);
    }

    // Set logout timer
    timeoutIdRef.current = setTimeout(handleLogout, timeout);
  }, [enabled, timeout, warningTime, onWarning, handleWarning, handleLogout, clearTimers]);

  // Setup event listeners
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    // Initial timer setup
    resetTimer();

    // Add event listeners
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Also reset on visibility change (user comes back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if we've been away too long
        const now = Date.now();
        const elapsed = now - lastActivityRef.current;
        
        if (elapsed >= timeout) {
          handleLogout();
        } else if (elapsed >= timeout - warningTime) {
          handleWarning();
        } else {
          resetTimer();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      clearTimers();
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, events, resetTimer, timeout, warningTime, handleLogout, handleWarning, clearTimers]);

  // Return functions to manually control the timer
  return {
    /** Reset the idle timer (call on user activity) */
    resetTimer,
    /** Get time remaining before logout (in ms) */
    getRemainingTime: () => {
      const elapsed = Date.now() - lastActivityRef.current;
      return Math.max(0, timeout - elapsed);
    },
    /** Check if warning has been shown */
    isWarningShown: () => warningShownRef.current,
    /** Force immediate logout */
    forceLogout: handleLogout,
  };
}

export default useIdleTimeout;
