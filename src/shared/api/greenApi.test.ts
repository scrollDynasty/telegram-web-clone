import { GreenApiError } from './errors'
import { apiUrlForInstance, GreenApiClient, resolveApiUrl } from './greenApi'

const credentials = {
  apiUrl: 'https://4100.api.green-api.com/',
  idInstance: '4100123456',
  apiTokenInstance: 'secret-token',
}

function mockFetch(status: number, body: unknown) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
    )
}

describe('GreenApiClient', () => {
  it('sends a message with the documented URL and body', async () => {
    const fetchMock = mockFetch(200, { idMessage: 'abc' })
    const client = new GreenApiClient(credentials, fetchMock)

    await expect(client.sendMessage('10000000', 'Привет')).resolves.toBe('abc')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://4100.api.green-api.com/waInstance4100123456/sendMessage/secret-token')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ chatId: '10000000', message: 'Привет' })
  })

  it('returns null when the notification queue is empty', async () => {
    const client = new GreenApiClient(credentials, mockFetch(200, 'null'))
    await expect(client.receiveNotification(5)).resolves.toBeNull()
  })

  it('treats 408 on receiveNotification (Telegram empty long poll) as an empty queue', async () => {
    const client = new GreenApiClient(credentials, mockFetch(408, 'Request Timeout'))
    await expect(client.receiveNotification(20)).resolves.toBeNull()
  })

  it('still reports 408 from other methods', async () => {
    const client = new GreenApiClient(credentials, mockFetch(408, 'Request Timeout'))
    await expect(client.sendMessage('1', 'x')).rejects.toMatchObject({ status: 408 })
  })

  it('passes receiveTimeout and deletes by receiptId', async () => {
    const fetchMock = mockFetch(200, { receiptId: 7, body: { typeWebhook: 'x' } })
    const client = new GreenApiClient(credentials, fetchMock)
    await expect(client.receiveNotification(20)).resolves.toEqual({
      receiptId: 7,
      body: { typeWebhook: 'x' },
    })
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(
      /receiveNotification\/secret-token\?receiveTimeout=20$/,
    )

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ result: true })))
    await client.deleteNotification(7)
    expect(fetchMock.mock.calls[1]![0]).toMatch(/deleteNotification\/secret-token\/7$/)
    expect(fetchMock.mock.calls[1]![1]?.method).toBe('DELETE')
  })

  it('maps checkAccount responses', async () => {
    const found = new GreenApiClient(
      credentials,
      mockFetch(200, { exist: true, chatId: '10000000', username: '@alice' }),
    )
    await expect(found.checkAccount({ phoneNumber: '79876543210' })).resolves.toEqual({
      exist: true,
      chatId: '10000000',
      username: '@alice',
    })

    const missing = new GreenApiClient(credentials, mockFetch(200, { exist: false, chatId: '' }))
    await expect(missing.checkAccount({ phoneNumber: '79876543210' })).resolves.toEqual({
      exist: false,
    })

    const limited = new GreenApiClient(
      credentials,
      mockFetch(200, { status: false, data: { status: 'fail', reason: 'rate_limit_exceeded' } }),
    )
    await expect(limited.checkAccount({ username: '@alice' })).rejects.toMatchObject({
      kind: 'rate_limit',
    })
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rate_limit'],
    [400, 'bad_request'],
    [502, 'server'],
  ] as const)('maps HTTP %i to %s', async (status, kind) => {
    const client = new GreenApiClient(credentials, mockFetch(status, ''))
    const error = await client.getAccountSettings().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GreenApiError)
    expect(error).toMatchObject({ kind, status })
  })

  it('reads { error, details } bodies and localizes known GREEN-API texts', async () => {
    const validation = new GreenApiClient(
      credentials,
      mockFetch(400, { error: 'Bad Request', details: 'Validation failed' }),
    )
    const error = await validation.sendMessage('1', 'x').catch((e: unknown) => e)
    expect(error).toMatchObject({ kind: 'bad_request' })
    expect((error as Error).message).not.toContain('{')
    expect((error as Error).message).toMatch(/некорректные данные/)

    const custom = new GreenApiClient(credentials, mockFetch(400, { details: 'Chat not found' }))
    await expect(custom.sendMessage('1', 'x')).rejects.toMatchObject({ message: 'Chat not found' })

    const starting = new GreenApiClient(
      credentials,
      mockFetch(400, 'instance is starting or not authorized'),
    )
    await expect(starting.receiveNotification(5)).rejects.toMatchObject({
      kind: 'bad_request',
      message: expect.stringMatching(/не авторизован/),
    })

    const expired = new GreenApiClient(credentials, mockFetch(400, 'Instance account is expired'))
    await expect(expired.receiveNotification(5)).rejects.toMatchObject({
      message: expect.stringMatching(/Подписка/),
    })
  })

  it('maps a failure while reading the body like a failed request', async () => {
    const brokenBody = {
      ok: true,
      status: 200,
      text: () => Promise.reject(new TypeError('network error')),
    } as unknown as Response
    const client = new GreenApiClient(
      credentials,
      vi.fn<typeof fetch>().mockResolvedValue(brokenBody),
    )
    await expect(client.sendMessage('1', 'x')).rejects.toMatchObject({
      name: 'GreenApiError',
      kind: 'network',
    })
  })

  it('rejects malformed payloads', async () => {
    const client = new GreenApiClient(credentials, mockFetch(200, { unexpected: true }))
    await expect(client.sendMessage('1', 'x')).rejects.toMatchObject({ kind: 'invalid_response' })
  })

  it('wraps network failures', async () => {
    const client = new GreenApiClient(
      credentials,
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')),
    )
    await expect(client.getAccountSettings()).rejects.toMatchObject({ kind: 'network' })
  })

  it('re-throws caller aborts untouched', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn<typeof fetch>((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
    })
    const promise = new GreenApiClient(credentials, fetchMock).receiveNotification(
      20,
      controller.signal,
    )
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('apiUrlForInstance', () => {
  it('derives the instance host from the first 4 digits', () => {
    expect(apiUrlForInstance('4100123456')).toBe('https://4100.api.green-api.com')
    expect(apiUrlForInstance(' 1103000001 ')).toBe('https://1103.api.green-api.com')
  })

  it.each(['', '410', 'abc12345'])('returns null for %j', (id) => {
    expect(apiUrlForInstance(id)).toBeNull()
  })
})

describe('resolveApiUrl', () => {
  it('redirects the shared host (no CORS DELETE) and empty values to the instance host', () => {
    expect(resolveApiUrl('https://api.green-api.com', '4100123456')).toBe(
      'https://4100.api.green-api.com',
    )
    expect(resolveApiUrl('https://api.green-api.com/', '4100123456')).toBe(
      'https://4100.api.green-api.com',
    )
    expect(resolveApiUrl('', '4100123456')).toBe('https://4100.api.green-api.com')
  })

  it('keeps an explicit instance host', () => {
    expect(resolveApiUrl('https://7103.api.greenapi.com/', '4100123456')).toBe(
      'https://7103.api.greenapi.com',
    )
  })

  it('a stored session with the old default talks to the instance host', async () => {
    const fetchMock = mockFetch(200, { idMessage: 'abc' })
    const client = new GreenApiClient(
      { apiUrl: 'https://api.green-api.com', idInstance: '4100123456', apiTokenInstance: 't' },
      fetchMock,
    )
    await client.sendMessage('1', 'x')
    expect(
      String(fetchMock.mock.calls[0]![0]).startsWith(
        'https://4100.api.green-api.com/waInstance4100123456/',
      ),
    ).toBe(true)
  })
})
