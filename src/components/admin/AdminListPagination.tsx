import { Button } from "@/components/ui/button";

interface AdminListPaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

export function AdminListPagination({
	currentPage,
	totalPages,
	onPageChange,
}: AdminListPaginationProps) {
	if (totalPages <= 1) {
		return null;
	}

	return (
		<div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted-foreground">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={() => {
					if (currentPage > 1) {
						onPageChange(currentPage - 1);
					}
				}}
				disabled={currentPage === 1}
				className="h-8 px-2 text-sm"
			>
				Prev
			</Button>
			<span className="text-center">
				Page {currentPage} of {totalPages} pages
			</span>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={() => {
					if (currentPage < totalPages) {
						onPageChange(currentPage + 1);
					}
				}}
				disabled={currentPage === totalPages}
				className="h-8 px-2 text-sm"
			>
				Next
			</Button>
		</div>
	);
}
