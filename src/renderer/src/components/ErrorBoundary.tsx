import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer crashed', error, info.componentStack)
  }

  reset = (): void => this.setState({ error: null })

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="error-boundary">
        <h2>Something went wrong</h2>
        <pre>{this.state.error.message}</pre>
        <button className="hw-btn" onClick={this.reset}>
          <span className="hw-btn__face hw-btn__face--active">Try again</span>
        </button>
        <button className="hw-btn" onClick={() => window.location.reload()}>
          <span className="hw-btn__face hw-btn__face--default">Reload window</span>
        </button>
      </div>
    )
  }
}
