import { toast } from 'sonner';

export const PHOTO_UPLOAD_FAILED_MESSAGE =
  "Couldn't upload this photo. Try uploading a screenshot of it instead.";

export function showPhotoUploadError() {
  toast.error(PHOTO_UPLOAD_FAILED_MESSAGE);
}
