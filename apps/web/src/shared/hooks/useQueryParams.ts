import { useSearchParams } from 'react-router'

/**
 * Filtros, orden y página viven en la URL: se pueden compartir, recargar y volver atrás sin perderlos.
 * `update` escribe varios a la vez (null o '' borra el parámetro) y, salvo que el cambio sea la
 * página, vuelve a la primera: con otro filtro u otro orden, la página anterior ya no significa nada.
 */
export function useQueryParams() {
  const [params, setParams] = useSearchParams()

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('pagina' in changes)) next.delete('pagina')
        return next
      },
      { replace: true },
    )

  return [params, update] as const
}
