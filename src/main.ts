import { uploadImage } from './uploadcare'

const video = document.getElementById('camera') as HTMLVideoElement
const canvas = document.createElement('canvas') // hidden canvas for image processing
const snapBtn = document.getElementById('snap') as HTMLButtonElement
const flipBtn = document.getElementById('flip') as HTMLButtonElement
const context = canvas.getContext('2d')!

const progressBar = document.getElementById('upload-progress') as HTMLProgressElement
const progressLabel = document.getElementById('upload-status') as HTMLDivElement
const progressContainer = document.getElementById('progress-container')!

let currentStream: MediaStream | null = null
let usingFrontCamera = true
const uploadQueue: Blob[] = []
let isUploading = false
let uploadedCount = 0

// Start camera with desired facing mode
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

// Take photo and enqueue for upload
snapBtn.onclick = () => {
  const width = video.videoWidth
  const height = video.videoHeight
  canvas.width = width
  canvas.height = height

  context.filter = 'grayscale(0.3) contrast(1.2) brightness(1.1)'

  if (usingFrontCamera) {
    context.save()
    context.scale(-1, 1) // mirror for front camera
    context.drawImage(video, -width, 0, width, height)
    context.restore()
  } else {
    context.drawImage(video, 0, 0, width, height)
  }

  canvas.toBlob((blob) => {
    if (!blob) return
    enqueueImage(blob)
  }, 'image/jpeg', 0.9)
}

// Flip camera
flipBtn.onclick = () => {
  startCamera(!usingFrontCamera)
}

// Upload queue logic
function enqueueImage(blob: Blob) {
  uploadQueue.push(blob)
  updateProgress()
  processQueue()
}

async function processQueue() {
  if (isUploading || uploadQueue.length === 0) return

  isUploading = true
  const blob = uploadQueue.shift()!

  updateProgress()

  try {
    await uploadImage(blob)
    uploadedCount++
    console.log("✅ Uploaded one image.")
  } catch (err) {
    console.error("❌ Upload failed, re-queuing...", err)
    uploadQueue.unshift(blob)
    await wait(5000)
  }

  isUploading = false
  updateProgress()
  processQueue()
}

function updateProgress() {
  const total = uploadedCount + uploadQueue.length
  progressBar.max = total
  progressBar.value = uploadedCount
  progressLabel.textContent = `${uploadedCount} / ${total} uploaded`
  progressContainer.style.display = total === 0 ? 'none' : 'block'
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Start app
startCamera(true)
