import { createApp } from './app'
import { config } from './config'
import { connectDb, disconnectDb, syncIndexes } from './db'
// Importing the models registers them so syncIndexes() sees all three.
import './models/Account'
import './models/Condition'
import './models/WalkRecord'

async function main() {
  await connectDb()
  await syncIndexes()
  console.log(`[api] connected to MongoDB database "${config.MONGODB_DB_NAME}", indexes synced`)
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
