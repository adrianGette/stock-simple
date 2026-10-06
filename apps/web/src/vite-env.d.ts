/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API. En desarrollo se usa el proxy de Vite (/api). */
  readonly VITE_API_URL?: string
  /** Muestra los accesos rápidos con usuarios de demostración en el login. */
  readonly VITE_SHOW_DEMO_USERS?: string
}
