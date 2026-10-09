import { PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_SIZE } from '@stock/shared'

/**
 * Prepara una foto de perfil en el navegador, antes de subirla: recorta el centro en cuadrado
 * (como hacen las redes sociales), la achica a 256 px y la comprime. Así una foto de 8 MB del
 * celular viaja y se guarda en unos 20 KB.
 *
 * Intenta WebP; si el navegador no sabe generarlo (algunas versiones de Safari devuelven PNG),
 * usa JPEG, que todos generan. La API acepta los dos.
 */
export async function toSquarePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Elegí un archivo de imagen (JPG, PNG o WebP).')

  let bitmap: ImageBitmap
  try {
    // imageOrientation: respeta la rotación que guarda el celular en los datos de la foto.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('No pudimos leer esa imagen. Probá con otra (JPG, PNG o WebP).')
  }

  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = PROFILE_PHOTO_SIZE
  canvas.height = PROFILE_PHOTO_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Tu navegador no pudo preparar la foto.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SIZE)
  bitmap.close()

  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))
  let blob = await encode('image/webp')
  if (blob?.type !== 'image/webp') blob = await encode('image/jpeg')
  if (!blob) throw new Error('Tu navegador no pudo preparar la foto.')
  if (blob.size > PROFILE_PHOTO_MAX_BYTES) throw new Error('La foto quedó demasiado pesada. Probá con otra.')
  return blob
}
