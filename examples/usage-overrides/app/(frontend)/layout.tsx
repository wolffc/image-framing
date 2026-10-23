import type { ReactNode } from 'react'

import './styles.css'

export const metadata = { title: 'Image framing: per-usage overrides' }

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
