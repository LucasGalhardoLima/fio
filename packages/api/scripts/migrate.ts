import { Kysely, PostgresDialect } from 'kysely'
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
