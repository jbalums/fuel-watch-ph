import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StationMarkerInfoWindow } from "@/components/StationMarkerInfoWindow";
import type { StationBrandAverage } from "@/lib/station-brand-logos";
import type { GasStation } from "@/types/station";

const station: GasStation = {
	id: "station-1",
	name: "FuelWatch Central",
	address: "Carlos P. Garcia Ave, Tagbilaran City",
	lat: 9.647,
	lng: 123.855,
	googlePlaceId: null,
	stationBrandLogoId: null,
	provinceCode: "PH-BOH",
	cityMunicipalityCode: "PH-BOH-TAGBILARAN-CITY",
	prices: {
		Unleaded: 60.5,
		Premium: 63.25,
		Diesel: 54.75,
		"Premium Diesel": null,
		Kerosene: null,
	},
	fuelAvailability: {
		Unleaded: "Available",
		Premium: "Low",
		Diesel: "Available",
		"Premium Diesel": null,
		Kerosene: null,
	},
	previousPrices: {
		Unleaded: null,
		Premium: null,
		Diesel: null,
		"Premium Diesel": null,
		Kerosene: null,
	},
	priceTrends: {
		Unleaded: null,
		Premium: null,
		Diesel: null,
		"Premium Diesel": null,
		Kerosene: null,
	},
	isVerified: false,
	isLguVerified: false,
	lguVerifiedAt: null,
	lguVerifiedBy: null,
	lguVerifiedRole: null,
	verifiedAt: null,
	managerUserId: null,
	status: "Available",
	fuelType: "Unleaded",
	pricePerLiter: 60.5,
	updatedAt: new Date().toISOString(),
	lastUpdated: "2 hours ago",
	reportCount: 4,
};

const brandAverage: StationBrandAverage = {
	brandName: "FuelWatch",
	sampleCount: 2,
	averagePrices: {
		Unleaded: 61.25,
		Premium: 64.1,
		Diesel: null,
		"Premium Diesel": null,
		Kerosene: null,
	},
};

describe("StationMarkerInfoWindow", () => {
	beforeEach(() => {
		Object.defineProperty(window, "open", {
			writable: true,
			value: vi.fn(),
		});
	});

	it("shows directions only when explicitly enabled", () => {
		const { rerender } = render(
			<StationMarkerInfoWindow station={station} />,
		);

		expect(
			screen.queryByRole("button", { name: /get directions/i }),
		).not.toBeInTheDocument();

		rerender(
			<StationMarkerInfoWindow
				station={station}
				showDirectionsAction
			/>,
		);

		expect(
			screen.getByRole("button", { name: /get directions/i }),
		).toBeEnabled();
	});

	it("disables directions safely when coordinates are invalid", () => {
		render(
			<StationMarkerInfoWindow
				station={{ ...station, lng: Number.NaN }}
				showDirectionsAction
			/>,
		);

		expect(
			screen.getByRole("button", { name: /get directions/i }),
		).toBeDisabled();
	});

	it("opens Google Maps when the directions action is clicked", () => {
		render(
			<StationMarkerInfoWindow
				station={station}
				showDirectionsAction
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /get directions/i }));

		expect(window.open).toHaveBeenCalledWith(
			"https://www.google.com/maps/dir/?api=1&destination=9.647%2C123.855&travelmode=driving",
			"_blank",
			"noopener,noreferrer",
		);
	});

	it("uses the internal directions callback when provided", () => {
		const onGetDirections = vi.fn();

		render(
			<StationMarkerInfoWindow
				station={station}
				showDirectionsAction
				onGetDirections={onGetDirections}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /get directions/i }));

		expect(onGetDirections).toHaveBeenCalledTimes(1);
		expect(window.open).not.toHaveBeenCalled();
	});

	it("uses the dedicated open in maps callback when provided", () => {
		const onOpenInMaps = vi.fn();
		const onGetDirections = vi.fn();

		render(
			<StationMarkerInfoWindow
				station={station}
				showDirectionsAction
				onGetDirections={onGetDirections}
				onOpenInMaps={onOpenInMaps}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /open in maps/i }));

		expect(onOpenInMaps).toHaveBeenCalledTimes(1);
		expect(onGetDirections).not.toHaveBeenCalled();
		expect(window.open).not.toHaveBeenCalled();
	});

	it("renders and triggers the report action when enabled", () => {
		const onReportFuelPrices = vi.fn();

		render(
			<StationMarkerInfoWindow
				station={station}
				showReportAction
				onReportFuelPrices={onReportFuelPrices}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: /report fuel prices!/i }),
		);

		expect(onReportFuelPrices).toHaveBeenCalledTimes(1);
	});

	it("shows the brand average card when provided", () => {
		render(
			<StationMarkerInfoWindow
				station={station}
				brandAverage={brandAverage}
			/>,
		);

		expect(
			screen.getByText(/average from other/i),
		).toBeInTheDocument();
		expect(screen.getByText(/based on 2 stations/i)).toBeInTheDocument();
		expect(screen.getByText("₱ 61.25")).toBeInTheDocument();
	});

	it("renders the small claim station link when provided", () => {
		render(
			<StationMarkerInfoWindow
				station={station}
				claimStationLink={
					<button type="button">
						Do you own this gasoline station?
					</button>
				}
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: /do you own this gasoline station/i,
			}),
		).toBeInTheDocument();
	});
});
