import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import '../styles/Toast.css'
import { registerToastHandler, clearToastHandler, nextToastId } from '../utils/toast'

const Toast = ({ message, type, onClose }) => {
  const icons = {
    success: <CheckCircle size={20} />,
    error: <XCircle size={20} />,
    warning: <AlertCircle size={20} />,
    info: <Info size={20} />
  }

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-icon">{icons[type]}</div>
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  )
}

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    registerToastHandler((message, type, duration) => {
      const id = nextToastId()
      setToasts(prev => [...prev, { id, message, type }])

      if (duration > 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id))
        }, duration)
      }
    })

    return () => {
      clearToastHandler()
    }
  }, [])

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

export default ToastContainer
