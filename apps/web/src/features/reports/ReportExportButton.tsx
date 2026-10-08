import type { ReportRange, ReportSection } from '@stock/shared'
import { useDownload } from '../../shared/hooks/useDownload'
import { Button } from '../../shared/ui/Button'
import { exportReport } from './api'

/** Descarga una sección del reporte como CSV. `description` completa la etiqueta accesible ("Descargar CSV de …"). */
export function ReportExportButton({ section, range, description }: { section: ReportSection; range: ReportRange; description: string }) {
  const { downloading, download } = useDownload()
  const label = `Descargar CSV de ${description}`
  return (
    <Button
      size="sm"
      variant="ghost"
      icon="download"
      loading={downloading}
      aria-label={label}
      title={label}
      onClick={() => download(() => exportReport(section, range))}
    >
      CSV
    </Button>
  )
}
