---
'@wolffc80/payload-image-framing': minor
---

A usage's status line now shows small previews of its frames, one per breakpoint, next to "Crop differently here", so editors see how the photo is framed on each screen without opening the drawer. They follow the crop and the sibling fields (e.g. the layout) before saving, and load a generated size of the photo instead of the original where one shows the right part. `PreviewStrip` takes `compact` for these small previews and `region` for a file that shows only part of the original.
