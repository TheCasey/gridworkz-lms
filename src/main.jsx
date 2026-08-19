import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const renderApp = async () => {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    const { connectLocalFirebaseEmulators } = await import('./firebase/firebaseEmulators.js')
    connectLocalFirebaseEmulators()
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

renderApp().catch((error) => {
  console.error('Unable to initialize the application:', error)
})
