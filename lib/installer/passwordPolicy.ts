export const INSTALLER_PASSWORD_MIN_LENGTH = 8;

export function validateInstallerPassword(password: string): { ok: true } | { ok: false; error: string } {
  const p = String(password || '');

  if (p.length < INSTALLER_PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Sua senha precisa ter pelo menos ${INSTALLER_PASSWORD_MIN_LENGTH} caracteres.` };
  }

  // Baseline: letra + número (compatível com a maioria das políticas e evita "senha fraca").
  const hasLetter = /[A-Za-z]/.test(p);
  const hasNumber = /\d/.test(p);

  if (!hasLetter || !hasNumber) {
    return { ok: false, error: 'Use pelo menos 1 letra e 1 número.' };
  }

  return { ok: true };
}
