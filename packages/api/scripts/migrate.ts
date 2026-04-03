import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import { up as up001 } from '../src/db/migrations/001-initial-schema.js'
import { up as up002 } from '../src/db/migrations/002-add-sessions.js'

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL']
  if (!connectionString) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const db = new Kysely<Record<string, unknown>>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString,
        ssl: process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: false } : false,
      }),
    }),
  })

  try {
    // Check if base schema exists
    const tableResult = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'accounts'
      )
    `.execute(db)

    if (!tableResult.rows[0]?.exists) {
      await up001(db)
      console.log('Migration 001 complete')
    } else {
      console.log('Migration 001 already applied — skipping')
    }

    // Check if session columns exist
    const columnResult = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'accounts'
          AND column_name = 'session_token_hash'
      )
    `.execute(db)

    if (!columnResult.rows[0]?.exists) {
      await up002(db)
      console.log('Migration 002 complete')
    } else {
      console.log('Migration 002 already applied — skipping')
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Migration error:', msg)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

main()
