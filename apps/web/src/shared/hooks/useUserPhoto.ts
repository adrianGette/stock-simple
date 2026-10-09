import { useQuery } from '@tanstack/react-query'
import { fetchBlob } from '../../lib/api-client'
import { blobToDataUrl } from '../lib/blob-to-data-url'

/**
 * Foto de perfil de una persona, lista para un <img>. Un <img src> no puede mandar el token (vive en
 * memoria), así que la foto se pide como cualquier otro dato y se guarda en caché ya convertida a
 * "data:": aunque la persona aparezca en 20 filas, se descarga una sola vez. La versión va en la clave
 * y en la URL, así una foto nueva nunca muestra la anterior.
 */
export function useUserPhoto(userId: string | undefined, version: string | null | undefined): string | null {
  const photo = useQuery({
    queryKey: ['user-photo', userId, version],
    queryFn: async ({ signal }) => blobToDataUrl(await fetchBlob(`/users/${userId}/photo`, { query: { v: version }, signal })),
    enabled: Boolean(userId && version),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    retry: false,
  })
  return photo.data ?? null
}
