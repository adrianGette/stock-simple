import { PRODUCT_IMPORT_MAX_BYTES } from '@stock/shared'
import { useState } from 'react'
import { ApiError, errorMessage } from '../../lib/api-client'

const MAX_MB = Math.round(PRODUCT_IMPORT_MAX_BYTES / 1024 / 1024)

/**
 * Lo común de subir una planilla en dos pasos (importar productos, conteo de inventario): elegir el
 * archivo, controlar el tamaño, pedir la vista previa y guardar el resultado o el problema.
 * `confirm` aplica el archivo y, si la API lo rechaza por errores, muestra la revisión nueva.
 */
export function useCsvPreview<P>(requestPreview: (file: File) => Promise<P>) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<P | null>(null)
  const [checking, setChecking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  function reset() {
    setFile(null)
    setPreview(null)
    setProblem(null)
  }

  async function check(selected: File | undefined) {
    if (!selected) return
    setFile(selected)
    setPreview(null)
    setProblem(null)
    if (selected.size > PRODUCT_IMPORT_MAX_BYTES) return setProblem(`El archivo supera el máximo de ${MAX_MB} MB.`)
    setChecking(true)
    try {
      setPreview(await requestPreview(selected))
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setChecking(false)
    }
  }

  /** Aplica el archivo elegido. Devuelve el resultado, o null si falló (el problema queda a la vista). */
  async function confirm<R>(apply: (file: File) => Promise<R>): Promise<R | null> {
    if (!file) return null
    try {
      return await apply(file)
    } catch (error) {
      // Entre la vista previa y la confirmación algo cambió: la API devuelve la revisión nueva.
      if (error instanceof ApiError && error.code === 'IMPORT_INVALID') setPreview(error.details as P)
      else setProblem(errorMessage(error))
      return null
    }
  }

  return { file, preview, checking, problem, check, confirm, reset }
}
