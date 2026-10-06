import { ROLE_LABELS } from '@stock/shared'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth, useCurrentUser } from '../../features/auth/AuthProvider'
import { useTheme } from '../../shared/hooks/useTheme'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { Icon } from '../../shared/ui/Icon'
import { NAV_ITEMS } from '../navigation'
import styles from './AppShell.module.css'

export function AppShell() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const { scheme, toggle } = useTheme()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const items = NAV_ITEMS.filter((item) => user.can(item.permission))
  const primary = items.filter((item) => item.primary)
  const secondary = items.filter((item) => !item.primary)
  const themeLabel = scheme === 'dark' ? 'Modo claro' : 'Modo oscuro'

  const brand = (
    <div className={styles.brand}>
      <span className={styles.logoMark}>
        <Icon name="box" size={16} />
      </span>
      <span className={styles.brandText}>
        <span className={styles.brandName}>Stock Simple</span>
        <span className={styles.businessName}>{user.business.name}</span>
      </span>
    </div>
  )

  const userCard = (
    <div className={styles.user}>
      <span className={styles.avatar} aria-hidden>
        {user.name[0]}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className={styles.userName}>{user.name}</span>
        <span className={styles.userRole}>{ROLE_LABELS[user.role]}</span>
      </span>
    </div>
  )

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        {brand}
        <nav className={styles.nav} aria-label="Principal">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={styles.navLink}>
              <Icon name={item.icon} /> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.userBox}>
          {userCard}
          <div className={styles.userActions}>
            <Button variant="ghost" size="sm" icon={scheme === 'dark' ? 'sun' : 'moon'} iconOnly onClick={toggle}>
              {themeLabel}
            </Button>
            <Button variant="ghost" size="sm" icon="logout" onClick={logout}>
              Salir
            </Button>
          </div>
        </div>
      </aside>

      <header className={styles.topbar}>
        {brand}
        <Button variant="ghost" size="sm" icon={scheme === 'dark' ? 'sun' : 'moon'} iconOnly onClick={toggle}>
          {themeLabel}
        </Button>
      </header>

      <main className={styles.main} id="contenido">
        <Outlet />
      </main>

      <nav className={styles.bottomNav} aria-label="Principal">
        {primary.map((item) => (
          <NavLink key={item.to} to={item.to} className={styles.tab}>
            <Icon name={item.icon} size={20} />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          className={styles.tab}
          onClick={() => setMoreOpen(true)}
          aria-current={secondary.some((i) => location.pathname.startsWith(i.to)) ? 'page' : undefined}
        >
          <Icon name="more" size={20} />
          Más
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Más opciones">
        <div className={styles.moreList}>
          {userCard}
          <nav className={styles.nav} aria-label="Secundaria" style={{ marginTop: 'var(--space-3)' }}>
            {secondary.map((item) => (
              <NavLink key={item.to} to={item.to} className={styles.navLink} onClick={() => setMoreOpen(false)}>
                <Icon name={item.icon} /> {item.label}
              </NavLink>
            ))}
            <button type="button" className={styles.navLink} style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={logout}>
              <Icon name="logout" /> Cerrar sesión
            </button>
          </nav>
        </div>
      </Dialog>
    </div>
  )
}
