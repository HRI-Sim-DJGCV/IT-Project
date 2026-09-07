import mongoose from 'mongoose'
import { config } from './config'

// One client for the process lifetime. Mongoose pools connections internally.
export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true)
  await mongoose.connect(config.MONGODB_URI, {
    dbName: config.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 15_000,
    autoIndex: false, // indexes are managed explicitly by syncIndexes() below
  })
}

/**
 * Makes the indexes on our collections match the schemas (creates missing,
 * drops ones we no longer declare)
 */
export async function syncIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()))
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect()
}

export function dbState(): 'connected' | 'disconnected' {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
}
