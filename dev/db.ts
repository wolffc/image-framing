import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import fs from 'node:fs'
import path from 'node:path'
import type { Config } from 'payload'

/**
 * The database the dev app (and the integration tests) run on, by
 * DATABASE_URI: `postgres://…`, `mongodb://…`, or a SQLite file (`file:…`,
 * the default `dev/.data/dev.db`).
 */
export const database = (dataDir: string): Config['db'] => {
  const uri = process.env.DATABASE_URI || `file:${path.join(dataDir, 'dev.db')}`
  if (/^postgres(ql)?:/.test(uri)) return postgresAdapter({ pool: { connectionString: uri } })
  if (/^mongodb(\+srv)?:/.test(uri)) return mongooseAdapter({ url: uri })
  // SQLite does not create the directory of its database file.
  if (uri.startsWith('file:'))
    fs.mkdirSync(path.dirname(uri.slice('file:'.length)), { recursive: true })
  return sqliteAdapter({ client: { url: uri } })
}
