import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('UI error', error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="grid min-h-screen place-items-center bg-paper p-6 dark:bg-navy-950">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-2xl font-extrabold">Something went wrong</h1>
          <p className="mt-2 text-sm text-navy-400">The page hit an unexpected problem. Your data is safe. Reload to try again.</p>
          <button className="btn btn-primary mt-6" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    )
  }
}
