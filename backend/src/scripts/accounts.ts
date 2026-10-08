/**
 * Creates or updates ONLY the test logins (see seedAccounts.ts). Safe to run
 * against the shared Atlas database: unlike `npm run seed` it leaves
 * conditions and walk records alone.
 *
 *   npm run accounts
 */
import { config } from '../config'
import { connectDb, disconnectDb } from '../db'
import { upsertSeedAccounts } from './seedAccounts'

async function main() {
  await connectDb()
  console.log(`[accounts] database "${config.MONGODB_DB_NAME}"`)
  await upsertSeedAccounts((line) => console.log(`[accounts] ${line}`))
  await disconnectDb()
  console.log('[accounts] done')
}

main().catch((err) => {
  console.error('[accounts] failed', err)
  process.exit(1)
})
