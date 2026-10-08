import { useState } from 'react'
import { errorMessage } from '../../lib/api-client'
import { useToast } from '../ui/Toast'

/** Estado de una descarga: mientras corre, el botón muestra que está trabajando; si falla, avisa con un toast. */
export function useDownload() {
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)

  async function download(run: () => Promise<void>) {
    setDownloading(true)
    try {
      await run()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  return { downloading, download }
}
