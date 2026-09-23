import { z } from 'zod'
import type { ChatEvent } from '@/entities/chat/model'

const MESSAGE_WEBHOOKS = [
  'incomingMessageReceived',
  'outgoingMessageReceived',
  'outgoingAPIMessageReceived',
] as const

const optionalString = z.string().optional().catch(undefined)

const senderDataSchema = z.looseObject({
  chatId: z.string().min(1),
  chatType: optionalString,
  chatName: optionalString,
  senderName: optionalString,
  senderContactName: optionalString,
  senderPhoneNumber: z.union([z.number(), z.string()]).optional().catch(undefined),
})

const messageDataSchema = z.discriminatedUnion('typeMessage', [
  z.looseObject({
    typeMessage: z.literal('textMessage'),
    textMessageData: z.looseObject({ textMessage: z.string() }),
  }),
  z.looseObject({
    typeMessage: z.literal('extendedTextMessage'),
    extendedTextMessageData: z.looseObject({ text: z.string() }),
  }),
])

const messageWebhookSchema = z.looseObject({
  typeWebhook: z.enum(MESSAGE_WEBHOOKS),
  idMessage: z.string().min(1),
  timestamp: z.number(),
  senderData: senderDataSchema,
  messageData: messageDataSchema,
})

const statusWebhookSchema = z.looseObject({
  typeWebhook: z.literal('outgoingMessageStatus'),
  chatId: z.string().min(1),
  idMessage: z.string().min(1),
  status: z.string(),
  description: optionalString,
})

const KNOWN_STATUSES = new Set(['delivered', 'read', 'failed', 'noAccount'])

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Maps a raw GREEN-API notification body to a ChatEvent.
 * Returns `null` for anything the text chat does not need (media, groups, service events…).
 */
export function parseNotification(body: unknown): ChatEvent | null {
  const status = statusWebhookSchema.safeParse(body)
  if (status.success) {
    const value = status.data.status
    if (!KNOWN_STATUSES.has(value)) return null
    return {
      type: 'status',
      chatId: status.data.chatId,
      idMessage: status.data.idMessage,
      status: value as Extract<ChatEvent, { type: 'status' }>['status'],
      description: nonEmpty(status.data.description),
    }
  }

  const message = messageWebhookSchema.safeParse(body)
  if (!message.success) return null

  const { typeWebhook, idMessage, timestamp, senderData, messageData } = message.data

  // Private chats only: Telegram group ids are negative, chatType tells the rest.
  if (senderData.chatId.startsWith('-')) return null
  if (senderData.chatType && senderData.chatType !== 'user') return null

  const text =
    messageData.typeMessage === 'textMessage'
      ? messageData.textMessageData.textMessage
      : messageData.extendedTextMessageData.text

  const incoming = typeWebhook === 'incomingMessageReceived'
  const phone = senderData.senderPhoneNumber ? String(senderData.senderPhoneNumber) : undefined

  return {
    type: 'message',
    chatId: senderData.chatId,
    idMessage,
    direction: incoming ? 'in' : 'out',
    text,
    timestamp: timestamp * 1000,
    // For outgoing notifications senderData describes *us*, so only the chat name is trustworthy.
    contact: incoming
      ? {
          name:
            nonEmpty(senderData.senderContactName) ??
            nonEmpty(senderData.senderName) ??
            nonEmpty(senderData.chatName),
          phone,
        }
      : { name: nonEmpty(senderData.chatName) },
  }
}
