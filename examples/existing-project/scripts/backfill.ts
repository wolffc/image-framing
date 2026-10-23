/**
 * Gives every media document that has no crop area yet the defaults the
 * plugin would give it on its next save: the whole photo as crop area, and a
 * focus area of 30 % around Payload's focal point. Optional: until then the
 * plugin treats missing rects the same way.
 *
 *   npx payload run scripts/backfill.ts
 */
import config from '@payload-config'
import { getPayload } from 'payload'

const payload = await getPayload({ config })

let page = 1
let updated = 0
for (;;) {
  const { docs, hasNextPage } = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 50,
    page,
    pagination: true,
  })
  for (const doc of docs) {
    if (typeof doc.crop?.width === 'number') continue
    // An empty update: the plugin fills in the rects before saving.
    await payload.update({ collection: 'media', data: {}, id: doc.id })
    updated++
  }
  if (!hasNextPage) break
  page++
}

payload.logger.info(`Backfilled the crop and focus area of ${updated} media documents.`)
process.exit(0)
