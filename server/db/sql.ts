import postgres from 'postgres'

const DATABASE_URL = process.env.POSTGRES_URL

export const IS_MOCK_DB = !DATABASE_URL

let client: postgres.Sql | null = null

export function getSql(): postgres.Sql {
  if (!DATABASE_URL) {
    throw new Error('POSTGRES_URL is not configured')
  }

  if (!client) {
    client = postgres(DATABASE_URL, {
      max: 1,
      ssl: 'require',
    })
  }

  return client
}
