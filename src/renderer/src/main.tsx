import '@fortawesome/fontawesome-free/css/all.min.css'
import '@vscode/codicons/dist/codicon.css'
import './assets/main.css'

// Prevent Electron from navigating when files are dragged over the window
document.addEventListener('dragover', (e) => e.preventDefault())

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <App />
      </Provider>
    </ErrorBoundary>
  </StrictMode>
)
