import type { Kysely } from 'kysely'
import type {
  Database,
  PlanRow,
  NewPlan,
} from '../types.js'

export async function insertPlan(
  db: Kysely<Database>,
  plan: NewPlan,
): Promise<PlanRow> {
  return db
    .insertInto('plans')
    .values(plan)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findPlanById(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<PlanRow | undefined> {
  return db
    .selectFrom('plans')
    .selectAll()
    .where('id', '=', id)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .executeTakeFirst()
}

export async function archivePlan(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<PlanRow> {
  return db
    .updateTable('plans')
    .set({ active: false })
    .where('id', '=', id)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .returningAll()
    .executeTakeFirstOrThrow()
}

interface PlanFilters {
  active?: boolean
}

export async function listPlansWithCursor(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  limit: number,
  startingAfter?: string,
  filters?: PlanFilters,
): Promise<PlanRow[]> {
  let query = db
    .selectFrom('plans')
    .selectAll()
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)

  if (startingAfter !== undefined) {
    query = query.where('id', '>', startingAfter)
  }

  if (filters?.active !== undefined) {
    query = query.where('active', '=', filters.active)
  }

  return query
    .orderBy('id', 'asc')
    .limit(limit)
    .execute()
}
