import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GreenApiClientProvider } from '@/shared/api/client-context'
import { GreenApiClient } from '@/shared/api/greenApi'
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
  function renderWith(fetchMock: typeof fetch) {
    vi.spyOn(GreenApiClient.prototype, 'getSettings')
    const client = new GreenApiClient(credentials, fetchMock)
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock)
    render(
      <GreenApiClientProvider credentials={credentials}>
        <NotificationSettingsCard />
      </GreenApiClientProvider>,
    )
    return client
  }

  afterEach(() => vi.restoreAllMocks())

  it('offers to switch notifications on and sends the required settings', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) =>
      String(url).includes('/getSettings/')
        ? new Response(JSON.stringify({ ...ALL_ON, incomingWebhook: 'no' }))
        : new Response(JSON.stringify({ saveSettings: true })),
    )
    renderWith(fetchMock)

    const button = await screen.findByRole('button', { name: 'Включить' })
    expect(screen.getByText(/выключены уведомления о входящих/)).toBeInTheDocument()

    await userEvent.setup().click(button)

    expect(await screen.findByText('Уведомления включены')).toBeInTheDocument()
    const setCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/setSettings/'))!
    expect(JSON.parse(String(setCall[1]?.body))).toEqual(REQUIRED_SETTINGS)
  })

  it('stays hidden when the instance is already set up', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(ALL_ON)))
    renderWith(fetchMock)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Включить' })).toBeNull()
  })
})
