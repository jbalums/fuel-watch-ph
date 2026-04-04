import type { HTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StationCard } from "@/components/StationCard";
import type { GasStation } from "@/types/station";

const mockNavigate = vi.fn();

vi.mock("framer-motion", () => ({
	motion: {
		div: ({
			children,
			animate: _animate,
			exit: _exit,
			initial: _initial,
			layout: _layout,
			transition: _transition,
			whileTap: _whileTap,
			...props
		}: HTMLAttributes<HTMLDivElement>) => (
			<div {...props}>{children}</div>
		),
	},
}));

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual<typeof import("react-router-dom")>(
		"react-router-dom",
	);

	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

const station: GasStation = {
	id: "station-1",
	name: "FuelWatch Central",
	address: "Carlos P. Garcia Ave, Tagbilaran City",
	lat: 9.647,
	lng: 123.855,
	googlePlaceId: "ChIJd8BlQ2BZwzMRQh0Qn3W3P8U",
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
		Unleaded: 59.5,
		Premium: 62,
		Diesel: 54.25,
		"Premium Diesel": null,
		Kerosene: null,
	},
	priceTrends: {
		Unleaded: 1,
		Premium: 1.25,
		Diesel: 0.5,
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

describe("StationCard", () => {
	beforeEach(() => {
		mockNavigate.mockReset();
		Object.defineProperty(window, "open", {
			writable: true,
			value: vi.fn(),
		});
	});

	it("opens Google Maps directions without triggering card navigation", () => {
		render(
			<MemoryRouter>
				<StationCard station={station} index={0} userLocation={null} />
			</MemoryRouter>,
		);

		fireEvent.click(
			screen.getByText(/get directions/i, { selector: "button" }),
		);

		expect(window.open).toHaveBeenCalledWith(
			"https://www.google.com/maps/dir/?api=1&destination=9.647%2C123.855&travelmode=driving&destination_place_id=ChIJd8BlQ2BZwzMRQh0Qn3W3P8U",
			"_blank",
			"noopener,noreferrer",
		);
		expect(mockNavigate).not.toHaveBeenCalled();
	});

	it("disables directions when the station coordinates are invalid", () => {
		render(
			<MemoryRouter>
				<StationCard
					station={{ ...station, lat: Number.NaN }}
					index={0}
					userLocation={null}
				/>
			</MemoryRouter>,
		);

		expect(
			screen.getByText(/get directions/i, { selector: "button" }),
		).toBeDisabled();
	});
});
