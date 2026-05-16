import { useRef, useLayoutEffect } from 'react'

export interface MenuItem {
  icon: string
  label: string
  onClick: () => void
  danger?: boolean
}

export const DIVIDER: MenuItem = { icon: '', label: '__divider__', onClick: () => {} }

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
  anchor?: 'top' | 'bottom'
}

export default function ContextMenu({ x, y, items, onClose, anchor = 'top' }: ContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const clampedX = Math.min(x, window.innerWidth - rect.width - 8)
    const clampedY = anchor === 'bottom'
      ? Math.max(8, window.innerHeight - y - rect.height)
      : Math.min(y, window.innerHeight - rect.height - 8)
    el.style.left = `${Math.max(8, clampedX)}px`
    if (anchor === 'bottom') {
      el.style.bottom = `${clampedY}px`
    } else {
      el.style.top = `${clampedY}px`
    }
  }, [x, y, anchor])

  return (
    <>
      <div className="context-menu__backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        ref={menuRef}
        className="context-menu"
        style={anchor === 'bottom'
          ? { left: x, bottom: window.innerHeight - y }
          : { left: x, top: y }
        }
      >
        {items.map((item, i) =>
          item.label === '__divider__' ? (
            <div key={i} className="context-menu__divider" />
          ) : (
            <button
              key={i}
              className={`context-menu__item${item.danger ? ' context-menu__item--danger' : ''}`}
              onClick={() => { item.onClick(); onClose() }}
            >
              <i className={`fa-solid ${item.icon} context-menu__item-icon`} />
              {item.label}
            </button>
          )
        )}
      </div>
    </>
  )
}
