import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import './i18n/config' // Initialize i18n

console.log(`%c Build: ${__BUILD_TIMESTAMP__} `, 'background: #222; color: #bada55; padding: 4px; border-radius: 4px;');

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
)

// [UI Tuning] Initialize slideVars in development mode
import { initSlideVars } from './utils/slideVars';
initSlideVars();
