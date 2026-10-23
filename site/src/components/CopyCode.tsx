import { useState } from 'react'

/** A one-line shell command with a copy button. */
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // No clipboard access (e.g. not HTTPS): the text can still be selected.
    }
  }

  return (
    <div className="copy-code">
      <code>{code}</code>
      <button onClick={copy} type="button">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
