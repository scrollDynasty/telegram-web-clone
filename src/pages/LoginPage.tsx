import { ChevronDown } from 'lucide-react'
import { LoginForm } from '@/features/auth/LoginForm'
import { ThemeToggle } from '@/features/theme/ThemeToggle'
import { Logo } from '@/shared/ui/Logo'
import styles from './LoginPage.module.css'

export function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.corner}>
        <ThemeToggle />
      </div>

      <section className={styles.card} aria-labelledby="login-title">
        <Logo size={160} className={styles.logo} />
        <h1 id="login-title" className={styles.title}>
          Telegram&nbsp;Web
        </h1>
        <p className={styles.subtitle}>
          Войдите с параметрами инстанса <strong>GREEN-API</strong>, чтобы отправлять и получать
          сообщения Telegram
        </p>

        <LoginForm />

        <details className={styles.help}>
          <summary>
            Где взять данные для входа?
            <ChevronDown size={20} className={styles.chevron} aria-hidden="true" />
          </summary>
          <ol>
            <li>
              Зарегистрируйтесь в{' '}
              <a href="https://console.green-api.com" target="_blank" rel="noopener noreferrer">
                личном кабинете GREEN-API
              </a>{' '}
              и создайте инстанс Telegram.
            </li>
            <li>Авторизуйте инстанс: Telegram → Настройки → Устройства → Подключить устройство.</li>
            <li>
              Скопируйте <code>apiUrl</code>, <code>idInstance</code> и{' '}
              <code>apiTokenInstance</code> со страницы инстанса.
            </li>
            <li>
              В настройках инстанса оставьте поле webhook URL пустым и включите уведомления о
              входящих и исходящих сообщениях.
            </li>
          </ol>
        </details>
      </section>

      <p className={styles.footer}>
        Данные хранятся только в вашем браузере и отправляются напрямую в GREEN-API
      </p>
    </main>
  )
}
