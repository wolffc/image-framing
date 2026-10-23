/**
 * A frontend that only sees Payload's REST API: it reads a page and renders
 * the hero image with the framing the CMS computed (usage option `expose`).
 * No secret, no plugin code needed here.
 */

const CMS = 'https://cms.example.com'

interface Exposed {
  url: string
  width?: number | null
  height?: number | null
  alt?: string | null
  style: Record<string, string>
}

/** The CSS that applies the variables per breakpoint (from `framePositionCss`, written once). */
export const css =
  '.hero img{object-position:var(--frame-pos)} @media (min-width:768px){.hero img{object-position:var(--frame-pos-md)}}'

export const renderHero = async (pageId: string): Promise<string> => {
  const page = (await (await fetch(`${CMS}/api/pages/${pageId}?depth=0`)).json()) as {
    hero?: { imageFramed?: Exposed | null }
  }
  const framed = page.hero?.imageFramed
  if (!framed) return ''

  const variables = Object.entries(framed.style)
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
  // The URL is relative to the CMS, unless it runs with a serverURL.
  const src = framed.url.startsWith('/') ? `${CMS}${framed.url}` : framed.url
  return `<div class="hero" style="${variables}"><img src="${src}" width="${framed.width}" height="${framed.height}" alt="${framed.alt ?? ''}" style="width:100%;height:100%;object-fit:cover"></div>`
}
