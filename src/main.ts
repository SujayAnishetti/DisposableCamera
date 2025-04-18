import { uploadImage } from './uploadcare';
import { addToQueue, getAllQueued, removeFirstFromQueue } from './db';

const video = document.getElementById('camera') as HTMLVideoElement;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const snapBtn = document.getElementById('snap') as HTMLButtonElement;
const flipBtn = document.getElementById('flip') as HTMLButtonElement;
const context = canvas.getContext('2d')!;

const progressBar = document.getElementById('upload-progress') as HTMLProgressElement;
const statusText = document.getElementById('upload-status') as HTMLDivElement;

// UI Container
const container = document.getElementById('video-container') as HTMLElement;

let currentStream: MediaStream | null = null;
let usingFrontCamera = true;
let currentDeviceId: string | null = null;
const uploadQueue: Blob[] = [];

let isUploading = false;
let uploadedCount = 0;

// Helper to stop camera stream
function stopStream() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}

// Get list of video input devices
async function getVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(device => device.kind === 'videoinput');
}

// Start camera by facing mode or fallback to deviceId
async function startCamera(front: boolean) {
  stopStream();

  const devices = await getVideoInputDevices();
  let deviceId: string | undefined;

  for (const device of devices) {
    if (front && device.label.toLowerCase().includes('front')) {
      deviceId = device.deviceId;
      break;
    }
    if (!front && device.label.toLowerCase().includes('back')) {
      deviceId = device.deviceId;
      break;
    }
  }

  if (!deviceId && devices.length > 0) {
    deviceId = front ? devices[0].deviceId : devices[devices.length - 1].deviceId;
  }

  currentDeviceId = deviceId || null;
  usingFrontCamera = front;

  const constraints = {
    video: {
      deviceId: currentDeviceId ? { exact: currentDeviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    currentStream = stream;

    // Scale video to fit UI container
    //scaleVideoForUI();
  } catch (err) {
    console.error('Camera error:', err);
    alert("Couldn't access the camera.");
  }
}

// Scale video to fit the UI container
// function scaleVideoForUI() {
//   // Ensure the container exists
//   if (!container) {
//     console.error('Video container not found.');
//     return;
//   }

//   const containerWidth = container.clientWidth;
//   const containerHeight = container.clientHeight;

//   const videoWidth = containerWidth;
//   const videoHeight = containerHeight;

//   video.style.width = '100%';
//   video.style.height = '100%';
//   video.style.objectFit = 'cover'; // Use 'cover' to fill the screen and maintain aspect ratio

//   // Optionally, adjust the container's aspect ratio here if necessary
//   container.style.width = `${containerWidth}px`;
//   container.style.height = `${containerHeight}px`;
// }

// Flip camera
flipBtn.onclick = () => {
  startCamera(!usingFrontCamera);
};

// Take photo
snapBtn.onclick = () => {
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;

  // Draw image to canvas with optional styling
  if (usingFrontCamera) {
    context.save();
    context.scale(-1, 1); // Flip horizontally
    context.filter = 'grayscale(0.3) contrast(1.2) brightness(1.1)';
    context.drawImage(video, -width, 0, width, height);
    context.restore();
  } else {
    context.filter = 'grayscale(0.3) contrast(1.2) brightness(1.1)';
    context.drawImage(video, 0, 0, width, height);
  }

  // Create Blob from canvas and add to upload queue
  canvas.toBlob(blob => {
    if (!blob) return;
    enqueueImage(blob);
  }, 'image/jpeg', 0.9);
};

// Add image to upload queue
function enqueueImage(blob: Blob) {
  uploadQueue.push(blob);
  addToQueue(blob);
  
  // Don't call updateProgressUI() here immediately
  processQueue(); // Let this handle UI update cleanly
}



// Handle the upload queue
async function processQueue() {
  if (isUploading || uploadQueue.length === 0) return;

  isUploading = true;

  const blob = uploadQueue.shift()!;
  updateProgressUI(); // <-- run this AFTER popping the queue

  try {
    await uploadImage(blob);
    await removeFirstFromQueue();
    uploadedCount++;
    console.log('✅ Uploaded one image.');
  } catch (err) {
    console.error('❌ Upload failed. Retrying later...', err);
    uploadQueue.unshift(blob);
    await wait(5000);
  }

  isUploading = false;
  updateProgressUI(); // ← final update
  processQueue(); // Check for next item
}



// Update progress bar UI
function updateProgressUI() {
  const queued = uploadQueue.length;
  const uploaded = uploadedCount;

  // Only count what has been uploaded or is still waiting
  const total = uploaded + queued;
  const progress = uploaded;

  progressBar.max = total;
  progressBar.value = progress;

  statusText.textContent = `${progress} / ${total} uploaded`;

  if (total === 0) {
    progressBar.style.visibility = 'hidden';
    statusText.style.visibility = 'hidden';
  } else {
    progressBar.style.visibility = 'visible';
    statusText.style.visibility = 'visible';
  }
}


// Delay helper
function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Load queued blobs and resume uploads
getAllQueued().then(blobs => {
  uploadedCount = 0;
  blobs.forEach(blob => uploadQueue.push(blob));
  updateProgressUI();
  processQueue();
});

// Start with front camera
startCamera(false);

// Prevent zoom on mobile
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('wheel', e => {
  if (e.ctrlKey) e.preventDefault();
}, { passive: false });
