export type FuelType = "Unleaded" | "Premium" | "Diesel";
export type StationStatus = "Available" | "Low" | "Out";

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
  lastUpdated: string;
  reportCount: number;
}

export interface FuelReport {
  id: string;
  stationName: string;
  lat: number;
  lng: number;
  price: number;
  fuelType: FuelType;
  status: StationStatus;
  reportedAt: string;
  reportedBy: string;
}

export type SortOption = "cheapest" | "nearest" | "status";
export type FilterFuelType = FuelType | "All";
