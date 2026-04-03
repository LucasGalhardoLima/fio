import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Enable UUID generation
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db)

  // --- accounts ---
  await db.schema
    .createTable('accounts')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // --- api_keys ---
  await db.schema
    .createTable('api_keys')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('account_id', 'uuid', (col) =>
      col.references('accounts.id').onDelete('cascade').notNull(),
    )
    .addColumn('key_hash', 'varchar(255)', (col) => col.notNull())
    .addColumn('key_prefix', 'varchar(32)', (col) => col.notNull())
    .addColumn('environment', 'varchar(4)', (col) =>
      col.notNull().check(sql`environment IN ('test', 'live')`),
    )
    .addColumn('name', 'varchar(255)')
    .addColumn('expires_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_api_keys_prefix')
    .on('api_keys')
    .column('key_prefix')
    .execute()

  await db.schema
    .createIndex('idx_api_keys_account_env')
    .on('api_keys')
    .columns(['account_id', 'environment'])
    .execute()

  // --- customers ---
  await db.schema
    .createTable('customers')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('account_id', 'uuid', (col) =>
      col.references('accounts.id').onDelete('cascade').notNull(),
    )
    .addColumn('environment', 'varchar(4)', (col) => col.notNull())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('email', 'varchar(255)', (col) => col.notNull())
    .addColumn('tax_id', 'varchar(14)', (col) => col.notNull())
    .addColumn('tax_id_type', 'varchar(4)', (col) =>
      col.notNull().check(sql`tax_id_type IN ('cpf', 'cnpj')`),
    )
    .addColumn('pix_automatico_consent_id', 'varchar(255)')
    .addColumn('pix_automatico_consent_status', 'varchar(32)')
    .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_customers_account_env_email')
    .on('customers')
    .columns(['account_id', 'environment', 'email'])
    .unique()
    .execute()

  await db.schema
    .createIndex('idx_customers_account_env_tax_id')
    .on('customers')
    .columns(['account_id', 'environment', 'tax_id'])
    .unique()
    .execute()

  await db.schema
    .createIndex('idx_customers_account_env_created')
    .on('customers')
    .columns(['account_id', 'environment', 'created_at'])
    .execute()

  // --- plans ---
  await db.schema
    .createTable('plans')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('account_id', 'uuid', (col) =>
      col.references('accounts.id').onDelete('cascade').notNull(),
    )
    .addColumn('environment', 'varchar(4)', (col) => col.notNull())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('amount', 'integer', (col) => col.notNull().check(sql`amount >= 100`))
    .addColumn('currency', 'varchar(3)', (col) => col.notNull().defaultTo('BRL'))
    .addColumn('interval', 'varchar(5)', (col) =>
      col.notNull().check(sql`interval IN ('week', 'month', 'year')`),
    )
    .addColumn('trial_days', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('payment_methods', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'["pix"]'::jsonb`),
    )
    .addColumn('dunning_schedule', 'jsonb', (col) =>
      col.defaultTo(sql`'[1, 3, 7]'::jsonb`),
    )
    .addColumn('active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_plans_account_env_active')
    .on('plans')
    .columns(['account_id', 'environment', 'active'])
    .execute()

  // --- subscriptions ---
  await db.schema
    .createTable('subscriptions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('account_id', 'uuid', (col) =>
      col.references('accounts.id').onDelete('cascade').notNull(),
    )
    .addColumn('environment', 'varchar(4)', (col) => col.notNull())
    .addColumn('customer_id', 'uuid', (col) =>
      col.references('customers.id').onDelete('restrict').notNull(),
    )
    .addColumn('plan_id', 'uuid', (col) =>
      col.references('plans.id').onDelete('restrict').notNull(),
    )
    .addColumn('status', 'varchar(10)', (col) =>
      col.notNull().check(
        sql`status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')`,
      ),
    )
    .addColumn('current_period_start', 'timestamptz', (col) => col.notNull())
    .addColumn('current_period_end', 'timestamptz', (col) => col.notNull())
    .addColumn('trial_end', 'timestamptz')
    .addColumn('cancel_at_period_end', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('canceled_at', 'timestamptz')
    .addColumn('cancellation_reason', 'varchar(50)')
    .addColumn('paused_at', 'timestamptz')
    .addColumn('pix_automatico', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_subs_account_env_status')
    .on('subscriptions')
    .columns(['account_id', 'environment', 'status'])
    .execute()

  await db.schema
    .createIndex('idx_subs_account_env_customer')
    .on('subscriptions')
    .columns(['account_id', 'environment', 'customer_id'])
    .execute()

  await db.schema
    .createIndex('idx_subs_period_end_status')
    .on('subscriptions')
    .columns(['current_period_end', 'status'])
    .execute()

  // --- invoices ---
  await db.schema
    .createTable('invoices')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('account_id', 'uuid', (col) =>
      col.references('accounts.id').onDelete('cascade').notNull(),
    )
    .addColumn('environment', 'varchar(4)', (col) => col.notNull())
    .addColumn('subscription_id', 'uuid', (col) =>
      col.references('subscriptions.id').onDelete('restrict').notNull(),
    )
    .addColumn('customer_id', 'uuid', (col) =>
      col.references('customers.id').onDelete('restrict').notNull(),
    )
    .addColumn('charge_id', 'uuid')
    .addColumn('amount', 'integer', (col) => col.notNull())
    .addColumn('status', 'varchar(6)', (col) =>
      col.notNull().check(sql`status IN ('draft', 'open', 'paid', 'failed', 'void')`),
    )
    .addColumn('period_start', 'timestamptz', (col) => col.notNull())
    .addColumn('period_end', 'timestamptz', (col) => col.notNull())
    .addColumn('due_date', 'date', (col) => col.notNull())
    .addColumn('paid_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_invoices_sub_period')
    .on('invoices')
    .columns(['subscription_id', 'period_start'])
    .execute()

  await db.schema
    .createIndex('idx_invoices_account_env_status')
    .on('invoices')
    .columns(['account_id', 'environment', 'status'])
    .execute()

  // --- charges ---
  await db.schema
    .createTable('charges')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('account_id', 'uuid', (col) =>
      col.references('accounts.id').onDelete('cascade').notNull(),
    )
    .addColumn('environment', 'varchar(4)', (col) => col.notNull())
    .addColumn('customer_id', 'uuid', (col) =>
      col.references('customers.id').onDelete('restrict').notNull(),
    )
    .addColumn('invoice_id', 'uuid')
    .addColumn('amount', 'integer', (col) => col.notNull().check(sql`amount >= 100`))
    .addColumn('status', 'varchar(20)', (col) =>
      col.notNull().check(
        sql`status IN ('pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded')`,
      ),
    )
    .addColumn('payment_method_type', 'varchar(6)', (col) =>
      col.notNull().defaultTo('pix'),
    )
    .addColumn('pix_qr_code', 'text')
    .addColumn('pix_qr_code_image', 'text')
    .addColumn('pix_copy_paste', 'text')
    .addColumn('pix_end_to_end_id', 'varchar(50)')
    .addColumn('provider', 'varchar(20)', (col) => col.notNull().defaultTo('efi'))
    .addColumn('provider_reference', 'varchar(100)')
    .addColumn('idempotency_key', 'varchar(255)')
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('paid_at', 'timestamptz')
    .addColumn('refunded_amount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Unique idempotency key per account (partial index)
  await sql`CREATE UNIQUE INDEX idx_charges_idempotency
    ON charges (account_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL`.execute(db)

  await db.schema
    .createIndex('idx_charges_account_env_status')
    .on('charges')
    .columns(['account_id', 'environment', 'status'])
    .execute()

  await db.schema
    .createIndex('idx_charges_provider_ref')
    .on('charges')
    .columns(['provider', 'provider_reference'])
    .execute()

  await db.schema
    .createIndex('idx_charges_expires_status')
    .on('charges')
    .columns(['expires_at', 'status'])
    .execute()

  // --- events ---
  await db.schema
    .createTable('events')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('account_id', 'uuid', (col) =>
      col.references('accounts.id').onDelete('cascade').notNull(),
    )
    .addColumn('environment', 'varchar(4)', (col) => col.notNull())
    .addColumn('event_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('entity_type', 'varchar(20)', (col) => col.notNull())
    .addColumn('entity_id', 'uuid', (col) => col.notNull())
    .addColumn('data', 'jsonb', (col) => col.notNull())
    .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('idempotency_key', 'varchar(255)')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_events_account_type_created')
    .on('events')
    .columns(['account_id', 'environment', 'event_type', 'created_at'])
    .execute()

  await db.schema
    .createIndex('idx_events_entity')
    .on('events')
    .columns(['entity_type', 'entity_id', 'created_at'])
    .execute()

  await sql`CREATE UNIQUE INDEX idx_events_idempotency
    ON events (idempotency_key)
    WHERE idempotency_key IS NOT NULL`.execute(db)

  // --- webhook_endpoints ---
  await db.schema
    .createTable('webhook_endpoints')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('account_id', 'uuid', (col) =>
      col.references('accounts.id').onDelete('cascade').notNull(),
    )
    .addColumn('environment', 'varchar(4)', (col) => col.notNull())
    .addColumn('url', 'varchar(2048)', (col) => col.notNull())
    .addColumn('secret', 'varchar(255)', (col) => col.notNull())
    .addColumn('event_types', 'jsonb')
    .addColumn('active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_webhook_endpoints_account_env')
    .on('webhook_endpoints')
    .columns(['account_id', 'environment', 'active'])
    .execute()

  // --- webhook_deliveries ---
  await db.schema
    .createTable('webhook_deliveries')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('webhook_endpoint_id', 'uuid', (col) =>
      col.references('webhook_endpoints.id').onDelete('cascade').notNull(),
    )
    .addColumn('event_id', 'uuid', (col) =>
      col.references('events.id').onDelete('cascade').notNull(),
    )
    .addColumn('status', 'varchar(10)', (col) =>
      col.notNull().check(sql`status IN ('pending', 'delivered', 'failed')`),
    )
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('max_attempts', 'integer', (col) => col.notNull().defaultTo(5))
    .addColumn('next_attempt_at', 'timestamptz')
    .addColumn('last_attempt_at', 'timestamptz')
    .addColumn('response_status_code', 'integer')
    .addColumn('response_body', 'text')
    .addColumn('response_time_ms', 'integer')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_webhook_deliveries_retry')
    .on('webhook_deliveries')
    .columns(['status', 'next_attempt_at'])
    .execute()

  await db.schema
    .createIndex('idx_webhook_deliveries_endpoint_created')
    .on('webhook_deliveries')
    .columns(['webhook_endpoint_id', 'created_at'])
    .execute()

  // --- idempotency_keys ---
  await db.schema
    .createTable('idempotency_keys')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('account_id', 'uuid', (col) =>
      col.references('accounts.id').onDelete('cascade').notNull(),
    )
    .addColumn('key', 'varchar(255)', (col) => col.notNull())
    .addColumn('method', 'varchar(6)', (col) => col.notNull())
    .addColumn('path', 'varchar(500)', (col) => col.notNull())
    .addColumn('response_status', 'integer', (col) => col.notNull())
    .addColumn('response_body', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex('idx_idempotency_keys_account_key')
    .on('idempotency_keys')
    .columns(['account_id', 'key'])
    .unique()
    .execute()

  await db.schema
    .createIndex('idx_idempotency_keys_expires')
    .on('idempotency_keys')
    .column('expires_at')
    .execute()

  // Add FK from invoices.charge_id to charges.id (after charges table exists)
  await db.schema
    .alterTable('invoices')
    .addForeignKeyConstraint('fk_invoices_charge', ['charge_id'], 'charges', ['id'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('invoices').dropConstraint('fk_invoices_charge').execute()

  const tables = [
    'idempotency_keys',
    'webhook_deliveries',
    'webhook_endpoints',
    'events',
    'charges',
    'invoices',
    'subscriptions',
    'plans',
    'customers',
    'api_keys',
    'accounts',
  ] as const

  for (const table of tables) {
    await db.schema.dropTable(table).ifExists().execute()
  }
}
