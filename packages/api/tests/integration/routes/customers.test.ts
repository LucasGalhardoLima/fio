import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Kysely } from 'kysely'
import type { Database } from '../../../src/db/types.js'
import { sql } from 'kysely'
import {
  createTestApp,
  createTestDatabase,
  createTestAccount,
  createTestApiKey,
  cleanupDatabase,
} from '../../helpers/setup.js'

const VALID_CPF = '52998224725'
const SECOND_VALID_CPF = '39053344705'

describe('Customer CRUD — /v1/customers', () => {
  let app: FastifyInstance
  let db: Kysely<Database>
  let apiKey: string

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)

    await cleanupDatabase(db)

    const account = await createTestAccount(db)
    const { rawKey } = await createTestApiKey(db, account.id)
    apiKey = rawKey
  })

  beforeEach(async () => {
    // Clean customer-dependent tables before each test to avoid tax_id/email conflicts
    await sql`TRUNCATE TABLE charges, invoices, subscriptions, customers CASCADE`.execute(db)
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  describe('POST /v1/customers', () => {
    it('creates a customer with a valid CPF and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: 'Maria Silva',
          email: 'maria@example.com',
          tax_id: VALID_CPF,
          tax_id_type: 'cpf',
        },
      })

      expect(response.statusCode).toBe(201)

      const body = response.json<{ id: string; name: string; email: string; tax_id: string }>()
      expect(body.id).toBeDefined()
      expect(body.name).toBe('Maria Silva')
      expect(body.email).toBe('maria@example.com')
      expect(body.tax_id).toBe(VALID_CPF)
    })

    it('rejects an invalid CPF with 422', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: 'Bad CPF',
          email: 'bad-cpf@example.com',
          tax_id: '00000000000',
          tax_id_type: 'cpf',
        },
      })

      expect(response.statusCode).toBe(422)

      const body = response.json<{ type: string; code: string }>()
      expect(body.type).toBe('validation_error')
    })

    it('rejects duplicate email within the same account and environment with 409', async () => {
      const email = `dup-email-${Date.now()}@example.com`

      await app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: 'First',
          email,
          tax_id: VALID_CPF,
          tax_id_type: 'cpf',
        },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: 'Second',
          email,
          tax_id: SECOND_VALID_CPF,
          tax_id_type: 'cpf',
        },
      })

      expect(response.statusCode).toBe(409)
    })

    it('rejects duplicate tax_id within the same account and environment with 409', async () => {
      const taxId = VALID_CPF

      await app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: 'First TaxId',
          email: `taxid-a-${Date.now()}@example.com`,
          tax_id: taxId,
          tax_id_type: 'cpf',
        },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: 'Second TaxId',
          email: `taxid-b-${Date.now()}@example.com`,
          tax_id: taxId,
          tax_id_type: 'cpf',
        },
      })

      expect(response.statusCode).toBe(409)
    })
  })

  describe('GET /v1/customers/:id', () => {
    it('returns an existing customer with 200', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: 'Get Test',
          email: `get-test-${Date.now()}@example.com`,
          tax_id: VALID_CPF,
          tax_id_type: 'cpf',
        },
      })

      const { id } = created.json<{ id: string }>()

      const response = await app.inject({
        method: 'GET',
        url: `/v1/customers/${id}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })

      expect(response.statusCode).toBe(200)

      const body = response.json<{ id: string; name: string }>()
      expect(body.id).toBe(id)
      expect(body.name).toBe('Get Test')
    })

    it('returns 404 for a non-existent customer', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'

      const response = await app.inject({
        method: 'GET',
        url: `/v1/customers/${fakeId}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /v1/customers/:id', () => {
    it('updates a customer name and returns 200', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: 'Before Update',
          email: `update-${Date.now()}@example.com`,
          tax_id: VALID_CPF,
          tax_id_type: 'cpf',
        },
      })

      const { id } = created.json<{ id: string }>()

      const response = await app.inject({
        method: 'PUT',
        url: `/v1/customers/${id}`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { name: 'After Update' },
      })

      expect(response.statusCode).toBe(200)

      const body = response.json<{ name: string }>()
      expect(body.name).toBe('After Update')
    })

    it('rejects updating tax_id with 422 or 409', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: 'No TaxId Update',
          email: `no-taxid-${Date.now()}@example.com`,
          tax_id: VALID_CPF,
          tax_id_type: 'cpf',
        },
      })

      const { id } = created.json<{ id: string }>()

      const response = await app.inject({
        method: 'PUT',
        url: `/v1/customers/${id}`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { tax_id: SECOND_VALID_CPF },
      })

      expect([409, 422]).toContain(response.statusCode)
    })
  })

  describe('DELETE /v1/customers/:id', () => {
    it('deletes a customer without active subscriptions and returns 204', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: 'Delete Me',
          email: `delete-${Date.now()}@example.com`,
          tax_id: VALID_CPF,
          tax_id_type: 'cpf',
        },
      })

      const { id } = created.json<{ id: string }>()

      const response = await app.inject({
        method: 'DELETE',
        url: `/v1/customers/${id}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })

      expect(response.statusCode).toBe(204)
    })
  })

  describe('GET /v1/customers', () => {
    it('lists customers with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/customers?limit=2',
        headers: { authorization: `Bearer ${apiKey}` },
      })

      expect(response.statusCode).toBe(200)

      const body = response.json<{
        data: unknown[]
        has_more: boolean
        next_cursor: string | null
      }>()

      expect(Array.isArray(body.data)).toBe(true)
      expect(typeof body.has_more).toBe('boolean')
      expect(
        body.next_cursor === null || typeof body.next_cursor === 'string',
      ).toBe(true)
    })
  })
})
