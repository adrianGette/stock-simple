import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

describe('Content-Security-Policy de netlify.toml', () => {
  const csp = /Content-Security-Policy = "([^"]+)"/.exec(read('../../../netlify.toml'))?.[1] ?? ''

  it('autoriza exactamente los scripts en línea de index.html', () => {
    const inline = [...read('../index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!)
    expect(inline.length).toBeGreaterThan(0)
    for (const script of inline) {
      const hash = createHash('sha256').update(script).digest('base64')
      // Si falla: alguien editó el script de index.html. Actualizá el hash en netlify.toml.
      expect(csp).toContain(`'sha256-${hash}'`)
    }
  })

  it('no permite scripts arbitrarios ni ser embebida por cualquier sitio', () => {
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(csp).toContain("object-src 'none'")
    expect(csp).toMatch(/frame-ancestors 'self'/)
  })
})

describe('cabeceras de nginx (imagen Docker de la web)', () => {
  it('usa exactamente la misma CSP que Netlify', () => {
    const netlify = /Content-Security-Policy = "([^"]+)"/.exec(read('../../../netlify.toml'))?.[1]
    const nginx = /add_header Content-Security-Policy "([^"]+)" always;/.exec(read('../nginx/security-headers.conf'))?.[1]
    expect(nginx).toBeTruthy()
    expect(nginx).toBe(netlify)
  })

  it('aplica las cabeceras de seguridad en cada location que sirve la web', () => {
    const conf = read('../nginx/default.conf')
    for (const location of ['/assets/', '/']) {
      const block = new RegExp(`location ${location.replace(/\//g, '\\/')} \\{([^}]*)\\}`).exec(conf)?.[1] ?? ''
      expect(block).toContain('include /etc/nginx/snippets/security-headers.conf;')
    }
  })
})

