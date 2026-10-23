# Per-usage overrides, frame rules and cover areas

A page header whose frames depend on its `layout` select, with text covering
the left 45 % of the wide layout on larger screens; a `cta` block; a logo in a
global. Each of these usages can set its own crop and focus area: narrower or
wider than the one on the media, up to the whole photo.

```bash
cp .env.example .env
npm install
npx payload generate:importmap
npm run dev
```

In the admin, a page's header image shows **Adjust the framing here**. The
drawer edits this usage's crop on the whole photo (the media's crop dotted) and
previews it in the header's frames, phones and desktop, with the covered part
hatched. Switch the header's layout and the preview follows.

- `frames.ts` has the frame rules: the first rule whose `when` matches the
  fields next to the image picks the frames. The plugin (admin preview) and
  the page (rendering, `matchFrames`) share them.
- `usages` in `payload.config.ts` names the upload fields by path:
  `<collection or global>.<field path>`, or `block:<block slug>.<field path>`.
- Each usage stores its override in an `imageFraming` group next to the upload
  field; pass it to `<FramedImage override={…}>` or `frameImage`.
