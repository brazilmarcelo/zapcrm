import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Copy,
  Crown,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Shield,
  Trash2,
  UserPlus,
  UserRoundCog,
  Wand2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import AuditLogDashboard from './components/AuditLogDashboard';

interface TeamUser {
  id: string;
  email: string;
  role: 'admin' | 'vendedor';
  organization_id: string;
  created_at: string;
  status: 'active' | 'paused';
  paused_at?: string | null;
  paused_reason?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
}

interface ActiveInvite {
  id: string;
  token: string;
  role: 'admin' | 'vendedor';
  email?: string | null;
  created_at: string;
  expires_at?: string | null;
}

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'vendedor' as 'admin' | 'vendedor',
};

function formatDate(value?: string | null) {
  if (!value) return 'Nunca';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export const UsersPage: React.FC = () => {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [invites, setInvites] = useState<ActiveInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [inviteRole, setInviteRole] = useState<'admin' | 'vendedor'>('vendedor');
  const [inviteExpirationDays, setInviteExpirationDays] = useState<number | null>(7);

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users', {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'include',
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || `Falha ao carregar usuários (HTTP ${res.status})`);
    }

    setUsers(data?.users || []);
  }, []);

  const fetchInvites = useCallback(async () => {
    const res = await fetch('/api/admin/invites', {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'include',
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || `Falha ao carregar convites (HTTP ${res.status})`);
    }

    setInvites(data?.invites || []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchUsers(), fetchInvites()]);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Erro ao carregar equipe.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, fetchInvites, fetchUsers]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const admins = users.filter((user) => user.role === 'admin').length;
    const paused = users.filter((user) => user.status === 'paused').length;
    return { total: users.length, admins, paused };
  }, [users]);

  const handleCreateUser = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Falha ao criar usuário (HTTP ${res.status})`);
      }

      setForm(emptyForm);
      await fetchUsers();
      addToast('Usuário criado com sucesso.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Falha ao criar usuário.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateInvite = async () => {
    setCreatingInvite(true);
    try {
      const expiresAt = inviteExpirationDays
        ? new Date(Date.now() + inviteExpirationDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role: inviteRole,
          expiresAt,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Falha ao gerar convite (HTTP ${res.status})`);
      }

      await fetchInvites();
      addToast('Link de convite criado.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Falha ao gerar convite.', 'error');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleUpdateUser = async (user: TeamUser, payload: Record<string, unknown>, successMessage: string) => {
    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Falha ao atualizar usuário (HTTP ${res.status})`);
      }

      await fetchUsers();
      addToast(successMessage, 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Falha ao atualizar usuário.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (user: TeamUser) => {
    if (!window.confirm(`Remover ${user.email} da operação?`)) return;

    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { accept: 'application/json' },
        credentials: 'include',
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Falha ao remover usuário (HTTP ${res.status})`);
      }

      await fetchUsers();
      addToast('Usuário removido.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Falha ao remover usuário.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleImpersonate = async (user: TeamUser) => {
    if (!window.confirm(`Entrar como ${user.email}? Sua sessão atual será substituída.`)) return;

    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/impersonate`, {
        method: 'POST',
        headers: { accept: 'application/json' },
        credentials: 'include',
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || `Falha ao gerar impersonação (HTTP ${res.status})`);
      }

      window.location.assign(data.url);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Falha ao impersonar usuário.', 'error');
      setActionLoading(null);
    }
  };

  const handleDeleteInvite = async (invite: ActiveInvite) => {
    setActionLoading(invite.id);
    try {
      const res = await fetch(`/api/admin/invites/${invite.id}`, {
        method: 'DELETE',
        headers: { accept: 'application/json' },
        credentials: 'include',
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Falha ao remover convite (HTTP ${res.status})`);
      }

      await fetchInvites();
      addToast('Convite removido.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Falha ao remover convite.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const copyInvite = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/join?token=${token}`);
    addToast('Link copiado para a área de transferência.', 'success');
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <Shield className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Acesso restrito</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Apenas administradores podem gerenciar equipe, convites e logs de operação.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-10 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
            Operação e Equipe
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            {stats.total} usuários cadastrados, {stats.admins} admins e {stats.paused} conta(s) pausada(s).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          Atualizar
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Criar usuário</h2>
          </div>

          <div className="grid gap-3">
            <input
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              placeholder="Nome completo"
            />
            <input
              value={form.email}
              onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              placeholder="email@empresa.com"
            />
            <input
              value={form.password}
              onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              placeholder="Senha inicial"
              type="password"
            />
            <select
              value={form.role}
              onChange={(e) => setForm((current) => ({ ...current, role: e.target.value as 'admin' | 'vendedor' }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
            <button
              type="button"
              onClick={handleCreateUser}
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-500 transition-colors disabled:opacity-60"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar conta
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wand2 className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Convite por link</h2>
          </div>

          <div className="grid gap-3">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'vendedor')}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
            <select
              value={inviteExpirationDays ?? 'never'}
              onChange={(e) => setInviteExpirationDays(e.target.value === 'never' ? null : Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            >
              <option value={7}>Expira em 7 dias</option>
              <option value={3}>Expira em 3 dias</option>
              <option value={1}>Expira em 24 horas</option>
              <option value="never">Não expira</option>
            </select>
            <button
              type="button"
              onClick={handleGenerateInvite}
              disabled={creatingInvite}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-60"
            >
              {creatingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserRoundCog className="w-4 h-4" />}
              Gerar link
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {invites.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum convite ativo no momento.</p>
            ) : (
              invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      Convite {invite.role === 'admin' ? 'admin' : 'vendedor'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      Criado em {formatDate(invite.created_at)} · expira em {invite.expires_at ? formatDate(invite.expires_at) : 'nunca'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => void copyInvite(invite.token)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5" title="Copiar link">
                      <Copy className="w-4 h-4 text-slate-500" />
                    </button>
                    <button type="button" onClick={() => void handleDeleteInvite(invite)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10" title="Excluir convite">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="space-y-4">
        {users.map((user) => {
          const isCurrentUser = user.id === profile?.id;
          const busy = actionLoading === user.id;

          return (
            <div key={user.id} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white font-semibold flex items-center justify-center shadow-lg">
                    {getInitials(user.email)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{user.email}</h3>
                      {isCurrentUser && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-primary-100 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                          Você
                        </span>
                      )}
                      {user.role === 'admin' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          <Crown className="w-3 h-3" />
                          Admin
                        </span>
                      )}
                      {user.status === 'paused' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300">
                          <PauseCircle className="w-3 h-3" />
                          Pausado
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <div>Criado em {formatDate(user.created_at)}</div>
                      <div>Último login: {formatDate(user.last_sign_in_at)}</div>
                      {user.paused_reason ? <div>Motivo da pausa: {user.paused_reason}</div> : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {busy ? (
                    <div className="px-3 py-2 text-sm text-slate-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleUpdateUser(
                          user,
                          { role: user.role === 'admin' ? 'vendedor' : 'admin' },
                          user.role === 'admin'
                            ? 'Usuário alterado para vendedor.'
                            : 'Usuário promovido para administrador.',
                        )}
                        disabled={isCurrentUser}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40"
                      >
                        {user.role === 'admin' ? <Shield className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
                        {user.role === 'admin' ? 'Tornar vendedor' : 'Promover a admin'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleImpersonate(user)}
                        disabled={isCurrentUser}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40"
                      >
                        <Wand2 className="w-4 h-4" />
                        Entrar como
                      </button>

                      {user.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => void handleUpdateUser(user, { status: 'paused', pausedReason: 'Pausado pelo admin' }, 'Usuário pausado.')}
                          disabled={isCurrentUser}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-500/20 text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 disabled:opacity-40"
                        >
                          <PauseCircle className="w-4 h-4" />
                          Pausar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleUpdateUser(user, { status: 'active' }, 'Usuário reativado.')}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-500/20 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Reativar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleDeleteUser(user)}
                        disabled={isCurrentUser}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 dark:border-red-500/20 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock3 className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Auditoria</h2>
        </div>
        <AuditLogDashboard />
      </section>
    </div>
  );
};
