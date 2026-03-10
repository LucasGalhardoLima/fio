import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import { up } from '../src/db/migrations/001-initial-schema.js'

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
        ssl: { rejectUnauthorized: false },
      }),
    }),
  })

  try {
    // Check if schema already exists
    const result = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'accounts'
      )
    `.execute(db)

    if (result.rows[0]?.exists) {
      console.log('Schema already exists — skipping migration')
      return
    }

    await up(db)
    console.log('Migration complete')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Migration error:', msg)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

main()
