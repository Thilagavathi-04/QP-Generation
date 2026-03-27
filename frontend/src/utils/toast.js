let toastId = 0
let addToastHandler = null

export const registerToastHandler = (handler) => {
  addToastHandler = handler
}

export const clearToastHandler = () => {
  addToastHandler = null
}

export const nextToastId = () => {
  const id = toastId
  toastId += 1
  return id
}

export const showToast = (message, type = 'info', duration = 3000) => {
  if (addToastHandler) {
    addToastHandler(message, type, duration)
  }
}
