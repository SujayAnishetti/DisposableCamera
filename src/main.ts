import { uploadImage } from './uploadcare'

const video = document.getElementById('camera') as HTMLVideoElement
const canvas = document.createElement('canvas') // hidden, no longer in DOM
const snapBtn = document.getElementById('snap') as HTMLButtonElement
const flipBtn = document.getElementById('flip') as HTMLButtonElement
const context = canvas.getContext('2d')!

let currentStream: MediaStream | null = null
let usingFrontCamera = true
const uploadQueue: Blob[] = []
let isUploading = false

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

  canvas.toBlob((blob) => {
    if (!blob) return
    enqueueImage(blob)
    alert("✅ Captured! Uploading in background...")
  }, 'image/jpeg', 0.9)
}

// Flip camera
flipBtn.onclick = () => {
  startCamera(!usingFrontCamera)
}

// Start with front camera
startCamera(true)

// Upload queue handler
function enqueueImage(blob: Blob) {
  uploadQueue.push(blob)
  processQueue()
}

async function processQueue() {
  if (isUploading || uploadQueue.length === 0) return

  isUploading = true
  const blob = uploadQueue.shift()!

  try {
    await uploadImage(blob)
    console.log("✅ Uploaded one image.")
  } catch (err) {
    console.error("❌ Upload failed, re-queuing...", err)
    uploadQueue.unshift(blob)
    await wait(5000) // retry after 5 seconds
  }

  isUploading = false
  processQueue()
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
