import type { Request } from './http'
import type {
  Balance, Batch, Carrier, Contact, ContactBulkResult, ContactGroup, ContactList, ContactListParams, ContactParams, DeletedContact,
  EmailSendBulkParams, EmailSendParams, Message, Pricing, SendOptions, SentBatch, SentMessage, SmsSendBulkParams,
  SmsSendParams, StartedVerification, UpsertedContact, Verification, VerifyCheckParams, VerifyCreateParams,
} from './types'

const id = (value: string) => encodeURIComponent(value)

abstract class Resource {
  protected readonly request: Request

  constructor(request: Request) {
    this.request = request
  }
}

export class Sms extends Resource {
  /** Sends to one number. When this resolves, the message has been handed to the operator. */
  send(params: SmsSendParams, options: SendOptions = {}) {
    return this.request<SentMessage>({ method: 'POST', path: '/sms', body: params, idempotent: true, idempotencyKey: options.idempotencyKey })
  }

  /** Queues one text for up to 1,000 numbers. Follow it with `batches.get`. */
  sendBulk(params: SmsSendBulkParams, options: SendOptions = {}) {
    return this.request<SentBatch>({ method: 'POST', path: '/sms/bulk', body: params, idempotent: true, idempotencyKey: options.idempotencyKey })
  }
}

export class Email extends Resource {
  /** Queues an email to one address. Read its final status with `messages.get`. */
  send(params: EmailSendParams, options: SendOptions = {}) {
    return this.request<SentMessage>({ method: 'POST', path: '/email', body: params, idempotent: true, idempotencyKey: options.idempotencyKey })
  }

  /** Queues one email for up to 1,000 addresses. Follow it with `batches.get`. */
  sendBulk(params: EmailSendBulkParams, options: SendOptions = {}) {
    return this.request<SentBatch>({ method: 'POST', path: '/email/bulk', body: params, idempotent: true, idempotencyKey: options.idempotencyKey })
  }
}

export class Verify extends Resource {
  /** Creates a one-time code and sends it. Calling it again for the same recipient replaces the earlier code. */
  create(params: VerifyCreateParams) {
    return this.request<StartedVerification>({ method: 'POST', path: '/verify', body: params })
  }

  /** Checks the code the user typed. Resolves when it is right, and throws a `WeSendError` when it is not. */
  check(verificationId: string, params: VerifyCheckParams) {
    return this.request<Verification>({ method: 'POST', path: `/verify/${id(verificationId)}/check`, body: params })
  }

  get(verificationId: string) {
    return this.request<Verification>({ method: 'GET', path: `/verify/${id(verificationId)}` })
  }
}

export class Messages extends Resource {
  /** The status of one message. The message body is never returned. */
  get(messageId: string) {
    return this.request<Message>({ method: 'GET', path: `/messages/${id(messageId)}` })
  }
}

export class Batches extends Resource {
  /** The progress of a bulk send. */
  get(batchId: string) {
    return this.request<Batch>({ method: 'GET', path: `/batches/${id(batchId)}` })
  }
}

export class BalanceResource extends Resource {
  get() {
    return this.request<Balance>({ method: 'GET', path: '/balance' })
  }
}

export class Carriers extends Resource {
  /** The operators WeSend sends to, with the numbers each owns. Their ids are the keys of `text_by_carrier`. */
  list() {
    return this.request<{ data: Carrier[] }>({ method: 'GET', path: '/carriers' })
  }
}

export class PricingResource extends Resource {
  /** The prices that apply to the project now, and the upcoming holiday rates. */
  get() {
    return this.request<Pricing>({ method: 'GET', path: '/pricing' })
  }
}

export class Contacts extends Resource {
  /** Adds a contact, or updates the one with the same external_id, phone or email. */
  upsert(params: ContactParams) {
    return this.request<UpsertedContact>({ method: 'POST', path: '/contacts', body: params, safe: true })
  }

  /** Up to 1,000 contacts in one call. Each is answered on its own: one bad contact does not stop the rest. */
  upsertMany(contacts: ContactParams[]) {
    return this.request<ContactBulkResult>({ method: 'POST', path: '/contacts/bulk', body: { contacts }, safe: true })
  }

  /** A page of contacts, or the one contact with the given external_id, phone or email. */
  list(params: ContactListParams = {}) {
    const query = new URLSearchParams()
    for(const [name, value] of Object.entries(params)) if(value !== undefined && value !== null && value !== '') query.set(name, String(value))
    const search = query.toString()
    return this.request<ContactList>({ method: 'GET', path: `/contacts${search ? `?${search}` : ''}` })
  }

  get(contactId: string) {
    return this.request<Contact>({ method: 'GET', path: `/contacts/${id(contactId)}` })
  }

  /** Changes only the fields that are sent. */
  update(contactId: string, params: ContactParams) {
    return this.request<Contact>({ method: 'PATCH', path: `/contacts/${id(contactId)}`, body: params, safe: true })
  }

  /** Deletes the contact. A "no" to promotions it gave is kept. */
  delete(contactId: string) {
    return this.request<DeletedContact>({ method: 'DELETE', path: `/contacts/${id(contactId)}`, safe: true })
  }
}

export class ContactGroups extends Resource {
  list() {
    return this.request<{ data: ContactGroup[] }>({ method: 'GET', path: '/contact-groups' })
  }
}
