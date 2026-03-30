import { useEffect, useMemo, useState } from "react";

export function usePaginatedList<T>(
	items: T[],
	resetKey: string,
	pageSize = 20,
) {
	const [currentPage, setCurrentPage] = useState(1);
	const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
	const activePage = Math.min(currentPage, totalPages);

	const paginatedItems = useMemo(() => {
		const startIndex = (activePage - 1) * pageSize;
		return items.slice(startIndex, startIndex + pageSize);
	}, [activePage, items, pageSize]);

	useEffect(() => {
		setCurrentPage(1);
	}, [resetKey]);

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [currentPage, totalPages]);

	return {
		currentPage: activePage,
		totalPages,
		paginatedItems,
		setCurrentPage,
		pageSize,
	};
}
