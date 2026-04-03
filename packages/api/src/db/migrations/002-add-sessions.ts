import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('accounts')
    .addColumn('session_token_hash', 'varchar(255)')
    .execute()

  await db.schema
    .alterTable('accounts')
    .addColumn('session_token_prefix', 'varchar(12)')
    .execute()

  await db.schema
    .alterTable('accounts')
    .addColumn('session_expires_at', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('idx_accounts_session_prefix')
    .on('accounts')
    .column('session_token_prefix')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('idx_accounts_session_prefix')
    .ifExists()
    .execute()

  await sql`ALTER TABLE accounts DROP COLUMN IF EXISTS session_token_hash`.execute(db)
  await sql`ALTER TABLE accounts DROP COLUMN IF EXISTS session_token_prefix`.execute(db)
  await sql`ALTER TABLE accounts DROP COLUMN IF EXISTS session_expires_at`.execute(db)
}
