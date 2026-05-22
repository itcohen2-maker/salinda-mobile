import * as React from 'react'
import { createRoot } from 'react-dom/client'

import { HiddenRuleExperience } from './app'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Missing root element')
}

document.documentElement.lang = 'he'
document.documentElement.dir = 'rtl'

createRoot(rootElement).render(
  <React.StrictMode>
    <HiddenRuleExperience />
  </React.StrictMode>,
)
