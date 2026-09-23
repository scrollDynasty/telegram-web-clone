import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GreenApiClientProvider } from '@/shared/api/client-context'
import { GreenApiClient } from '@/shared/api/greenApi'
import type { InstanceSettings } from '@/shared/api/schemas'
import { NotificationSettingsCard } from './NotificationSettingsCard'
import { evaluateSettings, REQUIRED_SETTINGS } from './useNotificationSettings'

const credentials = {
  apiUrl: 'https://4100.api.green-api.com',
  idInstance: '4100123456',
  apiTokenInstance: 'secret-token',
}

const ALL_ON = {
  webhookUrl: '',
  incomingWebhook: 'yes',
  outgoingWebhook: 'yes',
  outgoingMessageWebhook: 'yes',
  outgoingAPIMessageWebhook: 'yes',
}

describe('evaluateSettings', () => {
  it('is ok when everything the chat needs is on', () => {
    expect(evaluateSettings(ALL_ON)).toEqual({ status: 'ok' })
  })

  it('flags a fresh instance (everything off)', () => {
    expect(evaluateSettings({ ...ALL_ON, incomingWebhook: 'no', outgoingWebhook: 'no' })).toEqual({
      status: 'needs-setup',
      webhookUrlSet: false,
      incomingOff: true,
    })
  })

  it('flags a webhook URL, which disables the HTTP API queue', () => {
    expect(evaluateSettings({ ...ALL_ON, webhookUrl: 'https://example.com/hook' })).toMatchObject({
      status: 'needs-setup',
      webhookUrlSet: true,
    })
  })
})

describe('NotificationSettingsCard', () => {
  function renderCard({
    settings,
    setSettings = async () => true,
  }: {
    settings: () => Promise<InstanceSettings>
    setSettings?: () => Promise<boolean>
  }) {
    const getSpy = vi.spyOn(GreenApiClient.prototype, 'getSettings').mockImplementation(settings)
    const setSpy = vi.spyOn(GreenApiClient.prototype, 'setSettings').mockImplementation(setSettings)
    render(
      <GreenApiClientProvider credentials={credentials}>
        <input type="search" aria-label="Поиск по чатам" />
        <NotificationSettingsCard />
      </GreenApiClientProvider>,
    )
    return { getSpy, setSpy, user: userEvent.setup() }
  }

  afterEach(() => vi.restoreAllMocks())

  it('switches notifications on, announces it and keeps focus in the card', async () => {
    const { setSpy, user } = renderCard({
      settings: async () => ({ ...ALL_ON, incomingWebhook: 'no' }),
    })

    const button = await screen.findByRole('button', { name: 'Включить' })
    expect(screen.getByText(/выключены уведомления о входящих/)).toBeInTheDocument()
    await user.click(button)

    expect(setSpy).toHaveBeenCalledWith(REQUIRED_SETTINGS)
    const title = await screen.findByText('Уведомления включены')
    expect(title).toHaveFocus()
    expect(screen.getByText(/перезапустит инстанс/)).toHaveAttribute('aria-live', 'polite')

    await user.click(screen.getByRole('button', { name: 'Скрыть' }))
    expect(screen.queryByText('Уведомления включены')).toBeNull()
    expect(screen.getByRole('searchbox', { name: 'Поиск по чатам' })).toHaveFocus()
  })

  it('explains a webhook URL', async () => {
    renderCard({ settings: async () => ({ ...ALL_ON, webhookUrl: 'https://example.com/hook' }) })
    expect(await screen.findByText(/указан webhook URL/)).toBeInTheDocument()
  })

  it('shows the error and offers to retry when SetSettings fails', async () => {
    const { user } = renderCard({
      settings: async () => ({ ...ALL_ON, incomingWebhook: 'no' }),
      setSettings: async () => false,
    })
    await user.click(await screen.findByRole('button', { name: 'Включить' }))
    expect(await screen.findByText('GREEN-API не сохранил настройки')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })

  it('stays hidden when the instance is already set up', async () => {
    const { getSpy } = renderCard({ settings: async () => ALL_ON })
    await vi.waitFor(() => expect(getSpy).toHaveResolved())
    expect(screen.queryByRole('region')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Включить' })).toBeNull()
  })

  it('stays hidden when the settings cannot be read', async () => {
    const { getSpy } = renderCard({
      settings: async () => {
        throw new Error('network')
      },
    })
    await vi.waitFor(() => expect(getSpy).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole('button', { name: 'Включить' })).toBeNull()
  })
})
