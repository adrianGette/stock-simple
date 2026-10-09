import styles from './Avatar.module.css'

// Degradados de los avatares: cada persona tiene siempre el mismo, así se la reconoce de un vistazo.
const GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #a855f7)',
  'linear-gradient(135deg, #0ea5e9, #6366f1)',
  'linear-gradient(135deg, #14b8a6, #0ea5e9)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #ec4899, #8b5cf6)',
  'linear-gradient(135deg, #22c55e, #14b8a6)',
]

/** Índice estable a partir de un texto (un id o el nombre): el mismo texto da siempre el mismo color. */
function hash(text: string): number {
  let value = 0
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0
  return value
}

/** "Laura Méndez" → "LM"; "Sofía" → "S". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words
  return letters.map((word) => word![0]!.toUpperCase()).join('')
}

interface AvatarProps {
  name: string
  /** Para elegir el color; si no se pasa, se usa el nombre. */
  seed?: string
  /** Foto de perfil; sin foto se muestran las iniciales. */
  photoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ name, seed, photoUrl, size = 'md' }: AvatarProps) {
  const className = [styles.avatar, styles[size]].join(' ')
  if (photoUrl) return <img className={className} src={photoUrl} alt="" />
  return (
    <span className={className} style={{ background: GRADIENTS[hash(seed ?? name) % GRADIENTS.length] }} aria-hidden>
      {initials(name)}
    </span>
  )
}
