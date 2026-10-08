import { WeSendError } from './errors'

// Filled in from package.json when the package is built.
declare const __VERSION__: string

const DEFAULT_BASE_URL = 'https://api.wesend.mn/v1'
const DEFAULT_TIMEOUT = 30_000
const DEFAULT_MAX_RETRIES = 2
// Seconds. A longer wait than this is handed back to the caller instead of being slept through.
const MAX_RETRY_AFTER = 10

export interface WeSendOptions {
  /** Defaults to `https://api.wesend.mn/v1`. */
  baseUrl?: string
  /** Milliseconds one attempt may take. Defaults to 30000. */
  timeout?: number
  /** How many times a failed request is tried again. Defaults to 2. 0 turns retries off. */
  maxRetries?: number
  /** A fetch to use in place of the global one. */
  fetch?: typeof fetch
}

export interface Call {
  method: 'GET' | 'POST'
  path: string
  body?: object
  /** The endpoint takes an Idempotency-Key. */
  idempotent?: boolean
  idempotencyKey?: string
}

export type Request = <T>(call: Call) => Promise<T>

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// 0.5s, 1s, 2s and so on up to 8s, with jitter so that many clients do not retry in step.
const backoff = (attempt: number) => Math.min(500 * 2 ** attempt, 8000) * (0.75 + Math.random() * 0.5)

const newKey = () => crypto.randomUUID()

function parse(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

function errorOf(status: number, body: Record<string, unknown> | null, retryAfterHeader: string | null) {
  const seconds = Number(retryAfterHeader)
  const retryAfter = retryAfterHeader && Number.isFinite(seconds) && seconds >= 0 ? seconds : null

  const error = body?.error
  if(error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    const { code, message, ...details } = error as { code: string; message?: unknown }
    return new WeSendError(typeof message === 'string' ? message : code, { status, code, retryAfter, details })
  }
  // Not the API's own answer: a proxy or gateway in between, or a wrong baseUrl.
  return new WeSendError(`Unexpected response from WeSend (HTTP ${status}).`, { status, code: 'unexpected_response', retryAfter })
}

function connectionError(cause: unknown) {
  const timedOut = cause instanceof Error && cause.name === 'TimeoutError'
  return new WeSendError(timedOut ? 'The request to WeSend timed out.' : 'Could not reach WeSend.', {
    status: null, code: timedOut ? 'timeout' : 'connection_error', cause,
  })
}

// How long to wait before trying again, in milliseconds, or null when the failure is final.
function retryIn(error: WeSendError, attempt: number, { repeatable, callerKey }: { repeatable: boolean; callerKey: boolean }) {
  // Refused before anything was done, so any request may go again.
  if(error.code === 'rate_limited') {
    if(error.retryAfter === null) return backoff(attempt)
    return error.retryAfter <= MAX_RETRY_AFTER ? error.retryAfter * 1000 : null
  }
  // The operator refused and the credits are back, so sending again cannot send twice. A caller's
  // own key is left alone: a repeat under it would only report the same failure.
  if(error.code === 'provider_failed') return callerKey ? null : backoff(attempt)
  // After any other 5xx it is unknown whether the request was carried out.
  if(error.status !== null && error.status >= 500) return repeatable ? backoff(attempt) : null
  return null
}

export class Http {
  // Private at run time too, so the key does not show when a client is logged.
  readonly #apiKey: string
  readonly #baseUrl: string
  readonly #timeout: number
  readonly #maxRetries: number
  readonly #fetch: typeof fetch

  constructor(apiKey: string, options: WeSendOptions) {
    const fetcher = options.fetch ?? fetch
    this.#apiKey = apiKey
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.#timeout = options.timeout ?? DEFAULT_TIMEOUT
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
    // Called through a wrapper: some runtimes refuse a global fetch that is called as a method.
    this.#fetch = (input, init) => fetcher(input, init)
  }

  request: Request = async <T>(call: Call): Promise<T> => {
    const callerKey = call.idempotent ? call.idempotencyKey || undefined : undefined
    let key = call.idempotent ? callerKey ?? newKey() : undefined
    // Asking again is safe when the request changes nothing, or when its key makes the repeat a no-op.
    const repeatable = call.method === 'GET' || key !== undefined

    for(let attempt = 0; ; attempt++) {
      const last = attempt >= this.#maxRetries

      let response: Response
      let text: string
      try {
        response = await this.#fetch(this.#baseUrl + call.path, {
          method: call.method,
          headers: this.#headers(call, key),
          body: call.body ? JSON.stringify(call.body) : undefined,
          signal: AbortSignal.timeout(this.#timeout),
        })
        text = await response.text()
      } catch (cause) {
        // Nothing came back, so the request may or may not have arrived.
        if(repeatable && !last) {
          await sleep(backoff(attempt))
          continue
        }
        throw connectionError(cause)
      }

      const body = parse(text)
      if(response.ok && body) return body as T

      const error = errorOf(response.status, body, response.headers.get('retry-after'))
      const wait = last ? null : retryIn(error, attempt, { repeatable, callerKey: callerKey !== undefined })
      if(wait === null) throw error
      // The API has this key down as a failed send, and would answer a repeat with that failure.
      if(error.code === 'provider_failed' && call.idempotent) key = newKey()
      await sleep(wait)
    }
  }

  #headers(call: Call, key: string | undefined) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#apiKey}`,
      Accept: 'application/json',
      'User-Agent': `wesend-node/${__VERSION__}`,
    }
    if(call.body) headers['Content-Type'] = 'application/json'
    if(key) headers['Idempotency-Key'] = key
    return headers
  }
}
