import { supabase } from "@/integrations/supabase/client";

export const STATION_CLAIM_DOCUMENTS_BUCKET = "station-claim-documents";
export const STATION_CLAIM_ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export const STATION_CLAIM_ALLOWED_FILE_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
] as const;
export const STATION_CLAIM_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const STATION_CLAIM_FILE_INPUT_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

const MIME_EXTENSION_MAP: Record<
  (typeof STATION_CLAIM_ALLOWED_FILE_TYPES)[number],
  string
> = {
  "application/pdf": "pdf",
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
    STATION_CLAIM_ALLOWED_FILE_EXTENSIONS.includes(
      fromName as (typeof STATION_CLAIM_ALLOWED_FILE_EXTENSIONS)[number],
    )
  ) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  if (
    file.type &&
    STATION_CLAIM_ALLOWED_FILE_TYPES.includes(
      file.type as (typeof STATION_CLAIM_ALLOWED_FILE_TYPES)[number],
    )
  ) {
    return MIME_EXTENSION_MAP[
      file.type as (typeof STATION_CLAIM_ALLOWED_FILE_TYPES)[number]
    ];
  }

  return null;
}

export function validateStationClaimProofFile(file: File) {
  const fileExtension = getFilenameExtension(file.name);
  const hasAllowedExtension =
    !!fileExtension &&
    STATION_CLAIM_ALLOWED_FILE_EXTENSIONS.includes(
      fileExtension as (typeof STATION_CLAIM_ALLOWED_FILE_EXTENSIONS)[number],
    );
  const hasAllowedMimeType =
    !!file.type &&
    STATION_CLAIM_ALLOWED_FILE_TYPES.includes(
      file.type as (typeof STATION_CLAIM_ALLOWED_FILE_TYPES)[number],
    );

  if (!hasAllowedExtension && !hasAllowedMimeType) {
    return "Only PDF, JPG, JPEG, and PNG files are allowed";
  }

  if (file.size <= 0) {
    return "Proof document cannot be empty";
  }

  if (file.size > STATION_CLAIM_MAX_FILE_SIZE) {
    return "Proof document must be 10MB or smaller";
  }

  return null;
}

export function createStationClaimDocumentPath(userId: string, file: File) {
  const extension = getSafeFileExtension(file);
  if (!extension) {
    throw new Error("Unsupported proof document type");
  }

  return `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

export async function uploadStationClaimProof(options: {
  file: File;
  userId: string;
}) {
  const validationError = validateStationClaimProofFile(options.file);
  if (validationError) {
    throw new Error(validationError);
  }

  const path = createStationClaimDocumentPath(options.userId, options.file);
  const { error } = await supabase.storage
    .from(STATION_CLAIM_DOCUMENTS_BUCKET)
    .upload(path, options.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: options.file.type,
    });

  if (error) {
    throw new Error(error.message || "Failed to upload proof document");
  }

  return {
    path,
    filename: sanitizeFilename(options.file.name),
  };
}

export async function removeStationClaimProof(path: string) {
  const { error } = await supabase.storage
    .from(STATION_CLAIM_DOCUMENTS_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(error.message || "Failed to remove uploaded proof document");
  }
}

export async function createStationClaimProofUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(STATION_CLAIM_DOCUMENTS_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    throw new Error(error.message || "Failed to load proof document");
  }

  return data.signedUrl;
}
