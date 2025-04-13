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
const uploadQueue: Blob[] = []

// Camera setup
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
  } catch (err) {
    console.error("Camera error:", err)
    alert("Couldn't access the camera.")
  }
}

// Take picture
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

// Queue handler
function enqueueImage(blob: Blob) {
  uploadQueue.push(blob)
  addToQueue(blob)
  updateProgressUI()
  processQueue()
}

async function processQueue() {
  if (isUploading || uploadQueue.length === 0) return

  isUploading = true
  const blob = uploadQueue.shift()!

  try {
    await uploadImage(blob)
    await removeFirstFromQueue()
    console.log("✅ Uploaded one image.")
  } catch (err) {
    console.error("❌ Upload failed. Will retry...", err)
    uploadQueue.unshift(blob)
    await wait(5000)
  }

  updateProgressUI()
  isUploading = false
  processQueue()
}

// Show progress
function updateProgressUI() {
  const total = uploadQueue.length + (isUploading ? 1 : 0)
  const uploaded = isUploading ? 1 : 0

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

// Delay util
function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Load existing queue from IndexedDB
getAllQueued().then(blobs => {
  blobs.forEach(blob => uploadQueue.push(blob))
  updateProgressUI()
  processQueue()
})

// Init camera
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

