'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, User, Rocket, Database, Eye, EyeOff } from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import { validateInstallerPassword } from '@/lib/installer/passwordPolicy';
import { slugify } from '@/lib/utils/slugify';

type InstallerMeta = { enabled: boolean; requiresToken: boolean };

const STORAGE_TOKEN = 'crm_install_token';
const STORAGE_PROJECT = 'crm_install_project';
const STORAGE_INSTALLER_TOKEN = 'crm_install_installer_token';
const STORAGE_USER_NAME = 'crm_install_user_name';
const STORAGE_USER_EMAIL = 'crm_install_user_email';
const STORAGE_USER_PASS_HASH = 'crm_install_user_pass_hash';
const STORAGE_BRAND_NAME = 'crm_install_brand_name';
const STORAGE_BRAND_SLUG = 'crm_install_brand_slug';
const STORAGE_BRAND_LOGO = 'crm_install_brand_logo';
const STORAGE_SESSION_LOCKED = 'crm_install_session_locked';

function generateStrongPassword(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=';
  const bytes = new Uint8Array(Math.max(12, Math.min(64, length)));
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_crm_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

type Screen = 'identity' | 'vercel' | 'supabase' | 'validating' | 'ready' | 'locked';

// Configuração de cada tela
const SCREENS = {
  identity: {
    badge: 'Capítulo 1',
    title: 'Quem lidera esta operação?',
    subtitle: 'Vamos definir a marca do seu white-label e a conta principal de administração.',
    icon: User,
    gradient: 'from-violet-500/20 to-fuchsia-500/20',
    accentColor: 'violet',
  },
  vercel: {
    badge: 'Capítulo 2',
    title: 'Sistema de Deploy',
    subtitle: 'Conecte com a Vercel para preparar sua nave.',
    icon: Rocket,
    gradient: 'from-cyan-500/20 to-blue-500/20',
    accentColor: 'cyan',
  },
  supabase: {
    badge: 'Capítulo 3',
    title: 'Base de Dados',
    subtitle: 'Conecte com o Supabase para armazenar suas descobertas.',
    icon: Database,
    gradient: 'from-emerald-500/20 to-teal-500/20',
    accentColor: 'emerald',
  },
} as const;

export default function InstallStartPage() {
  const router = useRouter();
  
  const [meta, setMeta] = useState<InstallerMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [unlockingInstaller, setUnlockingInstaller] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('identity');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Identity
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brandSlug, setBrandSlug] = useState('');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  
  // Tokens
  const [installerToken, setInstallerToken] = useState('');
  const [vercelToken, setVercelToken] = useState('');
  const [supabaseToken, setSupabaseToken] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const mxSpring = useSpring(mx, { stiffness: 80, damping: 30, mass: 1 });
  const mySpring = useSpring(my, { stiffness: 80, damping: 30, mass: 1 });
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - rect.left) / rect.width - 0.5) * 30);
    my.set(((e.clientY - rect.top) / rect.height - 0.5) * 20);
  };
  
  const firstName = userName.split(' ')[0] || '';

  const passwordChecks = (() => {
    const p = String(userPassword || '');
    return {
      minLen: p.length >= 8,
      hasLetter: /[A-Za-z]/.test(p),
      hasNumber: /\d/.test(p),
    };
  })();
  
  // Verifica se a instância já está inicializada (bloqueia acesso após instalação)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/installer/check-initialized', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && data?.initialized === true) {
          // Instância já inicializada: redireciona para dashboard
          router.replace('/dashboard');
          return;
        }
      } catch (err) {
        // Fail-safe: em caso de erro, não bloqueia o acesso ao wizard
        console.warn('[start] Error checking initialization:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Carrega meta do instalador
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/installer/meta?t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setMeta(data);

        // Se o instalador estiver desabilitado, tenta auto-unlock (experiência mágica)
        if (!cancelled && data && data.enabled === false) {
          const savedToken = localStorage.getItem(STORAGE_TOKEN);
          const savedProject = localStorage.getItem(STORAGE_PROJECT);
          if (savedToken && savedProject) {
            try {
              const p = JSON.parse(savedProject) as { id: string; teamId?: string };
              console.warn('[start] Installer disabled. Attempting auto-unlock...');
              if (!cancelled) { setUnlockingInstaller(true); setUnlockError(null); }
              const unlockRes = await fetch('/api/installer/unlock', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  vercel: { token: savedToken.trim(), projectId: p.id, teamId: p.teamId },
                }),
              });
              const unlockData = await unlockRes.json().catch(() => null);
              if (!unlockRes.ok) throw new Error(unlockData?.error || 'Falha ao destravar instalador');

              const res2 = await fetch(`/api/installer/meta?t=${Date.now()}`, { cache: 'no-store' });
              const data2 = await res2.json();
              if (!cancelled) setMeta(data2);
            } catch (unlockErr) {
              console.error('[start] Auto-unlock failed:', unlockErr);
              if (!cancelled) setUnlockError(unlockErr instanceof Error ? unlockErr.message : 'Falha ao destravar instalador');
            } finally {
              if (!cancelled) setUnlockingInstaller(false);
            }
          }
        }
      } catch (err) {
        if (!cancelled) setMetaError(err instanceof Error ? err.message : 'Erro ao carregar');
      }
    })();
    return () => { cancelled = true; };
  }, []);
  
  // Verifica sessão existente
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_TOKEN);
    const savedProject = localStorage.getItem(STORAGE_PROJECT);
    const savedInstallerToken = localStorage.getItem(STORAGE_INSTALLER_TOKEN);
    const savedName = localStorage.getItem(STORAGE_USER_NAME);
    const savedEmail = localStorage.getItem(STORAGE_USER_EMAIL);
    const savedPassHash = localStorage.getItem(STORAGE_USER_PASS_HASH);
    const savedBrandName = localStorage.getItem(STORAGE_BRAND_NAME);
    const savedBrandSlug = localStorage.getItem(STORAGE_BRAND_SLUG);
    const savedBrandLogo = localStorage.getItem(STORAGE_BRAND_LOGO);
    const sessionLocked = localStorage.getItem(STORAGE_SESSION_LOCKED);
    const savedSupabaseToken = localStorage.getItem('crm_install_supabase_token');
    
    if (savedInstallerToken) setInstallerToken(savedInstallerToken);
    
    // Se tem sessão salva com senha, precisa desbloquear
    if (savedPassHash && sessionLocked === 'true') {
      setScreen('locked');
      return;
    }
    
    // Se já tem tudo completo, vai pro wizard
    if (savedToken && savedProject && savedName && savedEmail && savedPassHash && savedSupabaseToken) {
      router.push('/install/wizard');
      return;
    }
    
    // Restaura progresso
    if (savedName) setUserName(savedName);
    if (savedEmail) setUserEmail(savedEmail);
    if (savedBrandName) setBrandName(savedBrandName);
    if (savedBrandSlug) setBrandSlug(savedBrandSlug);
    if (savedBrandLogo) setBrandLogoUrl(savedBrandLogo);
    if (savedToken) {
      setVercelToken(savedToken);
      // Se já tem token Supabase salvo, redireciona direto (evita "piscada" da tela)
      if (savedSupabaseToken) {
        router.push('/install/wizard');
        return;
      } else {
        setScreen('supabase');
      }
    } else if (savedPassHash) {
      setScreen('vercel');
    }
  }, [router]);
  
  // Auto-focus no input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, [screen]);
  
  const handleUnlock = async () => {
    const savedPassHash = localStorage.getItem(STORAGE_USER_PASS_HASH);
    if (!savedPassHash) return;
    
    setError('');
    setIsLoading(true);
    
    const inputHash = await hashPassword(unlockPassword);
    
    if (inputHash === savedPassHash) {
      localStorage.setItem(STORAGE_SESSION_LOCKED, 'false');
      sessionStorage.setItem('crm_install_user_pass', unlockPassword);
      const savedToken = localStorage.getItem(STORAGE_TOKEN);
      const savedSupabaseToken = localStorage.getItem('crm_install_supabase_token');
      
      if (savedToken && savedSupabaseToken) {
        router.push('/install/wizard');
      } else if (savedToken) {
        setScreen('supabase');
      } else {
        setScreen('vercel');
      }
    } else {
      setError('Senha incorreta');
    }
    
    setIsLoading(false);
  };
  
  const handleIdentitySubmit = async () => {
    const name = userName.trim();
    const email = userEmail.trim().toLowerCase();
    const pass = userPassword;
    const confirm = confirmPassword;
    const whiteLabelName = brandName.trim();
    const whiteLabelSlug = slugify(brandSlug.trim() || whiteLabelName);
    
    if (!name || name.length < 2) {
      setError('Digite o nome do administrador');
      return;
    }
    if (!whiteLabelName || whiteLabelName.length < 2) {
      setError('Digite o nome do white-label');
      return;
    }
    if (!whiteLabelSlug || whiteLabelSlug.length < 2) {
      setError('Digite um slug válido para o white-label');
      return;
    }
    if (!email || !email.includes('@')) {
      setError('Digite um e-mail válido');
      return;
    }
    const pwCheck = validateInstallerPassword(pass);
    if (!pwCheck.ok) {
      setError(pwCheck.error);
      return;
    }
    if (pass !== confirm) {
      setError('As senhas não conferem');
      return;
    }
    
    setError('');
    
    const hash = await hashPassword(pass);
    localStorage.setItem(STORAGE_USER_NAME, name);
    localStorage.setItem(STORAGE_USER_EMAIL, email);
    localStorage.setItem(STORAGE_USER_PASS_HASH, hash);
    localStorage.setItem(STORAGE_BRAND_NAME, whiteLabelName);
    localStorage.setItem(STORAGE_BRAND_SLUG, whiteLabelSlug);
    localStorage.setItem(STORAGE_BRAND_LOGO, brandLogoUrl.trim());
    localStorage.setItem(STORAGE_SESSION_LOCKED, 'false');
    sessionStorage.setItem('crm_install_user_pass', pass);
    
    setScreen('vercel');
  };
  
  const handleVercelSubmit = async () => {
    const t = vercelToken.trim();
    if (!t || t.length < 20) {
      setError('Token inválido');
      return;
    }
    
    if (meta?.requiresToken && !installerToken.trim()) {
      setError('Installer token obrigatório');
      return;
    }
    
    setError('');
    setIsLoading(true);
    setScreen('validating');
    
    try {
      const res = await fetch('/api/installer/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: t,
          installerToken: installerToken.trim() || undefined,
          domain: typeof window !== 'undefined' ? window.location.hostname : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao validar token');
      
      localStorage.setItem(STORAGE_TOKEN, t);
      localStorage.setItem(STORAGE_PROJECT, JSON.stringify(data.project));
      if (installerToken.trim()) localStorage.setItem(STORAGE_INSTALLER_TOKEN, installerToken.trim());
      
      setScreen('supabase');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao validar token');
      setScreen('vercel');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSupabaseSubmit = () => {
    const t = supabaseToken.trim();
    if (!t || !t.startsWith('sbp_')) {
      setError('Token Supabase inválido (deve começar com sbp_)');
      return;
    }
    
    setError('');
    localStorage.setItem('crm_install_supabase_token', t);
    setScreen('ready');
    
    setTimeout(() => router.push('/install/wizard'), 1200);
  };
  
  // Auto-submit quando cola token
  useEffect(() => {
    if (screen === 'vercel' && vercelToken.trim().length >= 24 && !isLoading && !error) {
      const handle = setTimeout(() => void handleVercelSubmit(), 800);
      return () => clearTimeout(handle);
    }
  }, [vercelToken, screen, isLoading, error]);
  
  useEffect(() => {
    if (screen === 'supabase' && supabaseToken.trim().startsWith('sbp_') && supabaseToken.trim().length >= 30) {
      const handle = setTimeout(() => void handleSupabaseSubmit(), 800);
      return () => clearTimeout(handle);
    }
  }, [supabaseToken, screen]);
  
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };
  
  // Pega config da tela atual
  const currentScreen = SCREENS[screen as keyof typeof SCREENS];
  const Icon = currentScreen?.icon || User;
  
  if (!meta && !metaError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Iniciando sistemas...</p>
        </motion.div>
      </div>
    );
  }
  
  if (unlockingInstaller) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-6">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Destravando instalador…</h1>
          <p className="text-slate-400">Ajustando variáveis e preparando o redeploy na Vercel.</p>
          {unlockError && (
            <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
              {unlockError}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (metaError || (meta && !meta.enabled)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Missão cancelada</h1>
          <p className="text-slate-400">{metaError || 'Base de lançamento indisponível.'}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
    >
      {/* Background dinâmico baseado na tela */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Estrelas */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
        {/* Nebulosa principal - muda de cor por tela */}
        <motion.div
          className={`absolute top-1/2 left-1/2 w-[800px] h-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[200px] bg-gradient-to-br ${currentScreen?.gradient || 'from-cyan-500/15 to-blue-500/15'}`}
          style={{ x: mxSpring, y: mySpring }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.85)_100%)]" />
      </div>
      
      <div className="w-full max-w-md relative z-10 px-6">
        <AnimatePresence mode="wait">
          {/* ============ TELA: LOCKED ============ */}
          {screen === 'locked' && (
            <motion.div
              key="locked"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 mb-8">
                <AlertCircle className="w-10 h-10 text-amber-400" />
              </div>
              
              <h1 className="text-3xl font-bold text-white mb-3">Sessão protegida</h1>
              <p className="text-slate-400 mb-8">Digite sua senha para continuar de onde parou.</p>
              
              <input
                ref={inputRef}
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleUnlock)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-center text-lg placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent mb-4"
                placeholder="Sua senha"
                autoFocus
              />
              
              <button
                onClick={handleUnlock}
                disabled={isLoading}
                className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-white font-semibold text-lg transition-all"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Desbloquear'}
              </button>
              
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-red-400 text-sm">
                  {error}
                </motion.p>
              )}
            </motion.div>
          )}
          
          {/* ============ TELA 1: IDENTITY ============ */}
          {screen === 'identity' && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Badge */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="flex justify-center mb-6"
              >
                <span className="px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium">
                  Capítulo 1
                </span>
              </motion.div>
              
              {/* Icon */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                className="flex justify-center mb-6"
              >
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center">
                  <User className="w-10 h-10 text-violet-400" />
                </div>
              </motion.div>
              
              {/* Title */}
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold text-white text-center mb-3"
              >
                Quem lidera esta operação?
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-slate-400 text-center mb-8"
              >
                Defina a marca do CRM e a conta de administrador que vai assumir o controle da instalação.
              </motion.p>
              
              {/* Form */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-4"
              >
                <div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-transparent"
                    placeholder="Nome do white-label"
                    autoFocus
                  />
                </div>

                <div>
                  <input
                    type="text"
                    value={brandSlug}
                    onChange={(e) => setBrandSlug(slugify(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-transparent"
                    placeholder="slug-do-white-label"
                  />
                </div>

                <div>
                  <input
                    type="url"
                    value={brandLogoUrl}
                    onChange={(e) => setBrandLogoUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-transparent"
                    placeholder="URL do logo (opcional)"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-transparent"
                    placeholder="Nome do administrador"
                  />
                </div>
                
                <div>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-transparent"
                    placeholder="E-mail de acesso do administrador"
                  />
                </div>
                
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 pr-12 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-transparent"
                    placeholder="Crie uma senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const p = generateStrongPassword(16);
                      setUserPassword(p);
                      setConfirmPassword(p);
                      setError('');
                    }}
                    className="text-violet-300/90 hover:text-violet-200 underline underline-offset-4"
                  >
                    Usar senha sugerida
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (!userPassword) return;
                        await navigator.clipboard.writeText(userPassword);
                        setError('');
                      } catch {
                        // noop
                      }
                    }}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    Copiar
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: passwordChecks.minLen ? 'rgba(16,185,129,0.9)' : 'rgba(148,163,184,0.5)' }} />
                    <span>8+ caracteres</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: passwordChecks.hasLetter ? 'rgba(16,185,129,0.9)' : 'rgba(148,163,184,0.5)' }} />
                    <span>1 letra</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: passwordChecks.hasNumber ? 'rgba(16,185,129,0.9)' : 'rgba(148,163,184,0.5)' }} />
                    <span>1 número</span>
                  </div>
                </div>

                <div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handleIdentitySubmit)}
                    className={`w-full bg-white/5 border rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-transparent ${
                      confirmPassword && confirmPassword !== userPassword 
                        ? 'border-red-500/50' 
                        : confirmPassword && confirmPassword === userPassword 
                          ? 'border-emerald-500/50' 
                          : 'border-white/10'
                    }`}
                    placeholder="Confirme a senha"
                  />
                  {confirmPassword && confirmPassword !== userPassword && (
                    <p className="text-red-400 text-sm mt-2">As senhas não conferem</p>
                  )}
                </div>
                
                <button
                  onClick={handleIdentitySubmit}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-semibold text-lg transition-all shadow-lg shadow-violet-500/25"
                >
                  Continuar
                </button>
              </motion.div>
              
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-red-400 text-sm text-center">
                  {error}
                </motion.p>
              )}
            </motion.div>
          )}
          
          {/* ============ TELA 2: VERCEL ============ */}
          {screen === 'vercel' && (
            <motion.div
              key="vercel"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Badge */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="flex justify-center mb-6"
              >
                <span className="px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium">
                  Capítulo 2
                </span>
              </motion.div>
              
              {/* Icon */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                className="flex justify-center mb-6"
              >
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center">
                  <Rocket className="w-10 h-10 text-cyan-400" />
                </div>
              </motion.div>
              
              {/* Title */}
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold text-white text-center mb-3"
              >
                {firstName ? `Olá, ${firstName}!` : 'Sistema de Deploy'}
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-slate-400 text-center mb-8"
              >
                Conecte com a Vercel para preparar sua nave.
              </motion.p>
              
              {/* Form */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-4"
              >
                {meta?.requiresToken && (
                  <input
                    type="password"
                    value={installerToken}
                    onChange={(e) => setInstallerToken(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent"
                    placeholder="Installer token"
                  />
                )}
                
                <input
                  ref={inputRef}
                  type="password"
                  value={vercelToken}
                  onChange={(e) => { setVercelToken(e.target.value); setError(''); }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent text-center"
                  placeholder="Cole seu token da Vercel"
                  autoFocus
                />
                
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-cyan-400 hover:text-cyan-300 py-3 transition-colors"
                >
                  <span>Gerar token na Vercel</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </motion.div>
              
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-red-400 text-sm text-center">
                  {error}
                </motion.p>
              )}
              
              <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                onClick={() => setScreen('identity')} 
                className="mt-6 w-full text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                ← Voltar
              </motion.button>
            </motion.div>
          )}
          
          {/* ============ TELA: VALIDATING ============ */}
          {screen === 'validating' && (
            <motion.div
              key="validating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <div className="relative inline-flex items-center justify-center w-24 h-24 mb-8">
                <motion.div 
                  className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Verificando conexão</h2>
              <p className="text-slate-400">Conectando com a Vercel...</p>
            </motion.div>
          )}
          
          {/* ============ TELA 3: SUPABASE ============ */}
          {screen === 'supabase' && (
            <motion.div
              key="supabase"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Badge */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="flex justify-center mb-6"
              >
                <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
                  Capítulo 3
                </span>
              </motion.div>
              
              {/* Success indicator from previous step */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex justify-center mb-4"
              >
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs">
                  <CheckCircle2 className="w-3 h-3" /> Vercel conectada
                </span>
              </motion.div>
              
              {/* Icon */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                className="flex justify-center mb-6"
              >
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                  <Database className="w-10 h-10 text-emerald-400" />
                </div>
              </motion.div>
              
              {/* Title */}
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold text-white text-center mb-3"
              >
                Base de Dados
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-slate-400 text-center mb-8"
              >
                Último passo! Conecte com o Supabase.
              </motion.p>
              
              {/* Form */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-4"
              >
                <input
                  ref={inputRef}
                  type="password"
                  value={supabaseToken}
                  onChange={(e) => { setSupabaseToken(e.target.value); setError(''); }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-transparent text-center"
                  placeholder="Cole seu token do Supabase"
                  autoFocus
                />
                
                <a
                  href="https://supabase.com/dashboard/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-emerald-400 hover:text-emerald-300 py-3 transition-colors"
                >
                  <span>Gerar token no Supabase</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </motion.div>
              
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-red-400 text-sm text-center">
                  {error}
                </motion.p>
              )}
            </motion.div>
          )}
          
          {/* ============ TELA: READY ============ */}
          {screen === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/30"
              >
                <CheckCircle2 className="w-12 h-12 text-white" />
              </motion.div>
              
              <h1 className="text-3xl font-bold text-white mb-3">Tudo pronto, {firstName}!</h1>
              <p className="text-slate-400 mb-4">Preparando a sequência de lançamento...</p>
              
              <div className="flex items-center justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span 
                    key={i}
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
