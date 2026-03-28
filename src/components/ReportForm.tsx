import { useEffect, useRef, useState } from "react";
import { StationStatus } from "@/types/station";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  CheckCircle,
  ImagePlus,
  Loader2,
  MapPin,
  Send,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  FUEL_REPORT_FILE_INPUT_ACCEPT,
  removeFuelReportPhoto,
  uploadFuelReportPhoto,
  validateFuelReportPhoto,
} from "@/lib/fuel-report-photo-upload";
import {
  createEmptyFuelPriceFormMap,
  getPrimaryFuelPriceSelection,
  parseFuelPriceForm,
  fuelTypes,
  type FuelPriceFormMap,
} from "@/lib/fuel-prices";

const statuses: StationStatus[] = ["Available", "Low", "Out"];

type UploadedPhoto = {
  path: string;
  filename: string;
};

export function ReportForm() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stationName, setStationName] = useState("");
  const [prices, setPrices] = useState<FuelPriceFormMap>(
    createEmptyFuelPriceFormMap(),
  );
  const [status, setStatus] = useState<StationStatus>("Available");
  const [submitted, setSubmitted] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<UploadedPhoto | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [photoFile]);

  const resetPhotoState = () => {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setUploadedPhoto(null);
    setUploadingPhoto(false);
    setPhotoUploadError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearReportForm = () => {
    setStationName("");
    setPrices(createEmptyFuelPriceFormMap());
    setStatus("Available");
    setCoords(null);
    resetPhotoState();
  };

  const uploadSelectedPhoto = async (file: File) => {
    if (!user) {
      throw new Error("Please sign in before uploading a report photo");
    }

    const validationError = validateFuelReportPhoto(file);
    if (validationError) {
      throw new Error(validationError);
    }

    if (uploadedPhoto?.path) {
      await removeFuelReportPhoto(uploadedPhoto.path).catch(() => undefined);
    }

    setUploadingPhoto(true);
    setPhotoUploadError(null);

    try {
      const uploaded = await uploadFuelReportPhoto({
        file,
        userId: user.id,
      });

      setUploadedPhoto(uploaded);
      return uploaded;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    const validationError = validateFuelReportPhoto(file);
    if (validationError) {
      setPhotoFile(null);
      setUploadedPhoto(null);
      setPhotoUploadError(validationError);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setPhotoFile(file);

    try {
      await uploadSelectedPhoto(file);
    } catch (error) {
      setUploadedPhoto(null);
      setPhotoUploadError(
        error instanceof Error ? error.message : "Failed to upload photo",
      );
    }
  };

  const handleRemovePhoto = async () => {
    if (uploadedPhoto?.path) {
      await removeFuelReportPhoto(uploadedPhoto.path).catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to remove uploaded photo",
        );
      });
    }

    resetPhotoState();
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDetecting(false);
        toast.success("Location detected!");
      },
      () => {
        setDetecting(false);
        toast.error("Could not detect location");
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationName || !user) return;

    let normalizedPrices;
    try {
      normalizedPrices = parseFuelPriceForm(prices);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid fuel price");
      return;
    }

    const primarySelection = getPrimaryFuelPriceSelection(normalizedPrices);
    if (!primarySelection) {
      toast.error("Add at least one valid fuel price");
      return;
    }

    setSubmitting(true);
    let photoAttachment = uploadedPhoto;

    if (photoFile && !photoAttachment) {
      try {
        photoAttachment = await uploadSelectedPhoto(photoFile);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to upload photo",
        );
        setSubmitting(false);
        return;
      }
    }

    const { error } = await supabase.from("fuel_reports").insert({
      user_id: user.id,
      station_name: stationName,
      price: primarySelection.price,
      fuel_type: primarySelection.fuelType,
      prices: normalizedPrices,
      status,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      photo_path: photoAttachment?.path ?? null,
      photo_filename: photoAttachment?.filename ?? null,
    });

    if (error) {
      if (photoAttachment?.path) {
        await removeFuelReportPhoto(photoAttachment.path).catch(() => undefined);
        setUploadedPhoto(null);
      }
      toast.error("Failed to submit report");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
    setTimeout(() => {
      setSubmitted(false);
      clearReportForm();
    }, 2500);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-card p-10 text-center shadow-sovereign"
      >
        <CheckCircle className="h-12 w-12 text-success" />
        <h2 className="text-headline text-foreground">Report Submitted</h2>
        <p className="text-sm text-muted-foreground">
          Thank you for helping fellow motorists!
        </p>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: [0.2, 0.8, 0.2, 1] }}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl bg-card p-6 shadow-sovereign"
    >
      <h2 className="text-headline text-foreground">Report Fuel Price</h2>

      {/* Station name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label text-muted-foreground">Station Name</label>
        <input
          type="text"
          value={stationName}
          onChange={(e) => setStationName(e.target.value)}
          placeholder="e.g. Petron EDSA Cubao"
          className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
        />
      </div>

      {/* Location */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label text-muted-foreground">Location</label>
        <button
          type="button"
          onClick={handleDetectLocation}
          className="flex items-center gap-2 rounded-xl bg-surface-alt px-4 py-3 text-sm text-muted-foreground hover:text-foreground sovereign-ease transition-colors"
        >
          <MapPin className={cn("h-4 w-4", detecting && "animate-pulse text-accent", coords && "text-success")} />
          {detecting ? "Detecting..." : coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Auto-detect GPS location"}
        </button>
      </div>

      {/* Price */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label text-muted-foreground">
          Prices per Liter (₱)
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          {fuelTypes.map((fuelType) => (
            <div key={fuelType} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {fuelType}
              </label>
              <input
                type="number"
                step="0.01"
                value={prices[fuelType]}
                onChange={(event) =>
                  setPrices((current) => ({
                    ...current,
                    [fuelType]: event.target.value,
                  }))
                }
                placeholder="0.00"
                className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all tabular-nums"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Add at least one fuel price. Leave any unreported fuel blank.
        </p>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label text-muted-foreground">Availability</label>
        <div className="flex gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-ui sovereign-ease transition-colors",
                status === s
                  ? s === "Available"
                    ? "bg-success/20 text-success"
                    : s === "Low"
                    ? "bg-warning/20 text-warning"
                    : "bg-destructive/20 text-destructive"
                  : "bg-surface-alt text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-label text-muted-foreground">
          Verification Photo
        </label>
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Upload a pump, price board, or receipt photo
              </p>
              <p className="text-xs text-muted-foreground">
                Optional. Used for admin verification of your report.
              </p>
            </div>
            {photoFile ? (
              <button
                type="button"
                onClick={() => void handleRemovePhoto()}
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </button>
            ) : null}
          </div>

          <label className="mt-3 flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-surface-alt px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ImagePlus className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {photoFile
                ? photoFile.name
                : "Choose JPG, JPEG, or PNG (max 10MB)"}
            </span>
            <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-foreground">
              {photoFile ? "Replace" : "Browse"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept={FUEL_REPORT_FILE_INPUT_ACCEPT}
              onChange={(event) => void handlePhotoChange(event)}
              className="hidden"
            />
          </label>

          {photoPreviewUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface-alt">
              <img
                src={photoPreviewUrl}
                alt={photoFile?.name || "Selected report photo"}
                className="h-44 w-full object-cover"
              />
            </div>
          )}

          {photoFile && (
            <p className="mt-2 text-xs text-foreground">
              Selected file: {photoFile.name}
            </p>
          )}

          {uploadingPhoto && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading verification photo...
            </p>
          )}

          {photoUploadError && (
            <p className="mt-2 text-xs text-destructive">
              {photoUploadError}
            </p>
          )}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={submitting || uploadingPhoto}
        className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground sovereign-ease hover:bg-primary-hover transition-colors disabled:opacity-50"
      >
        {submitting || uploadingPhoto ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {uploadingPhoto
          ? "Uploading Photo..."
          : submitting
            ? "Submitting..."
            : "Submit Report"}
      </motion.button>
    </motion.form>
  );
}
