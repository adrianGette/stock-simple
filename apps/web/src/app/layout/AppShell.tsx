import { ROLE_LABELS } from '@stock/shared'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth, useCurrentUser } from '../../features/auth/AuthProvider'
import { useTheme } from '../../shared/hooks/useTheme'
import { Button } from '../../shared/ui/Button'
import { Avatar } from '../../shared/ui/Avatar'
import { Dialog } from '../../shared/ui/Dialog'
import { Icon } from '../../shared/ui/Icon'
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from '../navigation'
import { ProfilePhotoDialog } from '../../features/users/ProfilePhotoDialog'
import { CommandPalette } from './CommandPalette'
import styles from './AppShell.module.css'

const link = (item: NavItem, onClick?: () => void) => (
  <NavLink key={item.to} to={item.to} className={styles.navLink} onClick={onClick}>
    <Icon name={item.icon} /> {item.label}
  </NavLink>
)

export function AppShell() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const { scheme, toggle } = useTheme()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)

  // Ctrl + K (Cmd + K en Mac) abre el buscador rápido desde cualquier pantalla.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

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
    <>
      <Avatar name={user.name} userId={user.id} photoVersion={user.photoVersion} />
      <span className={styles.userText}>
        <span className={styles.userName}>{user.name}</span>
        <span className={styles.userRole}>{ROLE_LABELS[user.role]}</span>
      </span>
    </>
  )


  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        {brand}
        <button type="button" className={styles.search} onClick={() => setPaletteOpen(true)}>
          <Icon name="search" size={16} />
          <span>Buscar…</span>
          <kbd className={styles.kbd}>{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <nav className={styles.nav} aria-label="Principal">
          {items.filter((item) => !item.group).map((item) => link(item))}
          {NAV_GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.group === group)
            if (groupItems.length === 0) return null
            return (
              <div key={group} className={styles.navGroup}>
                <span className={styles.navGroupTitle}>{group}</span>
                {groupItems.map((item) => link(item))}
              </div>
            )
          })}
        </nav>
        <div className={styles.userBox}>
          {/* Popover nativo: se cierra solo con Esc o tocando afuera, sin JavaScript propio. */}
          <button type="button" className={styles.userButton} popoverTarget="user-menu" aria-label={`Menú de ${user.name}`}>
            {userCard}
            <Icon name="chevronsUpDown" size={16} />
          </button>
          <div id="user-menu" popover="auto" className={styles.userMenu}>
            <button
              type="button"
              className={styles.menuItem}
              popoverTarget="user-menu"
              popoverTargetAction="hide"
              onClick={() => setPhotoOpen(true)}
            >
              <Icon name="camera" size={16} /> Foto de perfil
            </button>
            <button type="button" className={styles.menuItem} onClick={toggle}>
              <Icon name={scheme === 'dark' ? 'sun' : 'moon'} size={16} /> {themeLabel}
            </button>
            <button type="button" className={styles.menuItem} onClick={logout}>
              <Icon name="logout" size={16} /> Cerrar sesión
            </button>
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

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={items} />
      <ProfilePhotoDialog open={photoOpen} onClose={() => setPhotoOpen(false)} />

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Más opciones">
        <div className={styles.moreList}>
          <div className={styles.user}>{userCard}</div>
          <nav className={styles.nav} aria-label="Secundaria" style={{ marginTop: 'var(--space-3)' }}>
            {secondary.map((item) => link(item, () => setMoreOpen(false)))}
            <button
              type="button"
              className={styles.navLink}
              style={{ border: 0, background: 'none', cursor: 'pointer' }}
              onClick={() => {
                setMoreOpen(false)
                setPhotoOpen(true)
              }}
            >
              <Icon name="camera" /> Foto de perfil
            </button>
            <button type="button" className={styles.navLink} style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={logout}>
              <Icon name="logout" /> Cerrar sesión
            </button>
          </nav>
        </div>
      </Dialog>
    </div>
  )
}
