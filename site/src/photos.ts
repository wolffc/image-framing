import type { Rect } from '@wolffc80/payload-image-framing/core'

export interface Photo {
  id: string
  title: string
  /** What the subject is and where, for the photo picker. */
  note: string
  src: string
  width: number
  height: number
  /** The framing an editor would set: the part to show and the subject. */
  crop: Rect
  focus: Rect
}

const src = (name: string) => `${import.meta.env.BASE_URL}photos/${name}.svg`

/** Drawings made for this site (CC0), with their subjects in different places. */
export const photos: Photo[] = [
  {
    id: 'sailboat',
    title: 'Sailboat',
    note: 'subject on the right',
    src: src('sailboat'),
    width: 2400,
    height: 1350,
    crop: { x: 8, y: 6, width: 88, height: 90 },
    focus: { x: 69, y: 39, width: 13, height: 27 },
  },
  {
    id: 'lighthouse',
    title: 'Lighthouse',
    note: 'tall subject, portrait photo',
    src: src('lighthouse'),
    width: 1600,
    height: 2000,
    crop: { x: 0, y: 8, width: 100, height: 84 },
    focus: { x: 26, y: 24, width: 16, height: 48 },
  },
  {
    id: 'balloon',
    title: 'Balloon',
    note: 'small subject, lots of sky',
    src: src('balloon'),
    width: 2400,
    height: 1600,
    crop: { x: 0, y: 0, width: 100, height: 100 },
    focus: { x: 22, y: 17, width: 11, height: 26 },
  },
  {
    id: 'tree',
    title: 'Tree',
    note: 'subject in the left third',
    src: src('tree'),
    width: 2400,
    height: 1200,
    crop: { x: 4, y: 4, width: 92, height: 92 },
    focus: { x: 22, y: 19, width: 16, height: 38 },
  },
]
