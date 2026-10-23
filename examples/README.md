# Examples

| Example                                      | What                                                                                                        | Kind         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------ |
| [quick-start](quick-start)                   | One media collection, a page showing the photos with `<FramedImage>`                                        | Runnable app |
| [usage-overrides](usage-overrides)           | Frame rules by a layout select, cover areas, a block and a global with their own crops                      | Runnable app |
| [breakpoints](breakpoints)                   | Phone, tablet and desktop from one `defineFraming`, applied with plain CSS                                  | Runnable app |
| [existing-project](existing-project)         | Adding the plugin to a project with media: what changes, migrations, backfill and size regeneration scripts | Runnable app |
| [cloud-storage](cloud-storage)               | `@payloadcms/storage-s3` (S3, R2, MinIO) with `s3FramingStorage`                                            | Snippet      |
| [without-next](without-next)                 | Plain React and Astro with `frameImage` and the CSS helpers                                                 | Snippet      |
| [multiple-collections](multiple-collections) | Several framed collections with their own options and a custom API route                                    | Snippet      |
| [headless](headless)                         | REST and GraphQL clients with the usage option `expose`                                                     | Snippet      |

The runnable apps are small Payload + Next projects using SQLite: copy one,
then `cp .env.example .env && npm install && npm run dev`. CI builds each of
them against the packed package (`pnpm build:examples`). The repository's
[dev app](../dev) shows everything together.
