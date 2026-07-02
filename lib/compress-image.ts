const MAX_WIDTH = 1200;
const QUALITY = 0.8;
const TARGET_MAX_BYTES = 1024 * 1024;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not compress this image.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

export async function compressImageBeforeUpload(
  file: File
): Promise<{ blob: Blob; mimeType: string; fileName: string }> {
  const validationType = file.type;
  if (!validationType.startsWith('image/')) {
    throw new Error('Please upload an image file.');
  }

  if (typeof document === 'undefined') {
    return { blob: file, mimeType: file.type, fileName: file.name };
  }

  try {
    const image = await loadImageFromFile(file);
    const scale = Math.min(1, MAX_WIDTH / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return { blob: file, mimeType: file.type, fileName: file.name };
    }

    context.drawImage(image, 0, 0, width, height);

    const outputType = 'image/webp';
    let blob = await canvasToBlob(canvas, outputType, QUALITY);

    if (blob.size > TARGET_MAX_BYTES) {
      blob = await canvasToBlob(canvas, outputType, 0.65);
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return {
      blob,
      mimeType: outputType,
      fileName: `${baseName}.webp`,
    };
  } catch {
    return { blob: file, mimeType: file.type, fileName: file.name };
  }
}
