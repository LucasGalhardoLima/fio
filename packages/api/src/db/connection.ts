import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { Database } from './types.js'

const { Pool } = pg

export function createDatabase(connectionString?: string): Kysely<Database> {
  const pool = new Pool({
    connectionString: connectionString ?? process.env['DATABASE_URL'],
    max: 20,
  })

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  })
}

let db: Kysely<Database> | undefined

export function getDatabase(): Kysely<Database> {
  if (!db) {
    db = createDatabase()
  }
  return db
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy()
    db = undefined
  }
}
