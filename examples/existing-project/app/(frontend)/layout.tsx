import type { ReactNode } from 'react'

import './styles.css'

export const metadata = { title: 'Image framing: adding the plugin to an existing project' }

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
