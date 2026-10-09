/** Una imagen chica (como una foto de perfil de ~20 KB) como texto "data:", listo para un <img>. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(reader.result as string), { once: true })
    reader.addEventListener('error', () => reject(reader.error ?? new Error('No se pudo leer la imagen')), { once: true })
    reader.readAsDataURL(blob)
  })
}
