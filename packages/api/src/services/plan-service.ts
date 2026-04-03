import type { Kysely } from 'kysely'
import type { PaginatedResponse } from '@fio-pay/shared'
import { MIN_CHARGE_AMOUNT } from '@fio-pay/shared'
import type { Database, PlanRow } from '../db/types.js'
import {
  insertPlan,
  findPlanById,
  archivePlan as archivePlanQuery,
  listPlansWithCursor,
} from '../db/queries/plans.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import { paginateResults, normalizePaginationLimit } from '../lib/pagination.js'

interface CreatePlanParams {
  account_id: string
  environment: string
  name: string
  amount: number // centavos
  interval: string
  trial_days?: number
  dunning_schedule?: number[]
  metadata?: Record<string, unknown>
}

interface PaginationParams {
  limit?: number
  starting_after?: string
}

interface PlanFilters {
  active?: boolean
}

/**
 * Create a new plan. Validates minimum amount.
 */
export async function createPlan(
  db: Kysely<Database>,
  params: CreatePlanParams,
): Promise<PlanRow> {
  if (params.amount < MIN_CHARGE_AMOUNT) {
    throw new ValidationError(
      `Plan amount must be at least ${MIN_CHARGE_AMOUNT} centavos (R$1.00)`,
      [{ field: 'amount', message: `Minimum amount is ${MIN_CHARGE_AMOUNT} centavos` }],
    )
  }

  return insertPlan(db, {
    account_id: params.account_id,
    environment: params.environment,
    name: params.name,
    amount: params.amount,
    interval: params.interval,
    trial_days: params.trial_days ?? 0,
    dunning_schedule: params.dunning_schedule ?? [1, 3, 7],
    metadata: params.metadata ?? {},
  })
}

/**
 * Get a plan by ID. Throws NotFoundError if not found.
 */
export async function getPlan(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<PlanRow> {
  const plan = await findPlanById(db, id, accountId, environment)
  if (!plan) {
    throw new NotFoundError(`Plan not found: ${id}`)
  }
  return plan
}

/**
 * Archive a plan (set active=false). Does not delete existing subscriptions.
 */
export async function archivePlan(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<PlanRow> {
  // Ensure the plan exists first
  await getPlan(db, id, accountId, environment)

  return archivePlanQuery(db, id, accountId, environment)
}

/**
 * List plans with cursor-based pagination and optional active filter.
 */
export async function listPlans(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  pagination: PaginationParams,
  filters?: PlanFilters,
): Promise<PaginatedResponse<PlanRow>> {
  const limit = normalizePaginationLimit(pagination.limit)

  const rows = await listPlansWithCursor(
    db, accountId, environment, limit + 1, pagination.starting_after, filters,
  )

  return paginateResults(rows, limit)
}
