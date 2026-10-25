import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import Providers from './app/providers'
import AppRoutes from './app/router'
import ErrorBoundary from './components/common/ErrorBoundary'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Providers>
        <AppRoutes />
      </Providers>
    </ErrorBoundary>
  </React.StrictMode>,
)
