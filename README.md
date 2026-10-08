# WeSend Node.js SDK

The official Node.js library for the [WeSend](https://wesend.mn) API. Send SMS to Mongolian mobile numbers, send email, and verify users with one-time codes.

- Typed requests and responses, for TypeScript and JavaScript
- No dependencies
- Retries that never send a message twice

Full API reference: [wesend.mn/docs](https://wesend.mn/docs)

## Install

```bash
npm install @wesend/node
```

Requires Node.js 20 or newer. Works with ESM (`import`) and CommonJS (`require`).

## Quick start

Create an API key in the WeSend dashboard and keep it in the `WESEND_API_KEY` environment variable.

```ts
import { WeSend } from '@wesend/node'

const wesend = new WeSend() // reads WESEND_API_KEY

const message = await wesend.sms.send({
  to: '99112233',
  text: 'Tanii zahialga batalgaajlaa. #1042',
})

console.log(message.id, message.status, message.balance)
```

You can also pass the key yourself: `new WeSend('ws_...')`.

> **Use the SDK only on your server.** Never put an API key in browser or mobile app code: anyone can read it there and send with your credits.

## SMS

```ts
// One number. When this resolves, the message has been handed to the operator.
const message = await wesend.sms.send({ to: '99112233', text: 'Sain baina uu' })

// Up to 1,000 numbers. The messages are queued and sent in the background.
const batch = await wesend.sms.sendBulk({
  to: ['99112233', '88112233', '95112233'],
  text: 'Shine baraa irlee!',
})
```

## Email

```ts
const email = await wesend.email.send({
  to: 'bat@example.com',
  subject: 'Таны захиалга баталгаажлаа',
  html: '<h1>Баярлалаа!</h1><p>Таны #1042 захиалга баталгаажлаа.</p>',
  text: 'Баярлалаа! Таны #1042 захиалга баталгаажлаа.',
  from_name: 'Shop.mn',
  reply_to: 'support@example.com',
})

// Up to 1,000 addresses. Each recipient gets a separate email.
const batch = await wesend.email.sendBulk({
  to: ['bat@example.com', 'saraa@example.com'],
  subject: 'Шинэ бараа ирлээ',
  html: '<p>Намрын цуглуулга худалдаанд гарлаа.</p>',
})
```

One of `html` and `text` is required. An email is queued: read its final status with `wesend.messages.get(email.id)`.

## Verify

WeSend creates, sends and checks the one-time code. You never store it.

```ts
// 1. Send a code. With an "@" in `to` it goes by email, otherwise by SMS.
const verification = await wesend.verify.create({ to: '99112233', brand: 'Shop.mn' })

// 2. Check what the user typed. Resolves when the code is right, throws when it is not.
try {
  await wesend.verify.check(verification.id, { code: '482913' })
  // The user is verified.
} catch (error) {
  if (error instanceof WeSendError && error.code === 'invalid_code') {
    console.log(`Wrong code, ${error.attempts_remaining} tries left`)
  } else {
    throw error
  }
}
```

To resend a code, call `verify.create` again. The earlier code stops working. Read the current state with `wesend.verify.get(id)`.

## Messages and batches

```ts
const message = await wesend.messages.get(id) // status: queued, processing, sent or failed
const batch = await wesend.batches.get(id)    // status: processing or completed
```

## Balance and pricing

```ts
const { balance, next_expiry } = await wesend.balance.get()
const pricing = await wesend.pricing.get()
```

Every send also returns the new `balance`, so you rarely need to ask separately.

## Errors

A failed request throws a `WeSendError`. Branch on `code`. Use `message` only for logs, because its wording can change.

```ts
import { WeSend, WeSendError } from '@wesend/node'

try {
  await wesend.sms.send({ to: '99112233', text: 'Sain baina uu' })
} catch (error) {
  if (!(error instanceof WeSendError)) throw error

  switch (error.code) {
    case 'insufficient_credits':
      console.log(`Need ${error.required} credits, have ${error.balance}`)
      break
    case 'unsupported_number':
      console.log('Not a Mongolian mobile number')
      break
    default:
      console.error(error.status, error.code, error.message)
  }
}
```

| Field | Description |
| --- | --- |
| `code` | The machine-readable code, such as `invalid_request` or `insufficient_credits`. See [all codes](https://wesend.mn/docs/en/errors). |
| `status` | The HTTP status, or `null` when no response arrived. |
| `message` | A description in English. |
| `retryAfter` | Seconds to wait before trying again, when the API says so. Otherwise `null`. |
| `balance`, `required` | On `insufficient_credits`. |
| `attempts_remaining` | On `invalid_code`. |
| `invalid` | On a bulk send with bad recipients: the entries that were refused, up to 50. |
| `id` | On `provider_failed`: the id of the failed message. |

Three codes come from the SDK itself, not from the API: `timeout`, `connection_error` (the request never got an answer) and `unexpected_response` (the answer was not from the WeSend API).

## Retries and idempotency

The SDK tries a failed request again, up to 2 more times, when doing so is safe:

| Failure | What the SDK does |
| --- | --- |
| `429 rate_limited` | Waits the seconds the API asks for, then sends again. If the wait is longer than 10 seconds, the error is thrown instead. |
| Network failure, timeout or `5xx` | Sends again, for reads and for the four send methods. |
| `502 provider_failed` | Sends again. The operator did not accept the message and the credits were refunded. |
| Any other `4xx` | Thrown at once. Fix the request first. |

After a network failure you cannot know whether a message went out. So `sms.send`, `sms.sendBulk`, `email.send` and `email.sendBulk` always carry an `Idempotency-Key`, and a retry with the same key sends nothing new. The SDK makes a key for each call. Pass your own to stay safe across retries in your own code too, for example when a queue job runs twice:

```ts
await wesend.sms.send(
  { to: '99112233', text: 'Tanii zahialga batalgaajlaa. #1042' },
  { idempotencyKey: 'order-1042-confirmation' },
)
```

With your own key, a `502 provider_failed` is not retried: the key now stands for that failed send, and a repeat would only report the same failure. Send again with a new key.

`verify.create` and `verify.check` do not accept an idempotency key, so after a network failure or a `5xx` they are not retried.

## Options

```ts
const wesend = new WeSend(process.env.WESEND_API_KEY, {
  timeout: 30_000, // milliseconds one attempt may take
  maxRetries: 2,   // 0 turns retries off
})
```

| Option | Default | Description |
| --- | --- | --- |
| `timeout` | `30000` | Milliseconds one attempt may take. |
| `maxRetries` | `2` | How many times a failed request is tried again. |
| `baseUrl` | `https://api.wesend.mn/v1` | Where requests go. |
| `fetch` | global `fetch` | A `fetch` to use in place of the global one. |

## Field names

Request and response fields are named exactly as in the [API reference](https://wesend.mn/docs), in `snake_case` (`from_name`, `batch_id`, `created_at`). The SDK's own options are in `camelCase` (`idempotencyKey`, `maxRetries`).

## CommonJS

```js
const { WeSend } = require('@wesend/node')
```

## License

MIT
