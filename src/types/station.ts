export type FuelType = "Unleaded" | "Premium" | "Diesel";
export type StationStatus = "Available" | "Low" | "Out";
export type FuelReportReviewStatus = "pending" | "approved" | "rejected";

export interface GasStation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  prices: Record<FuelType, number | null>;
  status: StationStatus;
  fuelType: FuelType;
  pricePerLiter: number;
  updatedAt: string;
  lastUpdated: string;
  reportCount: number;
}

export interface FuelReport {
  id: string;
  stationName: string;
  lat: number | null;
  lng: number | null;
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
