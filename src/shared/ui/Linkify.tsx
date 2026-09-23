import { Fragment, type ReactNode } from 'react'

const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]}]/gi

/** Renders plain text with http(s) links made clickable. Never injects HTML. */
export function Linkify({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const index = match.index
    if (index > last) parts.push(text.slice(last, index))
    parts.push(
      <a key={index} href={match[0]} target="_blank" rel="noopener noreferrer nofollow">
        {match[0]}
      </a>,
    )
    last = index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <Fragment>{parts}</Fragment>
}
