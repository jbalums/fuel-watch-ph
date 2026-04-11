export const HOMEPAGE_CURRENT_PROVINCE_KEY =
	"homepage_current_province_code";

export function getStoredCurrentProvinceCode() {
	if (typeof window === "undefined") {
		return "";
	}

	return window.localStorage.getItem(HOMEPAGE_CURRENT_PROVINCE_KEY) ?? "";
}

export function setStoredCurrentProvinceCode(provinceCode: string) {
	if (typeof window === "undefined") {
		return;
	}

	if (provinceCode.trim()) {
		window.localStorage.setItem(
			HOMEPAGE_CURRENT_PROVINCE_KEY,
			provinceCode,
		);
		return;
	}

	window.localStorage.removeItem(HOMEPAGE_CURRENT_PROVINCE_KEY);
}
