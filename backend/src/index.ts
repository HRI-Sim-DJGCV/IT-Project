import { mkdir } from 'node:fs/promises'
import { createApp } from './app'
import { config } from './config'
import { connectDb, disconnectDb, syncIndexes } from './db'
// Importing the models registers them so syncIndexes() sees all of them.
import './models/Account'
import './models/Condition'
import './models/WalkPreparation'
import './models/WalkRecord'
import { aiClient } from './services/aiClient'
import { failStalePreparations } from './services/preparation'

async function main() {
  await connectDb()
  await syncIndexes()
  console.log(`[api] connected to MongoDB database "${config.MONGODB_DB_NAME}", indexes synced`)
  await mkdir(config.audioDir, { recursive: true })
  const stale = await failStalePreparations()
  if (stale) console.log(`[api] marked ${stale} interrupted walk preparation(s) as failed`)
  console.log(
    `[api] AI service ${config.AI_SERVICE_URL} is ${(await aiClient.health()) ? 'reachable' : 'NOT reachable (routes and scripts will fail until it is up)'}`,
  )
  const server = createApp().listen(config.PORT, () => {
    console.log(`[api] listening on http://localhost:${config.PORT}/v1`)
  })
  const shutdown = async () => {
    server.close()
    await disconnectDb()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[api] failed to start', err)
  process.exit(1)
})
