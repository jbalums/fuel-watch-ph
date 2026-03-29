import { Fragment, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { GasStation } from "@/types/station";
import { StationCard } from "@/components/StationCard";
import { useUserLocation } from "@/hooks/useUserLocation";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";

interface StationResultsListProps {
	stations: GasStation[];
	loading: boolean;
	emptyMessage?: string;
	currentPage?: number;
	totalPages?: number;
	onPageChange?: (page: number) => void;
}

function getVisiblePages(currentPage: number, totalPages: number) {
	if (totalPages <= 5) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	if (currentPage <= 3) {
		return [1, 2, 3, 4, totalPages];
	}

	if (currentPage >= totalPages - 2) {
		return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
	}

	return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
}

export function StationResultsList({
	stations,
	loading,
	emptyMessage = "No stations found matching your criteria.",
	currentPage = 1,
	totalPages = 1,
	onPageChange,
}: StationResultsListProps) {
	const { latitude, longitude } = useUserLocation();
	const userLocation = useMemo(
		() =>
			latitude !== null && longitude !== null
				? {
						lat: latitude,
						lng: longitude,
					}
				: null,
		[latitude, longitude],
	);
	const visiblePages = useMemo(
		() => getVisiblePages(currentPage, totalPages),
		[currentPage, totalPages],
	);
	const showPagination = !loading && totalPages > 1;

	const renderPaginationLink = (page: number) => (
		<PaginationItem key={`pagination-link-${page}`}>
			<PaginationLink
				href="#"
				isActive={page === currentPage}
				onClick={(event) => {
					event.preventDefault();
					onPageChange?.(page);
				}}
			>
				{page}
			</PaginationLink>
		</PaginationItem>
	);
	const renderPagination = () => (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						href="#"
						onClick={(event) => {
							event.preventDefault();
							if (currentPage > 1) {
								onPageChange?.(currentPage - 1);
							}
						}}
						className={
							currentPage === 1
								? "pointer-events-none opacity-50"
								: undefined
						}
					/>
				</PaginationItem>
				{visiblePages.map((page, index) => {
					const previousPage = visiblePages[index - 1];
					const shouldShowLeadingEllipsis =
						index > 0 &&
						previousPage !== undefined &&
						page - previousPage > 1;

					return (
						<Fragment key={page}>
							{shouldShowLeadingEllipsis && (
								<PaginationItem>
									<PaginationEllipsis />
								</PaginationItem>
							)}
							{renderPaginationLink(page)}
						</Fragment>
					);
				})}
				<PaginationItem>
					<PaginationNext
						href="#"
						onClick={(event) => {
							event.preventDefault();
							if (currentPage < totalPages) {
								onPageChange?.(currentPage + 1);
							}
						}}
						className={
							currentPage === totalPages
								? "pointer-events-none opacity-50"
								: undefined
						}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
	return (
		<div className="flex flex-col gap-3">
			{showPagination && renderPagination()}
			{loading ? (
				<div className="flex items-center justify-center py-24">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			) : (
				<>
					{stations.map((station, index) => (
						<StationCard
							key={station.id}
							station={station}
							index={index}
							userLocation={userLocation}
						/>
					))}
					{stations.length === 0 && (
						<p className="py-24 text-center text-sm text-muted-foreground">
							{emptyMessage}
						</p>
					)}
				</>
			)}
			{showPagination && renderPagination()}

			<p className="text-sm dark:text-amber-500 text-red-600 text-center">
				⚠️ Fuel prices are crowd-sourced and may not reflect real-time
				changes. Verify at the station before refueling.
			</p>
		</div>
	);
}
