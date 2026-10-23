# Custom breakpoints: phone, tablet, desktop

`framing.config.ts` defines three breakpoints once, for the plugin (the usage
drawer previews each, with its label) and for the page (one CSS variable per
breakpoint). The page applies them with plain CSS from the helpers, without
Tailwind and without `next/image`.

```bash
cp .env.example .env
npm install
npx payload generate:importmap
npm run dev
```

Resize the window on http://localhost:3000: the hero changes from 4:5 to 16:9
at 768 px and to 21:9 at 1280 px, keeping the focus area in view, and on
desktop away from the left 40 %.

- `defineFraming({ breakpoints })`: `base` always, every other breakpoint from
  its `minWidth` up. A breakpoint without a frame uses the next smaller one's.
- `framePositionCss(framing, '.hero img')` and `frameAspectCss(framing, '.hero')`
  write the media queries; `{ query: 'container' }` writes container queries.
- With Tailwind, `framedImageClasses(framing)` gives the class string, e.g.
  `object-[var(--frame-pos)] min-[768px]:object-[var(--frame-pos-md)] min-[1280px]:object-[var(--frame-pos-lg)]`.
  Copy it into your code or safelist it: Tailwind only generates classes it
  finds in your source.
- The usage is the top-level upload field `hero`; its own crop and focus area
  are stored next to it in `imageFraming` and passed as `override`.
