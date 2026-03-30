export type FuelType = "Unleaded" | "Premium" | "Diesel";
export type StationStatus = "Available" | "Low" | "Out";
export type FuelReportReviewStatus = "pending" | "approved" | "rejected";
export type StationClaimReviewStatus = "pending" | "approved" | "rejected";

export interface GasStation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  provinceCode: string | null;
  cityMunicipalityCode: string | null;
  prices: Record<FuelType, number | null>;
  isVerified: boolean;
  verifiedAt: string | null;
  managerUserId: string | null;
  status: StationStatus;
  fuelType: FuelType;
  pricePerLiter: number;
  updatedAt: string;
  lastUpdated: string;
  reportCount: number;
}

export interface StationClaimRequest {
  id: string;
  stationId: string;
  userId: string;
  businessName: string;
  contactName: string;
  contactPhone: string;
  notes: string | null;
  proofDocumentPath: string | null;
  proofDocumentFilename: string | null;
  proofDocumentUrl: string | null;
  reviewStatus: StationClaimReviewStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
}

export interface FuelReport {
  id: string;
  stationId: string | null;
  stationName: string;
  reportedAddress: string | null;
  lat: number | null;
  lng: number | null;
  provinceCode: string | null;
  cityMunicipalityCode: string | null;
  photoPath: string | null;
  photoFilename: string | null;
  photoUrl: string | null;
  prices: Record<FuelType, number | null>;
  price: number;
  fuelType: FuelType;
  status: StationStatus;
  reportedAt: string;
  reportedBy: string;
  reviewStatus: FuelReportReviewStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  appliedStationId: string | null;
}

export type SortOption = "price_asc" | "price_desc";
export type FilterFuelType = FuelType | "All";
export type StatusFilter = StationStatus | "All";
