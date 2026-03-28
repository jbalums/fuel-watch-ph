import { supabase } from "@/integrations/supabase/client";

export const FUEL_REPORT_PHOTOS_BUCKET = "fuel-report-photos";
export const FUEL_REPORT_ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
] as const;
export const FUEL_REPORT_ALLOWED_FILE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
] as const;
export const FUEL_REPORT_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const FUEL_REPORT_FILE_INPUT_ACCEPT =
  ".jpg,.jpeg,.png,image/jpeg,image/png";

const MIME_EXTENSION_MAP: Record<
  (typeof FUEL_REPORT_ALLOWED_FILE_TYPES)[number],
  string
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

function getFilenameExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? null;
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getSafeFileExtension(file: File) {
  const fromName = getFilenameExtension(file.name);
  if (
    fromName &&
    FUEL_REPORT_ALLOWED_FILE_EXTENSIONS.includes(
      fromName as (typeof FUEL_REPORT_ALLOWED_FILE_EXTENSIONS)[number],
    )
  ) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  if (
    file.type &&
    FUEL_REPORT_ALLOWED_FILE_TYPES.includes(
      file.type as (typeof FUEL_REPORT_ALLOWED_FILE_TYPES)[number],
    )
  ) {
    return MIME_EXTENSION_MAP[
      file.type as (typeof FUEL_REPORT_ALLOWED_FILE_TYPES)[number]
    ];
  }

  return null;
}

export function validateFuelReportPhoto(file: File) {
  const fileExtension = getFilenameExtension(file.name);
  const hasAllowedExtension =
    !!fileExtension &&
    FUEL_REPORT_ALLOWED_FILE_EXTENSIONS.includes(
      fileExtension as (typeof FUEL_REPORT_ALLOWED_FILE_EXTENSIONS)[number],
    );
  const hasAllowedMimeType =
    !!file.type &&
    FUEL_REPORT_ALLOWED_FILE_TYPES.includes(
      file.type as (typeof FUEL_REPORT_ALLOWED_FILE_TYPES)[number],
    );

  if (!hasAllowedExtension && !hasAllowedMimeType) {
    return "Only JPG, JPEG, and PNG files are allowed";
  }

  if (file.size <= 0) {
    return "Photo cannot be empty";
  }

  if (file.size > FUEL_REPORT_MAX_FILE_SIZE) {
    return "Photo must be 10MB or smaller";
  }

  return null;
}

export function createFuelReportPhotoPath(userId: string, file: File) {
  const extension = getSafeFileExtension(file);
  if (!extension) {
    throw new Error("Unsupported photo type");
  }

  return `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

export async function uploadFuelReportPhoto(options: {
  file: File;
  userId: string;
}) {
  const validationError = validateFuelReportPhoto(options.file);
  if (validationError) {
    throw new Error(validationError);
  }

  const path = createFuelReportPhotoPath(options.userId, options.file);
  const { error } = await supabase.storage
    .from(FUEL_REPORT_PHOTOS_BUCKET)
    .upload(path, options.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: options.file.type,
    });

  if (error) {
    throw new Error(error.message || "Failed to upload photo");
  }

  return {
    path,
    filename: sanitizeFilename(options.file.name),
  };
}

export async function removeFuelReportPhoto(path: string) {
  const { error } = await supabase.storage
    .from(FUEL_REPORT_PHOTOS_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(error.message || "Failed to remove uploaded photo");
  }
}

export async function createFuelReportPhotoUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(FUEL_REPORT_PHOTOS_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    throw new Error(error.message || "Failed to load photo");
  }

  return data.signedUrl;
}
