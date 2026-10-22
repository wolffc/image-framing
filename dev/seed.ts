import type { Payload } from 'payload'

import { devUser } from './helpers/credentials.js'

/** Creates the dev admin user once. */
export const seed = async (payload: Payload) => {
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: { email: { equals: devUser.email } },
    overrideAccess: true,
  })
  if (!totalDocs) {
    await payload.create({ collection: 'users', data: devUser, overrideAccess: true })
  }
}
