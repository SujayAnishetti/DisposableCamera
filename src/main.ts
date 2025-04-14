import { uploadImage } from './uploadcare'
import { addToQueue, getAllQueued, removeFirstFromQueue } from './db'

const video = document.getElementById('camera') as HTMLVideoElement
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const snapBtn = document.getElementById('snap') as HTMLButtonElement
const flipIcon = document.getElementById('flip-icon') as HTMLDivElement
const context = canvas.getContext('2d')!

const progressBar = document.getElementById('upload-progress') as HTMLProgressElement
const statusText = document.getElementById('upload-status') as HTMLDivElement

let currentStream: MediaStream | null = null
let usingFrontCamera = true
let isUploading = false
let uploadedCount = 0
const uploadQueue: Blob[] = []

// Start camera
async function startCamera(front: boolean) {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop())
  }

  const constraints = {
    video: {
      facingMode: front ? 'user' : { exact: 'environment' }
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    video.srcObject = stream
    currentStream = stream
    usingFrontCamera = front

    // Apply CSS mirror flip for front camera
    video.style.transform = front ? 'scaleX(-1)' : 'scaleX(1)'
  } catch (err) {
    console.error("Camera error:", err)
    alert("Couldn't access the camera.")
  }
}

// Take photo
snapBtn.onclick = () => {
  const width = video.videoWidth
  const height = video.videoHeight
  canvas.width = width
  canvas.height = height

  // Optional: apply slight zoom crop to reduce distortion
  const scale = 1.1 // zoom factor
  const zoomW = width / scale
  const zoomH = height / scale
  const offsetX = (width - zoomW) / 2
  const offsetY = (height - zoomH) / 2

  context.save()
  context.filter = 'grayscale(0.3) contrast(1.2) brightness(1.1)'

  if (usingFrontCamera) {
    context.translate(width, 0)
    context.scale(-1, 1)
  }

  context.drawImage(video, offsetX, offsetY, zoomW, zoomH, 0, 0, width, height)
  context.restore()

  canvas.toBlob(blob => {
    if (!blob) return
    enqueueImage(blob)
  }, 'image/jpeg', 0.9)
}

// Flip camera (flip icon)
flipIcon.onclick = () => {
  usingFrontCamera = !usingFrontCamera
  startCamera(usingFrontCamera)
}

// Add image to upload queue
function enqueueImage(blob: Blob) {
  uploadQueue.push(blob)
  addToQueue(blob)
  processQueue()
}

// Handle the upload queue
async function processQueue() {
  if (isUploading || uploadQueue.length === 0) return

  isUploading = true
  const blob = uploadQueue.shift()!

  try {
    await uploadImage(blob)
    await removeFirstFromQueue()
    uploadedCount++
    console.log("✅ Uploaded one image.")
  } catch (err) {
    console.error("❌ Upload failed. Retrying later...", err)
    uploadQueue.unshift(blob)
    await wait(5000)
  }

  updateProgressUI()
  isUploading = false
  processQueue()
}

// Update progress bar UI
function updateProgressUI() {
  const total = uploadedCount + uploadQueue.length
  const uploaded = uploadedCount

  progressBar.max = total
  progressBar.value = uploaded

  statusText.textContent = `${uploaded} / ${total} uploaded`

  // Hide progress UI when idle
  const visible = total > 0
  progressBar.style.visibility = visible ? 'visible' : 'hidden'
  statusText.style.visibility = visible ? 'visible' : 'hidden'
}

// Delay helper
function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Load previously queued blobs from IndexedDB
getAllQueued().then(blobs => {
  uploadedCount = 0
  blobs.forEach(blob => uploadQueue.push(blob))
  updateProgressUI()
  processQueue()
})

// Start with front camera
startCamera(true)

// Prevent double-tap zoom and pinch on mobile
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false })
document.addEventListener('wheel', e => {
  if (e.ctrlKey) e.preventDefault()
}, { passive: false })
