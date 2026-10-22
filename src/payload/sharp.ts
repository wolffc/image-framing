import type { Config, Payload, SanitizedConfig } from 'payload'

/** Payload's own sharp instance (`config.sharp`), so the app has one sharp version. */
export type Sharp = NonNullable<SanitizedConfig['sharp']>

export type ResizeOptions = NonNullable<Parameters<ReturnType<Sharp>['resize']>[0]>

const MISSING =
  "imageFraming: set `sharp` in the Payload config (`import sharp from 'sharp'` and " +
  '`buildConfig({ sharp, … })`). The plugin crops and resizes images with it.'

/** Throws at startup when the config has no sharp, rather than on the first upload. */
export const assertSharp = (config: Config): void => {
  if (!config.sharp) throw new Error(MISSING)
}

export const getSharp = (payload: Payload): Sharp => {
  const sharp = payload.config.sharp
  if (!sharp) throw new Error(MISSING)
  return sharp
}
