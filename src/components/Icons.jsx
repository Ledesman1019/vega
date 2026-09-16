// Íconos en SVG puro (sin librerías externas) para no agregar dependencias nuevas al proyecto.
const base = 'currentColor'

export function IconBarcode({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round">
      <path d="M4 5v14M8 5v14M11 5v14M15 5v14M18 5v14M21 5v14" />
    </svg>
  )
}

export function IconCalendar({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
    </svg>
  )
}

export function IconBox({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinejoin="round">
      <path d="M12 2.5 21 7v10l-9 4.5-9-4.5V7l9-4.5Z" />
      <path d="M3 7l9 4.5 9-4.5M12 11.5V21.5" />
    </svg>
  )
}

export function IconTagArrow({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12.5 3 6a1 1 0 0 1 1-1h6.5l10 10-7 7-10-10Z" />
      <circle cx="7.5" cy="8.5" r="1.2" fill={base} stroke="none" />
    </svg>
  )
}

export function IconZap({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="none">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  )
}

export function IconShield({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4.5 5.5v6c0 5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.5 7.5-9.5v-6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function IconGauge({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15 15.5 9" />
      <circle cx="12" cy="15" r="1.2" fill={base} stroke="none" />
    </svg>
  )
}

export function IconChevronDown({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function IconArrowLeft({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  )
}

export function IconPortrait({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2">
      <rect x="6" y="3" width="12" height="18" rx="1.5" />
    </svg>
  )
}

export function IconLandscape({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2">
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
    </svg>
  )
}

export function IconDownload({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

export function IconPrinter({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M6 14h12v7H6v-7Z" />
    </svg>
  )
}