export type StoredImage = {
  name: string;
  dataUrl: string;
};

type PrepareImageOptions = {
  maxWidth: number;
  maxHeight: number;
  maxBytes: number;
  quality?: number;
};

const DEFAULT_QUALITY = 0.9;
const MIN_QUALITY = 0.45;
const QUALITY_STEP = 0.1;

export async function prepareImageForFirestore(
  file: File,
  options: PrepareImageOptions
) {
  const bitmap = await loadImageBitmap(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("IMAGE_PROCESSING_FAILED");
  }

  let width = bitmap.width;
  let height = bitmap.height;
  const widthRatio = options.maxWidth / width;
  const heightRatio = options.maxHeight / height;
  const ratio = Math.min(widthRatio, heightRatio, 1);

  width = Math.max(1, Math.round(width * ratio));
  height = Math.max(1, Math.round(height * ratio));

  let quality = options.quality ?? DEFAULT_QUALITY;

  while (true) {
    canvas.width = width;
    canvas.height = height;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const bytes = getDataUrlSize(dataUrl);

    if (bytes <= options.maxBytes) {
      return {
        name: replaceExtension(file.name, "jpg"),
        dataUrl,
        bytes,
      };
    }

    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
      continue;
    }

    if (width <= 320 && height <= 320) {
      throw new Error("IMAGE_TOO_LARGE");
    }

    width = Math.max(320, Math.round(width * 0.85));
    height = Math.max(320, Math.round(height * 0.85));
  }
}

export function getDataUrlSize(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

function replaceExtension(fileName: string, extension: string) {
  const nextName = fileName.replace(/\.[^.]+$/, "");
  return `${nextName || "image"}.${extension}`;
}

function loadImageBitmap(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("IMAGE_LOADING_FAILED"));
    };

    image.src = url;
  });
}
