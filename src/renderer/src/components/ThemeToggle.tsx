import { useAppDispatch, useAppSelector } from '../store'
import { toggleTheme } from '../store/uiSlice'

export default function ThemeToggle({ className }: { className?: string }): React.JSX.Element {
  const dispatch = useAppDispatch()
  const theme = useAppSelector((s) => s.ui.theme)

  return (
    <button
      className={`navbar__icon-btn ${className || ''}`}
      onClick={() => dispatch(toggleTheme())}
      title="Toggle theme"
    >
      <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
    </button>
  )
}
