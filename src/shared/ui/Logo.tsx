/** Round brand mark with a paper plane; stays Telegram blue in both themes, as in Telegram. */
export function Logo({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Telegram Web"
    >
      <circle cx="60" cy="60" r="60" fill="var(--telegram-blue)" />
      <path
        d="M27 58.5 84.7 36.3c2.7-1 5 .6 4.1 4.7l-9.8 46.2c-.7 3.3-2.7 4.1-5.5 2.6L58.6 78.6l-7.2 7c-.8.8-1.5 1.5-3.1 1.5l1.1-15.4 28-25.3c1.2-1.1-.3-1.7-1.9-.6L40.9 67.6l-14.9-4.7c-3.2-1-3.3-3.2.9-4.4Z"
        fill="#fff"
      />
    </svg>
  )
}
