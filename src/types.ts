// Requests and responses are typed exactly as the API documents them, field for field:
// https://wesend.mn/docs

export type Channel = 'sms' | 'email'

/** Options for one send. */
export interface SendOptions {
  /**
   * A repeat with the same key sends nothing new and returns the original result. 1 to 255
   * printable ASCII characters, unique within the project. Without one the SDK makes its own,
   * so that its retries never send twice.
   */
  idempotencyKey?: string
}

// ---- Messages and batches ------------------------------------------------------------------

export type MessageStatus = 'queued' | 'processing' | 'sent' | 'failed'

/** What the recipient's mail server did with a sent email. */
export type DeliveryStatus = 'delivered' | 'delayed' | 'bounced' | 'complained' | 'suppressed' | 'failed'

export interface Delivery {
  status: DeliveryStatus
  /** Why it bounced, failed or was suppressed, when the server said. */
  detail: string | null
  /** True when a failed or suppressed email was refunded. */
  refunded: boolean
  updated_at: string | null
}

export interface Message {
  id: string
  status: MessageStatus
  channel: Channel
  /** An 8-digit number or an email address. */
  to: string
  /** Number of SMS parts. SMS only. */
  parts?: number
  /** The holiday rate multiplier. SMS only. */
  rate_multiplier?: number
  credits: number
  batch_id: string | null
  error: { code: string; message: string } | null
  /** True when it was made with a sandbox key (`ws_test_…`): nothing was delivered or charged. */
  sandbox: boolean
  created_at: string
  sent_at: string | null
  /** Email only. The latest delivery report, or null until one arrives. */
  delivery?: Delivery | null
  /** Email only. When the recipient's mail server accepted it. */
  delivered_at?: string | null
}

/** A message as a send returns it: with the project's new balance. */
export interface SentMessage extends Message {
  balance: number
}

export type BatchStatus = 'processing' | 'completed'

export interface Batch {
  id: string
  status: BatchStatus
  channel: Channel
  total: number
  sent: number
  failed: number
  /** Charged up front. Each failed message has been refunded. */
  credits: number
  /** True when it was made with a sandbox key (`ws_test_…`): nothing was delivered or charged. */
  sandbox: boolean
  created_at: string
  completed_at: string | null
}

/** A batch as a bulk send returns it: with the project's new balance. */
export interface SentBatch extends Batch {
  balance: number
}

// ---- SMS -----------------------------------------------------------------------------------

export interface SmsSendParams {
  /** An 8-digit number. `+976`, spaces and dashes are accepted. */
  to: string
  /** At most 5 parts. */
  text: string
}

export interface SmsSendBulkParams {
  /** 1 to 1,000 numbers. Duplicates are merged. */
  to: string[]
  text: string
}

// ---- Email ---------------------------------------------------------------------------------

interface EmailContent {
  /** Up to 255 characters, one line. */
  subject: string
  /** Defaults to the project's brand name, or the project name. */
  from_name?: string
  /** Defaults to the address set in the project's settings. */
  reply_to?: string
}

// One of html and text is required.
type EmailBody = { html: string; text?: string } | { text: string; html?: string }

export type EmailSendParams = EmailContent & EmailBody & { to: string }

/** 1 to 1,000 addresses. Each recipient gets a separate email. */
export type EmailSendBulkParams = EmailContent & EmailBody & { to: string[] }

// ---- Verify --------------------------------------------------------------------------------

export type VerificationStatus = 'pending' | 'approved' | 'expired' | 'failed' | 'canceled'

export interface VerifyCreateParams {
  /** A phone number or an email address. With an `@` the code goes by email, otherwise by SMS. */
  to: string
  /** Where the code goes if the operator refuses the SMS. Only when `to` is a phone number. */
  fallback_email?: string
  /** The message language. Defaults to `mn`. */
  locale?: 'mn' | 'en'
  /** The name the message starts with, up to 20 characters. */
  brand?: string
  /** 4 to 8. */
  code_length?: number
  code_type?: 'digits' | 'letters' | 'alphanumeric'
  /** Seconds the code is valid, 60 to 600. Defaults to 300. */
  ttl?: number
}

export interface VerifyCheckParams {
  /** The code the user typed. */
  code: string
}

export interface Verification {
  id: string
  status: VerificationStatus
  channel: Channel
  to: string
  /** True when it was made with a sandbox key (`ws_test_…`): nothing was delivered or charged. */
  sandbox: boolean
  expires_at: string
}

/** A verification as `verify.create` returns it: with what it cost and the new balance. */
export interface StartedVerification extends Verification {
  credits: number
  balance: number
}

// ---- Balance and pricing -------------------------------------------------------------------

export interface Balance {
  balance: number
  /** The credits that expire first, or null when there are no active credits. */
  next_expiry: { credits: number; expires_at: string } | null
}

export interface Holiday {
  name: string
  /** On the Ulaanbaatar calendar, `YYYY-MM-DD`. Both days are included. */
  starts_on: string
  ends_on: string
  rate_multiplier: number
}

export interface Pricing {
  sms: {
    credits_per_part: number
    /** The multiplier in force now. */
    rate_multiplier: number
    /** The name of the holiday in force now, or null. */
    holiday: string | null
    latin_part_size: number
    unicode_part_size: number
    max_parts: number
    /** What a verification SMS starts with: "{name}: ", unless the request sets `brand`. */
    prefix: {
      name: string
      /** Characters the prefix takes from the first part, the ": " included. */
      length: number
      /** False when the name holds a Cyrillic letter or another character outside the basic alphabet; the SMS then uses the non-Latin part size. */
      is_latin: boolean
    }
  }
  email: { credits: number }
  /** Upcoming periods when SMS rates rise. */
  holidays: Holiday[]
}

// ---- Contacts ------------------------------------------------------------------------------

/**
 * Whether the person agreed to promotions on a channel. `unknown` receives them until they say
 * no; `unsubscribed` receives none.
 */
export type ContactConsent = 'unknown' | 'subscribed' | 'unsubscribed'

export interface Contact {
  id: string
  /** The person's id in your own system. */
  external_id: string | null
  name: string | null
  /** 8 digits. */
  phone: string | null
  email: string | null
  company: string | null
  note: string | null
  tags: string[]
  /** Group names. */
  groups: string[]
  marketing: { sms: ContactConsent; email: ContactConsent }
  sandbox: boolean
  created_at: string | null
  updated_at: string | null
}

export interface ContactParams {
  /** Your own id for the person. The contact is found again by it first, then by phone, then by email. */
  external_id?: string | null
  name?: string | null
  /** An 8-digit Mongolian mobile number. A phone or an email is required. */
  phone?: string | null
  email?: string | null
  company?: string | null
  note?: string | null
  /** Replaces the contact's tags. Up to 20. */
  tags?: string[]
  /** Group names. A name that is new creates the group. Replaces the contact's groups. */
  groups?: string[]
  /**
   * true when the person agreed to promotions on that channel, false when they said no. A no
   * sticks: true lifts it only when your project recorded it, never when the person
   * unsubscribed with the link in an email.
   */
  marketing?: { sms?: boolean; email?: boolean }
}

export interface UpsertedContact extends Contact {
  /** True when the contact was new, false when an existing one was updated. */
  created: boolean
}

export interface ContactListParams {
  /** Finds the one contact with this id, phone or email. */
  external_id?: string
  phone?: string
  email?: string
  /** Searches the name, phone, email, company and external id. */
  q?: string
  tag?: string
  /** A group name. */
  group?: string
  page?: number
  /** 1 to 100. Defaults to 50. */
  limit?: number
}

export interface ContactList {
  data: Contact[]
  total: number
  page: number
}

export interface ContactBulkResult {
  created: number
  updated: number
  /** One result per contact sent, in the same order. */
  results: Array<{ id: string; created: boolean } | { error: string }>
}

export interface DeletedContact {
  id: string
  deleted: true
}

export interface ContactGroup {
  id: string
  name: string
  description: string | null
  created_at: string | null
}
