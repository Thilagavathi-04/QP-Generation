import React, { useRef } from 'react'
import { X } from 'lucide-react'
import '../styles/Modal.css'

const Modal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'confirm', showInput = false, inputPlaceholder = '', defaultValue = '' }) => {
  const inputRef = useRef(null)

  if (!isOpen) return null

  const handleConfirm = () => {
    if (showInput) {
      onConfirm(inputRef.current?.value ?? '')
    } else {
      onConfirm()
    }
    onClose()
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && showInput) {
      handleConfirm()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
          {showInput && (
            <input
              type="text"
              className="modal-input"
              placeholder={inputPlaceholder}
              defaultValue={defaultValue}
              ref={inputRef}
              onKeyPress={handleKeyPress}
              autoFocus
            />
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {cancelText}
          </button>
          <button 
            className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Modal
