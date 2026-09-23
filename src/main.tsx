import '@fontsource-variable/roboto'
// Before App: the global base layer must come first, so component modules override it
// (e.g. rows and buttons that draw their own focus ring instead of the fallback outline).
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
