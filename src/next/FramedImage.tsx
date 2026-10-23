import * as nextImage from 'next/image.js'
import type { ImageProps } from 'next/image.js'
import React, { type ComponentType, type CSSProperties } from 'react'

import {
  DEFAULT_FRAMING,
  DEFAULT_VARIABLE,
  type DefaultBreakpoint,
  frameAspectCss,
  frameAspectVariables,
  framePositionCss,
  type FramingConfig,
} from '../core/index.js'
import { frameImage, type FrameImageOptions } from '../server/frameImage.js'

/** Props of `<FramedImage>`: `frameImage`'s options, `next/image`'s props and the box's. */
export type FramedImageProps<K extends string = DefaultBreakpoint> = FrameImageOptions<K> &
  Omit<ImageProps, 'alt' | 'fill' | 'height' | 'src' | 'width'> & {
    /** Default: the media's `alt`. */
    alt?: string
    /** Class of the box around the image (the image gets `className`). */
    boxClassName?: string
    /** Style of the box around the image. */
    boxStyle?: CSSProperties
    /**
     * Give the box the frame's shape per breakpoint (default). Turn it off to
     * size the box yourself; the image fills it either way.
     */
    shaped?: boolean
  }

/**
 * `next/image`'s component. The module is CommonJS: bundlers hand over the
 * component as its default export, Node's ESM loader the exports object, whose
 * `default` is the component.
 */
const Image = (() => {
  let value: unknown = nextImage
  while (value && typeof value === 'object' && !('$$typeof' in value) && 'default' in value) {
    value = (value as { default: unknown }).default
  }
  return value as ComponentType<ImageProps>
})()

/** A short, stable name for a framing config and variable, for class names. */
const key = (framing: FramingConfig<string>, variable: string) => {
  const text = JSON.stringify([framing.breakpoints.map((b) => [b.name, b.minWidth]), variable])
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = (hash * 33) ^ text.charCodeAt(i)
  return (hash >>> 0).toString(36)
}

/**
 * A framed media document with `next/image`, for server components: the
 * cropped copy fills a box of the frame's shape, positioned around the focus
 * area per breakpoint. The positions and shapes come from one small
 * stylesheet per framing config (deduplicated by React), so no Tailwind is
 * needed. It calls `frameImage`, so it runs on the server only.
 *
 * ```tsx
 * <FramedImage media={page.image} override={page.imageFraming} framing={framing}
 *   frames={{ base: { aspect: 4 / 5 }, lg: { aspect: 21 / 9 } }} secret={process.env.PAYLOAD_SECRET!}
 *   sizes="100vw" priority />
 * ```
 *
 * Without `frames` it renders the (cropped) photo in its own shape.
 */
export function FramedImage<K extends string = DefaultBreakpoint>({
  alt,
  baseUrl,
  boxClassName,
  boxStyle,
  className,
  frames,
  framing,
  maxSize,
  media,
  override,
  routePrefix,
  secret,
  shaped = true,
  sizes,
  style,
  variable = DEFAULT_VARIABLE,
  ...imageProps
}: FramedImageProps<K>) {
  const { resource, style: positions } = frameImage({
    baseUrl,
    frames,
    framing,
    maxSize,
    media,
    override,
    routePrefix,
    secret,
    variable,
  })
  const text = alt ?? resource.alt ?? ''

  if (!frames) {
    return (
      <Image
        {...imageProps}
        alt={text}
        className={className}
        height={resource.height ?? undefined}
        sizes={sizes}
        src={resource.url}
        style={style}
        width={resource.width ?? undefined}
      />
    )
  }

  const config = (framing ?? DEFAULT_FRAMING) as FramingConfig<K>
  const name = `framed-${key(config, variable)}`
  const css = [
    framePositionCss(config, `.${name}-image`, { variable }),
    shaped ? frameAspectCss(config, `.${name}`) : '',
  ].join(' ')

  return (
    <div
      className={[name, boxClassName].filter(Boolean).join(' ')}
      style={{
        overflow: 'hidden',
        position: 'relative',
        ...positions,
        ...(shaped ? frameAspectVariables(config, frames) : {}),
        ...boxStyle,
      }}
    >
      <style href={name} precedence="image-framing">
        {css}
      </style>
      <Image
        {...imageProps}
        alt={text}
        className={[`${name}-image`, className].filter(Boolean).join(' ')}
        fill
        sizes={sizes ?? '100vw'}
        src={resource.url}
        style={{ objectFit: 'cover', ...style }}
      />
    </div>
  )
}
