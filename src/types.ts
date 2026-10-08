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
  created_at: string
  sent_at: string | null
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
  }
  email: { credits: number }
  /** Upcoming periods when SMS rates rise. */
  holidays: Holiday[]
}
