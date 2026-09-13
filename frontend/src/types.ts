// The domain types live in ../shared so the frontend and backend cannot drift.
// This file only re-exports them so imports of '../types' keep working.
export type * from '@shared/types'
