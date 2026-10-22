import type { ReactNode } from 'react'

import './styles.css'

export const metadata = { title: 'Image framing dev app' }

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
