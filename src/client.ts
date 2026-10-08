import { Http, type WeSendOptions } from './http'
import { BalanceResource, Batches, Email, Messages, PricingResource, Sms, Verify } from './resources'

export class WeSend {
  readonly sms: Sms
  readonly email: Email
  readonly verify: Verify
  readonly messages: Messages
  readonly batches: Batches
  readonly balance: BalanceResource
  readonly pricing: PricingResource

  /**
   * @param apiKey A key that starts with `ws_`. Defaults to the `WESEND_API_KEY` environment variable.
   * Use it only on a server: in browser or mobile code anyone can read it and spend your credits.
   */
  constructor(apiKey?: string, options: WeSendOptions = {}) {
    const key = apiKey ?? (typeof process !== 'undefined' ? process.env?.WESEND_API_KEY : undefined)
    if(!key) throw new Error('WeSend needs an API key. Pass it to new WeSend(), or set WESEND_API_KEY.')

    const { request } = new Http(key, options)
    this.sms = new Sms(request)
    this.email = new Email(request)
    this.verify = new Verify(request)
    this.messages = new Messages(request)
    this.batches = new Batches(request)
    this.balance = new BalanceResource(request)
    this.pricing = new PricingResource(request)
  }
}
