/**
 * Standardized Error Codes for Form Validation
 *
 * Enables internationalization and consistent error handling
 */

// Error code prefixes by domain
export const ERROR_DOMAINS = {
  FIELD: 'FIELD', // Generic field errors
  EMAIL: 'EMAIL', // Email-specific errors
  PHONE: 'PHONE', // Phone-specific errors
  AUTH: 'AUTH', // Authentication errors
  API: 'API', // API/Server errors
} as const;

// Standardized error codes
export const ERROR_CODES = {
  // Field errors
  FIELD_REQUIRED: 'FIELD_REQUIRED',
  FIELD_TOO_SHORT: 'FIELD_TOO_SHORT',
  FIELD_TOO_LONG: 'FIELD_TOO_LONG',
  FIELD_INVALID_FORMAT: 'FIELD_INVALID_FORMAT',

  // Email errors
  EMAIL_REQUIRED: 'EMAIL_REQUIRED',
  EMAIL_INVALID: 'EMAIL_INVALID',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',

  // Phone errors
  PHONE_INVALID: 'PHONE_INVALID',

  // Number errors
  NUMBER_REQUIRED: 'NUMBER_REQUIRED',
  NUMBER_TOO_SMALL: 'NUMBER_TOO_SMALL',
  NUMBER_TOO_LARGE: 'NUMBER_TOO_LARGE',
  NUMBER_MUST_BE_POSITIVE: 'NUMBER_MUST_BE_POSITIVE',

  // Date errors
  DATE_REQUIRED: 'DATE_REQUIRED',
  DATE_INVALID: 'DATE_INVALID',
  DATE_IN_PAST: 'DATE_IN_PAST',
  DATE_IN_FUTURE: 'DATE_IN_FUTURE',

  // Selection errors
  SELECTION_REQUIRED: 'SELECTION_REQUIRED',
  SELECTION_INVALID: 'SELECTION_INVALID',

  // API errors
  API_ERROR: 'API_ERROR',
  API_TIMEOUT: 'API_TIMEOUT',
  API_NETWORK_ERROR: 'API_NETWORK_ERROR',
  API_UNAUTHORIZED: 'API_UNAUTHORIZED',
  API_NOT_FOUND: 'API_NOT_FOUND',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// Translations by locale
type Translations = Record<ErrorCode, string>;

const ptBR: Translations = {
  // Field errors
  FIELD_REQUIRED: '{field} é obrigatório',
  FIELD_TOO_SHORT: '{field} deve ter no mínimo {min} caracteres',
  FIELD_TOO_LONG: '{field} deve ter no máximo {max} caracteres',
  FIELD_INVALID_FORMAT: '{field} está em formato inválido',

  // Email errors
  EMAIL_REQUIRED: 'Email é obrigatório',
  EMAIL_INVALID: 'Email inválido',
  EMAIL_ALREADY_EXISTS: 'Este email já está cadastrado',

  // Phone errors
  PHONE_INVALID: 'Telefone inválido',

  // Number errors
  NUMBER_REQUIRED: '{field} é obrigatório',
  NUMBER_TOO_SMALL: '{field} deve ser no mínimo {min}',
  NUMBER_TOO_LARGE: '{field} deve ser no máximo {max}',
  NUMBER_MUST_BE_POSITIVE: '{field} deve ser um valor positivo',

  // Date errors
  DATE_REQUIRED: '{field} é obrigatória',
  DATE_INVALID: 'Data inválida',
  DATE_IN_PAST: '{field} não pode ser no passado',
  DATE_IN_FUTURE: '{field} não pode ser no futuro',

  // Selection errors
  SELECTION_REQUIRED: 'Selecione uma opção para {field}',
  SELECTION_INVALID: 'Opção inválida selecionada',

  // API errors
  API_ERROR: 'Erro ao processar requisição. Tente novamente.',
  API_TIMEOUT: 'Tempo limite excedido. Tente novamente.',
  API_NETWORK_ERROR: 'Erro de conexão. Verifique sua internet.',
  API_UNAUTHORIZED: 'Sessão expirada. Faça login novamente.',
  API_NOT_FOUND: 'Recurso não encontrado.',
};

const enUS: Translations = {
  // Field errors
  FIELD_REQUIRED: '{field} is required',
  FIELD_TOO_SHORT: '{field} must be at least {min} characters',
  FIELD_TOO_LONG: '{field} must be at most {max} characters',
  FIELD_INVALID_FORMAT: '{field} is in invalid format',

  // Email errors
  EMAIL_REQUIRED: 'Email is required',
  EMAIL_INVALID: 'Invalid email',
  EMAIL_ALREADY_EXISTS: 'This email is already registered',

  // Phone errors
  PHONE_INVALID: 'Invalid phone number',

  // Number errors
  NUMBER_REQUIRED: '{field} is required',
  NUMBER_TOO_SMALL: '{field} must be at least {min}',
  NUMBER_TOO_LARGE: '{field} must be at most {max}',
  NUMBER_MUST_BE_POSITIVE: '{field} must be a positive value',

  // Date errors
  DATE_REQUIRED: '{field} is required',
  DATE_INVALID: 'Invalid date',
  DATE_IN_PAST: '{field} cannot be in the past',
  DATE_IN_FUTURE: '{field} cannot be in the future',

  // Selection errors
  SELECTION_REQUIRED: 'Please select an option for {field}',
  SELECTION_INVALID: 'Invalid option selected',

  // API errors
  API_ERROR: 'Error processing request. Please try again.',
  API_TIMEOUT: 'Request timed out. Please try again.',
  API_NETWORK_ERROR: 'Connection error. Check your internet.',
  API_UNAUTHORIZED: 'Session expired. Please log in again.',
  API_NOT_FOUND: 'Resource not found.',
};

const translations: Record<string, Translations> = {
  'pt-BR': ptBR,
  'en-US': enUS,
};

// Current locale (can be changed dynamically)
let currentLocale = 'pt-BR';

/**
 * Função pública `setLocale` do projeto.
 *
 * @param {string} locale - Parâmetro `locale`.
 * @returns {void} Não retorna valor.
 */
export const setLocale = (locale: string) => {
  if (translations[locale]) {
    currentLocale = locale;
  }
};

/**
 * Função pública `getLocale` do projeto.
 * @returns {string} Retorna um valor do tipo `string`.
 */
export const getLocale = () => currentLocale;

interface ErrorParams {
  field?: string;
  min?: number;
  max?: number;
  [key: string]: string | number | undefined;
}

/**
 * Get translated error message
 */
export const getErrorMessage = (code: ErrorCode, params: ErrorParams = {}): string => {
  const template = translations[currentLocale]?.[code] || translations['pt-BR'][code] || code;

  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
};

/**
 * Create error with code for i18n support
 */
export const createError = (code: ErrorCode, params: ErrorParams = {}) => ({
  code,
  message: getErrorMessage(code, params),
  params,
});
