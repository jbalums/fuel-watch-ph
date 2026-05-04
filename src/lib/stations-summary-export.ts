import { fuelTypes, type FuelType } from "@/lib/fuel-prices";

export type StationsSummaryExportRow = {
	name: string;
	address: string;
	prices: Record<FuelType, string>;
};

export type StationsSummaryExportOptions = {
	title: string;
	modeLabel: string;
	summaryLabel: string;
	averagePrices: Record<FuelType, string>;
	rows: StationsSummaryExportRow[];
	fileName: string;
};

export async function exportStationsSummaryToExcel({
	title,
	modeLabel,
	summaryLabel,
	averagePrices,
	rows,
	fileName,
}: StationsSummaryExportOptions) {
	const xlsx = await import("xlsx");

	const worksheetRows = [
		[title],
		[modeLabel],
		[summaryLabel],
		[],
		["Average Fuel Prices", ...fuelTypes],
		["", ...fuelTypes.map((fuelType) => averagePrices[fuelType])],
		[],
		["Station Name", "Address", ...fuelTypes],
		...rows.map((row) => [
			row.name,
			row.address,
			...fuelTypes.map((fuelType) => row.prices[fuelType]),
		]),
	];

	const workbook = xlsx.utils.book_new();
	const worksheet = xlsx.utils.aoa_to_sheet(worksheetRows);

	worksheet["!cols"] = [
		{ wch: 32 },
		{ wch: 48 },
		...fuelTypes.map(() => ({ wch: 18 })),
	];

	xlsx.utils.book_append_sheet(workbook, worksheet, "Stations Summary");
	xlsx.writeFile(workbook, fileName);
}
