import { uploadImage } from './uploadcare'

const video = document.getElementById('camera') as HTMLVideoElement
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const snapBtn = document.getElementById('snap') as HTMLButtonElement
const uploadBtn = document.getElementById('upload') as HTMLButtonElement
const context = canvas.getContext('2d')!

navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  video.srcObject = stream
})

snapBtn.onclick = () => {
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  context.filter = 'grayscale(0.3) contrast(1.2) brightness(1.1)' // basic filter
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  canvas.classList.remove('hidden')
  uploadBtn.disabled = false
}

uploadBtn.onclick = async () => {
  canvas.toBlob(async (blob) => {
    if (!blob) return
    uploadBtn.textContent = 'Uploading...'
    await uploadImage(blob)
    uploadBtn.textContent = '☁️ Upload'
    alert("Uploaded! Take more?")
    uploadBtn.disabled = true
  }, 'image/jpeg', 0.9)
}
