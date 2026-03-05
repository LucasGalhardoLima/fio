import crypto from 'node:crypto'
import argon2 from 'argon2'

const KEY_RANDOM_BYTES = 32
const KEY_PREFIX_LENGTH = 12

type Environment = 'test' | 'live'

const ENVIRONMENT_PREFIXES: Record<Environment, string> = {
  test: 'fio_test_',
  live: 'fio_live_',
}

/**
 * Generate a new API key for the given environment.
 * Format: fio_test_<32 random hex chars> or fio_live_<32 random hex chars>
 */
export function generateApiKey(environment: Environment): string {
  const prefix = ENVIRONMENT_PREFIXES[environment]
  const randomPart = crypto.randomBytes(KEY_RANDOM_BYTES).toString('hex')
  return `${prefix}${randomPart}`
}

/**
 * Hash an API key using argon2 for secure storage.
 */
export async function hashApiKey(key: string): Promise<string> {
  return argon2.hash(key)
}

/**
 * Verify a plaintext API key against a stored argon2 hash.
 */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, key)
  } catch {
    return false
  }
}

/**
 * Extract the key prefix (first 12 characters) used for database lookup.
 * The prefix is stored in plaintext to enable key lookup without hashing.
 */
export function extractKeyPrefix(key: string): string {
  return key.slice(0, KEY_PREFIX_LENGTH)
}

/**
 * Derive the environment ('test' or 'live') from an API key's prefix.
 */
export function getEnvironmentFromKey(key: string): Environment {
  if (key.startsWith(ENVIRONMENT_PREFIXES.test)) {
    return 'test'
  }
  if (key.startsWith(ENVIRONMENT_PREFIXES.live)) {
    return 'live'
  }
  throw new Error(`Invalid API key format. Key must start with ${ENVIRONMENT_PREFIXES.test} or ${ENVIRONMENT_PREFIXES.live}`)
}
