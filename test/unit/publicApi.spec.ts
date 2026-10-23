// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * The public API: every name each entry point exports, values and types. A
 * change here changes the package's API, so it should be on purpose and show
 * up in review. Update with `./dev.sh pnpm test -u`.
 */

const root = path.resolve(import.meta.dirname, '../..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  exports: Record<string, { types: string }>
}
const entries = Object.fromEntries(
  Object.entries(pkg.exports).map(([entry, { types }]) => [entry, path.join(root, types)]),
)

/** Every exported symbol of every entry point, by entry, as the TypeScript compiler sees it. */
const exportsByEntry = () => {
  const program = ts.createProgram(Object.values(entries), {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
  })
  const checker = program.getTypeChecker()

  return Object.entries(entries).map(([entry, file]) => {
    const source = program.getSourceFile(file)
    const moduleSymbol = source && checker.getSymbolAtLocation(source)
    if (!moduleSymbol) throw new Error(`Cannot read ${file}`)
    const symbols = checker.getExportsOfModule(moduleSymbol).map((symbol) => {
      const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
      return {
        documented: ts.displayPartsToString(target.getDocumentationComment(checker)).trim() !== '',
        name: target.flags & ts.SymbolFlags.Value ? symbol.name : `type ${symbol.name}`,
      }
    })
    return { entry, symbols }
  })
}

const exportedNames = (): Record<string, string[]> =>
  Object.fromEntries(
    exportsByEntry().map(({ entry, symbols }) => [
      entry,
      symbols
        .map(({ name }) => name)
        .sort((a, b) => a.replace('type ', '').localeCompare(b.replace('type ', ''))),
    ]),
  )

describe('public API', () => {
  it('exports these names from each entry point', () => {
    expect(exportedNames()).toMatchInlineSnapshot(`
      {
        ".": [
          "type CollectionFramingOptions",
          "DEFAULT_CACHE_CONTROL",
          "DEFAULT_EDITOR_PATH",
          "DEFAULT_ENDPOINT_PATH",
          "DEFAULT_PREVIEW_SHAPES",
          "DEFAULT_USAGE_EDITOR_PATH",
          "DEFAULT_USAGE_FIELD_NAME",
          "diskCache",
          "type ExposedFraming",
          "type FramingAccess",
          "type FramingStorage",
          "type FramingStorageFactory",
          "handlerStorage",
          "imageFramingPlugin",
          "type ImageFramingPluginOptions",
          "type ImageFramingTranslationKey",
          "type ImageFramingTranslations",
          "localDiskStorage",
          "type MediaDoc",
          "type PreviewShape",
          "translations",
          "type UsageOptions",
        ],
        "./client": [
          "FramingCanvas",
          "type FramingCanvasProps",
          "FramingEditor",
          "type PreviewFrame",
          "PreviewStrip",
          "UsageFramingField",
          "type UsageFramingFieldProps",
        ],
        "./core": [
          "type Breakpoint",
          "type BreakpointInfo",
          "type BreakpointName",
          "type CoverArea",
          "croppedSize",
          "DEFAULT_ASPECT_VARIABLE",
          "DEFAULT_FOCUS_SIZE",
          "DEFAULT_FRAMING",
          "DEFAULT_MAX_SIZE",
          "DEFAULT_VARIABLE",
          "type DefaultBreakpoint",
          "defaultFocusArea",
          "defineFraming",
          "type Frame",
          "frameAspectCss",
          "frameAspectVariables",
          "framedImageClasses",
          "framePositionCss",
          "type FramePositionCssOptions",
          "type FrameRule",
          "type Frames",
          "frameVariable",
          "type Framing",
          "type FramingConfig",
          "type FramingOverride",
          "type FramingSource",
          "FULL_RECT",
          "isCompleteRect",
          "isFramable",
          "isFullRect",
          "isRectInside",
          "type Label",
          "labelText",
          "matchFrames",
          "MIN_SIZE",
          "normalizeRect",
          "objectPosition",
          "previewPlacement",
          "type Rect",
          "rectCentre",
          "relativeRect",
          "type ResolvedFrame",
          "resolveFrames",
          "resolveFraming",
          "type StoredRect",
          "visibleRect",
          "type VisibleRectInput",
        ],
        "./next": [
          "type FrameableMedia",
          "FramedImage",
          "type FramedImageProps",
          "type FramedResource",
          "frameImage",
          "type FrameImageOptions",
          "type FrameImageResult",
        ],
        "./s3": [
          "objectKey",
          "s3FramingStorage",
          "type S3FramingStorageOptions",
        ],
        "./server": [
          "cropRoutePrefix",
          "cropToken",
          "cropUrl",
          "type CropUrlOptions",
          "type FrameableMedia",
          "type FramedResource",
          "frameImage",
          "type FrameImageOptions",
          "type FrameImageResult",
          "readCropToken",
          "type TokenContext",
        ],
      }
    `)
  }, 60_000)

  // Editors show these comments, and the README links to the API.
  it('documents every export with a comment', () => {
    const undocumented = exportsByEntry().flatMap(({ entry, symbols }) =>
      symbols.filter((symbol) => !symbol.documented).map(({ name }) => `${entry}: ${name}`),
    )

    expect(undocumented).toEqual([])
  }, 60_000)
})
