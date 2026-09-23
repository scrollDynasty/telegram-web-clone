import clsx from 'clsx'
import { useState } from 'react'
import { initials } from '@/shared/lib/initials'
import styles from './Avatar.module.css'

const GRADIENTS = [
  ['#ff885e', '#ff516a'],
  ['#ffcd6a', '#ffa85c'],
  ['#82b1ff', '#665fff'],
  ['#a0de7e', '#54cb68'],
  ['#53edd6', '#28c9b7'],
  ['#72d5fd', '#2a9ef1'],
  ['#e0a2f3', '#d669ed'],
] as const

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

interface AvatarProps {
  /** Stable key for the color (e.g. chat id). */
  seed: string
  name: string
  src?: string
  size?: number
  /** Overrides the letter size derived from `size`. */
  fontSize?: number
  className?: string
}

export function Avatar({ seed, name, src, size = 48, fontSize, className }: AvatarProps) {
  const [broken, setBroken] = useState(false)
  const [from, to] = GRADIENTS[hash(seed) % GRADIENTS.length]!
  return (
    <span
      className={clsx(styles.avatar, className)}
      style={{
        width: size,
        height: size,
        // Telegram: letters are size / 2 - 4px, bold, rounded face.
        fontSize: fontSize ?? Math.max(Math.round(size / 2 - 4), 8),
        backgroundImage: `linear-gradient(180deg, ${from}, ${to})`,
      }}
      aria-hidden="true"
    >
      {src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : initials(name)}
    </span>
  )
}
