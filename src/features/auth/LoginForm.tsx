import { Check, Eye, EyeOff } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useSessionStore } from '@/entities/session/store'
import { describeError } from '@/shared/api/errors'
import { apiUrlForInstance, GreenApiClient, normalizeApiUrl } from '@/shared/api/greenApi'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { TextField } from '@/shared/ui/TextField'
import styles from './LoginForm.module.css'

type Field = 'apiUrl' | 'idInstance' | 'apiTokenInstance'
type Errors = Partial<Record<Field, string>>

const STATE_MESSAGES: Record<string, string> = {
  notAuthorized: 'Инстанс не авторизован. Отсканируйте QR-код в личном кабинете GREEN-API',
  pendingPassword: 'Завершите вход: введите пароль 2FA в личном кабинете GREEN-API',
  starting: 'Инстанс запускается, повторите через пару минут',
  blocked: 'Аккаунт Telegram заблокирован',
  suspended: 'На аккаунте временные ограничения Telegram',
}

function validate(values: Record<Field, string>): Errors {
  const errors: Errors = {}
  // apiUrl is optional: an empty field falls back to the instance's own host.
  if (values.apiUrl.trim()) {
    try {
      const url = new URL(normalizeApiUrl(values.apiUrl))
      if (url.protocol !== 'https:') errors.apiUrl = 'Адрес должен начинаться с https://'
    } catch {
      errors.apiUrl = 'Некорректный адрес'
    }
  }
  if (!/^\d{6,}$/.test(values.idInstance.trim()))
    errors.idInstance = 'Только цифры, например 4100123456'
  if (values.apiTokenInstance.trim().length < 10) errors.apiTokenInstance = 'Слишком короткий токен'
  return errors
}

export function LoginForm() {
  const login = useSessionStore((s) => s.login)
  const [values, setValues] = useState<Record<Field, string>>({
    apiUrl: '',
    idInstance: '',
    apiTokenInstance: '',
  })
  const derivedApiUrl = apiUrlForInstance(values.idInstance)
  const [remember, setRemember] = useState(true)
  const [showToken, setShowToken] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  // E.g. the token was revoked while polling: say why the user is back on this screen.
  const [formError, setFormError] = useState<string | null>(
    () => useSessionStore.getState().logoutReason,
  )
  const [pending, setPending] = useState(false)

  const update = (field: Field) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setValues((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const credentials = {
      // validate() guarantees a numeric idInstance, so the derived host exists here.
      apiUrl: normalizeApiUrl(values.apiUrl.trim() || derivedApiUrl || ''),
      idInstance: values.idInstance.trim(),
      apiTokenInstance: values.apiTokenInstance.trim(),
    }
    setPending(true)
    setFormError(null)
    try {
      const account = await new GreenApiClient(credentials).getAccountSettings()
      if (account.stateInstance !== 'authorized') {
        setFormError(
          STATE_MESSAGES[account.stateInstance] ?? `Статус инстанса: ${account.stateInstance}`,
        )
        return
      }
      login(credentials, account, remember)
    } catch (error) {
      setFormError(describeError(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        label="idInstance"
        name="idInstance"
        inputMode="numeric"
        autoComplete="username"
        value={values.idInstance}
        onChange={update('idInstance')}
        error={errors.idInstance}
        autoFocus
      />
      <TextField
        label="apiTokenInstance"
        name="apiTokenInstance"
        type={showToken ? 'text' : 'password'}
        autoComplete="current-password"
        spellCheck={false}
        value={values.apiTokenInstance}
        onChange={update('apiTokenInstance')}
        error={errors.apiTokenInstance}
        trailing={
          <IconButton
            label={showToken ? 'Скрыть токен' : 'Показать токен'}
            onClick={() => setShowToken((v) => !v)}
          >
            {showToken ? <EyeOff size={24} /> : <Eye size={24} />}
          </IconButton>
        }
      />
      <TextField
        label="apiUrl (необязательно)"
        name="apiUrl"
        type="url"
        inputMode="url"
        spellCheck={false}
        value={values.apiUrl}
        onChange={update('apiUrl')}
        error={errors.apiUrl}
        hint={
          derivedApiUrl
            ? `По умолчанию: ${derivedApiUrl}`
            : 'Определяется по idInstance; укажите, если в кабинете другой'
        }
      />

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          className={styles.checkboxInput}
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        <span className={styles.checkboxBox} aria-hidden="true">
          <Check size={16} strokeWidth={3} />
        </span>
        <span>Запомнить на этом устройстве</span>
      </label>

      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}

      <Button type="submit" block loading={pending} className={styles.submit}>
        {pending ? 'Подключаемся…' : 'Войти'}
      </Button>
    </form>
  )
}
