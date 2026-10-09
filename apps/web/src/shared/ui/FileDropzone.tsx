import { type DragEvent, useRef, useState } from 'react'
import styles from './FileDropzone.module.css'
import { Icon, type IconName } from './Icon'

interface FileDropzoneProps {
  /** Tipos aceptados, como en <input accept>: ".csv,text/csv" o "image/*". */
  accept: string
  onFile: (file: File) => void
  title: string
  hint?: string
  icon?: IconName
  /** Archivo ya elegido: se muestra su nombre y la zona invita a cambiarlo. */
  fileName?: string | null
  disabled?: boolean
}

/**
 * Zona para soltar un archivo arrastrándolo, o hacer clic (o Enter) para elegirlo. Es un botón:
 * se puede usar con teclado y lector de pantalla; arrastrar es un atajo para el mouse.
 */
export function FileDropzone({ accept, onFile, title, hint, icon = 'upload', fileName, disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file && !disabled) onFile(file)
  }

  return (
    <>
      <button
        type="button"
        className={[styles.zone, dragging && styles.dragging, fileName && styles.filled].filter(Boolean).join(' ')}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className={styles.icon} aria-hidden>
          <Icon name={fileName ? 'check' : icon} size={20} />
        </span>
        <span className={styles.title}>{fileName ?? title}</span>
        <span className={styles.hint}>{fileName ? 'Hacé clic o arrastrá otro archivo para cambiarlo' : hint}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Se limpia para poder volver a elegir el mismo archivo después de corregirlo.
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
    </>
  )
}
