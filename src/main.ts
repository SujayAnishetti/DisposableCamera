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

declare class ImageCapture {
  constructor(videoTrack: MediaStreamTrack)
  takePhoto(): Promise<Blob>
}

let imageCapture: ImageCapture | null = null

// Start camera
async function startCamera(front: boolean) {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop())
  }

  const constraints = {
    video: {
      facingMode: front ? 'user' : 'environment',
      width: { ideal: 9999 }, // Try to get max res
      height: { ideal: 9999 }
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    video.srcObject = stream
    currentStream = stream
    usingFrontCamera = front

    const [track] = stream.getVideoTracks()
    imageCapture = new ImageCapture(track)

    const settings = track.getSettings()
    console.log(`🎥 Camera running at ${settings.width}x${settings.height}`)
  } catch (err) {
    console.error("Camera error:", err)
    alert("Couldn't access the camera.")
  }
}

// Take photo using ImageCapture or fallback to canvas
snapBtn.onclick = () => {
  if (imageCapture && 'takePhoto' in imageCapture) {
    imageCapture.takePhoto().then(blob => {
      console.log('📸 Captured photo via ImageCapture.')
      enqueueImage(blob)
    }).catch(err => {
      console.warn('❌ ImageCapture failed, falling back to canvas.', err)
      fallbackToCanvasCapture()
    })
  } else {
    fallbackToCanvasCapture()
  }
}

// Fallback if ImageCapture fails or is unsupported
function fallbackToCanvasCapture() {
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
