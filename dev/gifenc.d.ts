declare module 'gifenc' {
  type Palette = number[][]
  export function quantize(rgba: Uint8Array, maxColors: number, options?: object): Palette
  export function applyPalette(rgba: Uint8Array, palette: Palette, format?: string): Uint8Array
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: Palette; delay?: number; repeat?: number },
    ): void
    finish(): void
    bytes(): Uint8Array
  }
}
