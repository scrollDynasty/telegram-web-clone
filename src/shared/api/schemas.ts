import { z } from 'zod'

const instanceStateSchema = z.enum([
  'notAuthorized',
  'authorized',
  'blocked',
  'suspended',
  'starting',
  'pendingPassword',
])

export const accountSettingsSchema = z.looseObject({
  stateInstance: z.union([instanceStateSchema, z.string()]),
  phone: z.string().optional().catch(undefined),
  username: z.string().optional().catch(undefined),
  avatar: z.string().optional().catch(undefined),
})
export type AccountSettings = z.infer<typeof accountSettingsSchema>

export const sendMessageResponseSchema = z.looseObject({
  idMessage: z.string().min(1),
})

/** Success: `{ exist, chatId, username }`; failure: `{ status: false, reason | data.reason }`. */
export const checkAccountResponseSchema = z.looseObject({
  exist: z.boolean().optional(),
  chatId: z.string().optional().catch(undefined),
  username: z.string().optional().catch(undefined),
  status: z.boolean().optional(),
  reason: z.string().optional().catch(undefined),
  data: z.looseObject({ reason: z.string().optional() }).optional().catch(undefined),
})

export const receiveNotificationResponseSchema = z
  .looseObject({
    receiptId: z.number(),
    body: z.unknown(),
  })
  .nullable()
export type ReceivedNotification = NonNullable<z.infer<typeof receiveNotificationResponseSchema>>

export const deleteNotificationResponseSchema = z.looseObject({
  result: z.boolean(),
})

const yesNo = z.string().optional().catch(undefined)

/** The subset of GetSettings the chat depends on. */
export const instanceSettingsSchema = z.looseObject({
  webhookUrl: z.string().optional().catch(undefined),
  incomingWebhook: yesNo,
  outgoingWebhook: yesNo,
  outgoingMessageWebhook: yesNo,
  outgoingAPIMessageWebhook: yesNo,
})
export type InstanceSettings = z.infer<typeof instanceSettingsSchema>

export const setSettingsResponseSchema = z.looseObject({
  saveSettings: z.boolean(),
})
