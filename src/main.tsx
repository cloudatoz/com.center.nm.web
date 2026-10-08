import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import Providers from './Provider'

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>,
)
