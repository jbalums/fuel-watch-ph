export type FuelType =
  | "Unleaded"
  | "Premium"
  | "Diesel"
  | "Premium Diesel"
  | "Kerosene";
export type StationStatus = "Available" | "Low" | "Out";
export type FuelAvailabilityMap = Record<FuelType, StationStatus | null>;
export type FuelReportReviewStatus = "pending" | "approved" | "rejected";
export type StationClaimReviewStatus = "pending" | "approved" | "rejected";
export type FuelReportSubmissionMode = "standard" | "easy";
export type StationExperienceReviewStatus = "pending" | "approved" | "rejected";
export type StationExperienceSentiment = "good" | "bad";

export interface GasStation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  googlePlaceId: string | null;
  stationBrandLogoId: string | null;
  provinceCode: string | null;
  cityMunicipalityCode: string | null;
  prices: Record<FuelType, number | null>;
  fuelAvailability: FuelAvailabilityMap;
  previousPrices: Record<FuelType, number | null>;
  priceTrends: Record<FuelType, number | null>;
  isVerified: boolean;
  isLguVerified: boolean;
  lguVerifiedAt: string | null;
  lguVerifiedBy: string | null;
  lguVerifiedRole: "province_admin" | "city_admin" | "lgu_staff" | null;
  verifiedAt: string | null;
  managerUserId: string | null;
  status: StationStatus;
  fuelType: FuelType;
  pricePerLiter: number;
  updatedAt: string;
  lastUpdated: string;
  reportCount: number;
}

export interface StationBrandLogo {
  id: string;
  brandName: string;
  matchKeywords: string[];
  logoPath: string;
  logoUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DonationGateway {
  id: string;
  gatewayName: string;
  accountName: string | null;
  accountNumber: string | null;
  walletDetails: string | null;
  qrImagePath: string | null;
  qrImageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StationExperienceIdentity {
  stationId: string | null;
  source: string | null;
  externalId: string | null;
  stationName: string;
  stationAddress: string;
  lat: number | null;
  lng: number | null;
  provinceCode: string | null;
  cityMunicipalityCode: string | null;
}

export interface StationExperience extends StationExperienceIdentity {
  id: string;
  userId: string;
  sentiment: StationExperienceSentiment;
  experienceText: string;
  photoPaths: string[];
  photoFilenames: string[];
  photoUrls: string[];
  reviewStatus: StationExperienceReviewStatus;
  reviewNotes: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
  reporterLabel: string;
}

export interface PublicStationSummary {
  totalStations: number;
  averagePrices: Record<FuelType, number | null>;
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
  stationName: string | null;
  reportedAddress: string | null;
  lat: number | null;
  lng: number | null;
  provinceCode: string | null;
  cityMunicipalityCode: string | null;
  photoPath: string | null;
  photoFilename: string | null;
  photoUrl: string | null;
  prices: Record<FuelType, number | null>;
  fuelAvailability: FuelAvailabilityMap;
  price: number | null;
  fuelType: FuelType | null;
  status: StationStatus | null;
  reportedAt: string;
  reportedBy: string;
  reportedByLabel: string;
  submissionMode: FuelReportSubmissionMode;
  reviewStatus: FuelReportReviewStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  isLguVerified: boolean;
  lguVerifiedAt: string | null;
  lguVerifiedBy: string | null;
  lguVerifiedRole: "province_admin" | "city_admin" | "lgu_staff" | null;
  appliedStationId: string | null;
}

export type SortOption = "price_asc" | "price_desc";
export type FilterFuelType = FuelType | "All";
export type StatusFilter = StationStatus | "All";
