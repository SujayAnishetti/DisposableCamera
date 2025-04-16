import { uploadImage } from './uploadcare'
import { addToQueue, getAllQueued, removeFirstFromQueue } from './db'

const video = document.getElementById('camera') as HTMLVideoElement
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const snapBtn = document.getElementById('snap') as HTMLButtonElement
const flipBtn = document.getElementById('flip') as HTMLButtonElement
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
    video: front
      ? {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      : {
          facingMode: { exact: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    video.srcObject = stream
    currentStream = stream
    usingFrontCamera = front
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

  if (usingFrontCamera) {
    context.save()
    context.scale(-1, 1)
    context.filter = 'grayscale(0.3) contrast(1.2) brightness(1.1)'
    context.drawImage(video, -width, 0, width, height)
    context.restore()
  } else {
    context.filter = 'grayscale(0.3) contrast(1.2) brightness(1.1)'
    context.drawImage(video, 0, 0, width, height)
  }

  canvas.toBlob(blob => {
    if (!blob) return
    enqueueImage(blob)
  }, 'image/jpeg', 0.9)
}

// Flip camera
flipBtn.onclick = () => {
  startCamera(!usingFrontCamera)
}

// Add image to upload queue
function enqueueImage(blob: Blob) {
  uploadQueue.push(blob)
  addToQueue(blob)
  updateProgressUI()
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
  const total = uploadedCount + uploadQueue.length + (isUploading ? 1 : 0)
  const uploaded = uploadedCount + (isUploading ? 1 : 0)

  progressBar.max = total
  progressBar.value = uploaded

  statusText.textContent = `${uploaded} / ${total} uploaded`

  // Hide progress UI when idle
  if (total === 0) {
    progressBar.style.visibility = 'hidden'
    statusText.style.visibility = 'hidden'
  } else {
    progressBar.style.visibility = 'visible'
    statusText.style.visibility = 'visible'
  }
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

// Prevent double-tap zoom on mobile
document.addEventListener('dblclick', (event) => {
  event.preventDefault();
}, { passive: false });

// Prevent pinch-to-zoom
document.addEventListener('wheel', (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
  }
}, { passive: false });

