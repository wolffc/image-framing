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

In the admin, once a page's header has an image, its status line shows a
button, **Crop differently for the header**, and small previews of the
header's frames, one per breakpoint; they follow the crop and the layout
before you save. The button opens a drawer that edits this usage's crop on
the whole photo (the media's crop dotted) and previews it in the header's
frames, phones and desktop, with the covered part hatched. Switch the header's layout and the preview follows.

- `frames.ts` has the frame rules: the first rule whose `when` matches the
  fields next to the image picks the frames. The plugin (admin preview) and
  the page (rendering, `matchFrames`) share them.
- `usages` in `payload.config.ts` names the upload fields by path:
  `<collection or global>.<field path>`, or `block:<block slug>.<field path>`.
- A usage can set its own texts for its summary and drawer with
  `admin.texts`, as the header does for its button and status line; a string,
  or one per language. The CTA block and the logo keep the plugin's texts
  (**Adjust the framing here**).
- Each usage stores its override in an `imageFraming` group next to the upload
  field; pass it to `<FramedImage override={…}>` or `frameImage`.
