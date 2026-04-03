import type { Kysely } from 'kysely'
import type { PaginatedResponse } from '@fio-pay/shared'
import { EVENT_TYPES, ENTITY_TYPES } from '@fio-pay/shared'
import type { Database, CustomerRow } from '../db/types.js'
import {
  insertCustomer,
  findCustomerById,
  findCustomerByEmail,
  findCustomerByTaxId,
  updateCustomer as updateCustomerQuery,
  deleteCustomer as deleteCustomerQuery,
  listCustomersWithCursor,
} from '../db/queries/customers.js'
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors.js'
import { validateTaxId } from '../lib/cpf-cnpj.js'
import { createEvent } from './event-service.js'
import { paginateResults, normalizePaginationLimit } from '../lib/pagination.js'

interface CreateCustomerParams {
  account_id: string
  environment: string
  name: string
  email: string
  tax_id: string
  tax_id_type: 'cpf' | 'cnpj'
  metadata?: Record<string, unknown>
}

interface UpdateCustomerParams {
  name?: string
  email?: string
  metadata?: Record<string, unknown>
  tax_id?: string // must not be provided; checked below
}

interface PaginationParams {
  limit?: number
  starting_after?: string
}

/**
 * Create a new customer. Validates CPF/CNPJ, enforces uniqueness
 * per account + environment on both email and tax_id.
 */
export async function createCustomer(
  db: Kysely<Database>,
  params: CreateCustomerParams,
): Promise<CustomerRow> {
  // Validate CPF/CNPJ
  if (!validateTaxId(params.tax_id, params.tax_id_type)) {
    throw new ValidationError(
      `Invalid ${params.tax_id_type.toUpperCase()}: ${params.tax_id}`,
      [{ field: 'tax_id', message: `Invalid ${params.tax_id_type} check digits or length` }],
    )
  }

  // Check email uniqueness
  const existingByEmail = await findCustomerByEmail(
    db, params.account_id, params.environment, params.email,
  )
  if (existingByEmail) {
    throw new ConflictError(`A customer with email '${params.email}' already exists`)
  }

  // Check tax_id uniqueness
  const existingByTaxId = await findCustomerByTaxId(
    db, params.account_id, params.environment, params.tax_id,
  )
  if (existingByTaxId) {
    throw new ConflictError(`A customer with tax_id '${params.tax_id}' already exists`)
  }

  const customer = await insertCustomer(db, {
    account_id: params.account_id,
    environment: params.environment,
    name: params.name,
    email: params.email,
    tax_id: params.tax_id,
    tax_id_type: params.tax_id_type,
    metadata: params.metadata ?? {},
  })

  await createEvent(db, {
    account_id: customer.account_id,
    environment: customer.environment,
    event_type: EVENT_TYPES.CUSTOMER_CREATED,
    entity_type: ENTITY_TYPES.CUSTOMER,
    entity_id: customer.id,
    data: {
      customer_id: customer.id,
      name: customer.name,
      email: customer.email,
    },
  })

  return customer
}

/**
 * Get a customer by ID. Throws NotFoundError if not found.
 */
export async function getCustomer(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<CustomerRow> {
  const customer = await findCustomerById(db, id, accountId, environment)
  if (!customer) {
    throw new NotFoundError(`Customer not found: ${id}`)
  }
  return customer
}

/**
 * Update a customer. Rejects tax_id changes (immutable after creation).
 */
export async function updateCustomerService(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
  updates: UpdateCustomerParams,
): Promise<CustomerRow> {
  if (updates.tax_id !== undefined) {
    throw new ConflictError('tax_id cannot be changed after creation')
  }

  // Ensure the customer exists before updating
  await getCustomer(db, id, accountId, environment)

  // Check email uniqueness if email is being updated
  if (updates.email !== undefined) {
    const existingByEmail = await findCustomerByEmail(db, accountId, environment, updates.email)
    if (existingByEmail && existingByEmail.id !== id) {
      throw new ConflictError(`A customer with email '${updates.email}' already exists`)
    }
  }

  const customer = await updateCustomerQuery(db, id, accountId, environment, {
    name: updates.name,
    email: updates.email,
    metadata: updates.metadata,
  })

  await createEvent(db, {
    account_id: customer.account_id,
    environment: customer.environment,
    event_type: EVENT_TYPES.CUSTOMER_UPDATED,
    entity_type: ENTITY_TYPES.CUSTOMER,
    entity_id: customer.id,
    data: {
      customer_id: customer.id,
      updates: Object.keys(updates).filter((k) => k !== 'tax_id'),
    },
  })

  return customer
}

/**
 * Delete a customer. Checks for active subscriptions first.
 */
export async function deleteCustomerService(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<void> {
  await getCustomer(db, id, accountId, environment)

  // Check for active subscriptions
  const activeSub = await db
    .selectFrom('subscriptions')
    .select('id')
    .where('customer_id', '=', id)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .where('status', 'in', ['trialing', 'active', 'past_due'])
    .executeTakeFirst()

  if (activeSub) {
    throw new ConflictError('Cannot delete customer with active subscriptions')
  }

  await deleteCustomerQuery(db, id, accountId, environment)
}

/**
 * List customers with cursor-based pagination.
 */
export async function listCustomers(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  pagination: PaginationParams,
): Promise<PaginatedResponse<CustomerRow>> {
  const limit = normalizePaginationLimit(pagination.limit)

  // Fetch limit + 1 to determine has_more
  const rows = await listCustomersWithCursor(
    db, accountId, environment, limit + 1, pagination.starting_after,
  )

  return paginateResults(rows, limit)
}
