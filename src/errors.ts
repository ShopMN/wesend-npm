export type WeSendErrorCode =
  | 'invalid_request'
  | 'invalid_api_key'
  | 'insufficient_credits'
  | 'subscription_required'
  | 'forbidden'
  | 'trial_recipient'
  | 'not_found'
  | 'verification_expired'
  | 'unsupported_number'
  | 'message_too_long'
  | 'invalid_code'
  | 'rate_limited'
  | 'recipient_rate_limited'
  | 'max_attempts_reached'
  | 'provider_failed'
  | 'server_error'
  // The three below never come from the API. The SDK raises them when no usable answer arrived.
  | 'connection_error'
  | 'timeout'
  | 'unexpected_response'
  // A code added to the API after this version was published.
  | (string & {})

interface WeSendErrorInit {
  status: number | null
  code: WeSendErrorCode
  retryAfter?: number | null
  details?: Record<string, unknown>
  cause?: unknown
}

/** Every failure the SDK throws. Branch on `code`; the wording of `message` can change. */
export class WeSendError extends Error {
  /** The HTTP status, or null when no response arrived. */
  readonly status: number | null
  readonly code: WeSendErrorCode
  /** Seconds to wait before trying again, from the Retry-After header. */
  readonly retryAfter: number | null

  // The extra fields the API puts on some errors, named as the API names them.
  /** `insufficient_credits`: the credits the project has. */
  declare readonly balance?: number
  /** `insufficient_credits`: the credits the request needs. */
  declare readonly required?: number
  /** `invalid_code`: how many tries are left. */
  declare readonly attempts_remaining?: number
  /** `invalid_request` on a bulk send: the recipients that were refused, up to 50. */
  declare readonly invalid?: string[]
  /** `provider_failed`: the id of the failed message. */
  declare readonly id?: string

  constructor(message: string, { status, code, retryAfter = null, details, cause }: WeSendErrorInit) {
    super(message, { cause })
    // First, so that nothing the API sends can replace the fields set below.
    Object.assign(this, details)
    this.name = 'WeSendError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}
