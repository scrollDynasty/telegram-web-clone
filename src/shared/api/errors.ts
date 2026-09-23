export type GreenApiErrorKind =
  | 'unauthorized'
  | 'rate_limit'
  | 'bad_request'
  | 'server'
  | 'network'
  | 'timeout'
  | 'invalid_response'

export class GreenApiError extends Error {
  readonly kind: GreenApiErrorKind
  readonly status: number | undefined

  constructor(kind: GreenApiErrorKind, message: string, status?: number, options?: ErrorOptions) {
    super(message, options)
    this.name = 'GreenApiError'
    this.kind = kind
    this.status = status
  }
}

export function kindFromStatus(status: number): GreenApiErrorKind {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate_limit'
  if (status >= 500) return 'server'
  return 'bad_request'
}

/** Known GREEN-API error texts (English, often plain text) → messages for the user. */
const KNOWN_API_MESSAGES: [RegExp, string][] = [
  [
    /starting or not authori[sz]ed/i,
    'Инстанс запускается или не авторизован в Telegram. Проверьте его в личном кабинете GREEN-API',
  ],
  [
    /not authori[sz]ed|notAuthorized/i,
    'Инстанс не авторизован в Telegram. Авторизуйте его в личном кабинете GREEN-API',
  ],
  [/\bstarting\b/i, 'Инстанс запускается, повторите через пару минут'],
  [/expired/i, 'Подписка на инстанс истекла. Продлите её в личном кабинете GREEN-API'],
  [/deleted/i, 'Инстанс удалён. Создайте новый в личном кабинете GREEN-API'],
  [/validation failed/i, 'GREEN-API отклонил запрос: некорректные данные'],
]

export function localizeApiMessage(message: string): string | undefined {
  return KNOWN_API_MESSAGES.find(([pattern]) => pattern.test(message))?.[1]
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Human-readable (RU) message for any error surfaced to the user. */
export function describeError(error: unknown): string {
  if (error instanceof GreenApiError) {
    switch (error.kind) {
      case 'unauthorized':
        return 'Неверный idInstance или apiTokenInstance'
      case 'rate_limit':
        return 'Слишком много запросов, попробуйте чуть позже'
      case 'network':
        return 'Нет соединения с GREEN-API. Проверьте интернет и apiUrl'
      case 'timeout':
        return 'GREEN-API не ответил вовремя'
      case 'server':
        return 'Ошибка на стороне GREEN-API, попробуйте позже'
      case 'invalid_response':
        return 'Неожиданный ответ от GREEN-API'
      case 'bad_request':
        return error.message || 'Некорректный запрос'
    }
  }
  if (error instanceof Error) return error.message
  return 'Неизвестная ошибка'
}
