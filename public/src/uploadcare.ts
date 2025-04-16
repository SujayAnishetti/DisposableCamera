import { UploadClient } from '@uploadcare/upload-client'

const client = new UploadClient({ publicKey: 'fd5b883aafce88cea2ba' })

export async function uploadImage(file: Blob) {
  const result = await client.uploadFile(file)
  console.log("Uploaded to:", result.cdnUrl)
  return result.cdnUrl
}
