import { parseNotification } from './parse'

const instanceData = { idInstance: 4100000000, wid: '79876543210@c.us', typeInstance: 'telegram' }

function incoming(messageData: object, senderData: object = {}) {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData,
    timestamp: 1763115112,
    idMessage: '1763115112345',
    senderData: {
      chatId: '10000000',
      chatType: 'user',
      sender: '10000000',
      chatName: 'Василиса',
      senderName: 'Василиса Премудрая',
      senderContactName: '',
      senderPhoneNumber: 79876543210,
      ...senderData,
    },
    messageData,
  }
}

describe('parseNotification', () => {
  it('parses an incoming textMessage', () => {
    const event = parseNotification(
      incoming({ typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет!' } }),
    )
    expect(event).toEqual({
      type: 'message',
      chatId: '10000000',
      idMessage: '1763115112345',
      direction: 'in',
      text: 'Привет!',
      timestamp: 1763115112000,
      contact: { name: 'Василиса Премудрая', phone: '79876543210' },
    })
  })

  it('reads the text of a reply that quotes another message', () => {
    expect(
      parseNotification(
        incoming({
          typeMessage: 'quotedMessage',
          extendedTextMessageData: { text: 'Неа', stanzaId: '1769676078000' },
          quotedMessage: { typeMessage: 'textMessage', textMessage: 'ты видишь?' },
        }),
      ),
    ).toMatchObject({ type: 'message', direction: 'in', text: 'Неа' })
  })

  it('turns a photo into a placeholder message, keeping its caption', () => {
    expect(
      parseNotification(
        incoming({ typeMessage: 'imageMessage', fileMessageData: { caption: 'Смотри' } }),
      ),
    ).toMatchObject({ type: 'message', media: '📷 Фото', text: 'Смотри' })
    expect(parseNotification(incoming({ typeMessage: 'stickerMessage' }))).toMatchObject({
      media: 'Стикер',
      text: '',
    })
  })

  it('parses an incoming extendedTextMessage (text with a link)', () => {
    const event = parseNotification(
      incoming({
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: {
          text: 'Docs: https://green-api.com',
          description: '',
          title: '',
        },
      }),
    )
    expect(event).toMatchObject({ type: 'message', text: 'Docs: https://green-api.com' })
  })

  it('treats messages sent from the phone as outgoing and does not take our own name', () => {
    const event = parseNotification({
      ...incoming({ typeMessage: 'textMessage', textMessageData: { textMessage: 'Ответ' } }),
      typeWebhook: 'outgoingMessageReceived',
    })
    expect(event).toMatchObject({ direction: 'out', contact: { name: 'Василиса' } })
  })

  it('parses outgoing message statuses', () => {
    expect(
      parseNotification({
        typeWebhook: 'outgoingMessageStatus',
        chatId: '10000000',
        instanceData,
        timestamp: 1763115112,
        idMessage: '1763115112345',
        status: 'read',
      }),
    ).toEqual({ type: 'status', chatId: '10000000', idMessage: '1763115112345', status: 'read' })
  })

  it.each([
    [
      'reactions (not messages)',
      incoming({ typeMessage: 'reactionMessage', extendedTextMessageData: { text: '👍' } }),
    ],
    [
      'group chats',
      incoming(
        { typeMessage: 'textMessage', textMessageData: { textMessage: 'hi' } },
        { chatId: '-10000000000000', chatType: 'supergroup' },
      ),
    ],
    ['service notifications', { typeWebhook: 'stateInstanceChanged', stateInstance: 'authorized' }],
    [
      'unknown statuses',
      { typeWebhook: 'outgoingMessageStatus', chatId: '1', idMessage: '2', status: 'x' },
    ],
    ['garbage', null],
  ])('ignores %s', (_, body) => {
    expect(parseNotification(body)).toBeNull()
  })
})
