/**
 * Rebuilds the image sizes of every media document from its crop area, e.g.
 * after adding an image size or changing its shape. The plugin rebuilds them
 * on its own when a crop changes; this forces it for unchanged documents.
 *
 *   npx payload run scripts/regenerate-sizes.ts
 */
import config from '@payload-config'
import { getPayload } from 'payload'

const payload = await getPayload({ config })

let page = 1
let rebuilt = 0
for (;;) {
  const { docs, hasNextPage } = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 50,
    page,
  })
  for (const doc of docs) {
    await payload.update({
      collection: 'media',
      context: { imageFraming: { rebuild: true } },
      data: {},
      id: doc.id,
    })
    rebuilt++
  }
  if (!hasNextPage) break
  page++
}

payload.logger.info(`Rebuilt the image sizes of ${rebuilt} media documents.`)
process.exit(0)
