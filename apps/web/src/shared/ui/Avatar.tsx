import { useUserPhoto } from '../hooks/useUserPhoto'
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
  /** Id de la persona: elige el color y, junto con `photoVersion`, trae su foto. */
  userId?: string
  /** Versión de la foto de perfil (null o ausente: sin foto, se muestran las iniciales). */
  photoVersion?: string | null
  /** Imagen a mostrar directamente (p. ej. la vista previa antes de subirla). */
  photoUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Avatar({ name, userId, photoVersion, photoUrl, size = 'md' }: AvatarProps) {
  const stored = useUserPhoto(photoUrl ? undefined : userId, photoVersion)
  const src = photoUrl ?? stored
  const className = [styles.avatar, styles[size]].join(' ')
  // Mientras la foto carga (o si falla) se ven las iniciales: nunca un hueco vacío.
  if (src) return <img className={className} src={src} alt="" />
  return (
    <span className={className} style={{ background: GRADIENTS[hash(userId ?? name) % GRADIENTS.length] }} aria-hidden>
      {initials(name)}
    </span>
  )
}
