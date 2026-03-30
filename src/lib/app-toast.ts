import type { ReactNode } from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";

type ToastArg = string | ReactNode;

function mergeOptions(options?: ExternalToast): ExternalToast | undefined {
	return options ? { ...options } : undefined;
}

export const toast = {
	success(message: ToastArg, options?: ExternalToast) {
		return sonnerToast.success(message, mergeOptions(options));
	},
	error(message: ToastArg, options?: ExternalToast) {
		return sonnerToast.error(message, mergeOptions(options));
	},
	warning(message: ToastArg, options?: ExternalToast) {
		return sonnerToast.warning(message, mergeOptions(options));
	},
	info(message: ToastArg, options?: ExternalToast) {
		return sonnerToast.info(message, mergeOptions(options));
	},
	destructive(message: ToastArg, options?: ExternalToast) {
		return sonnerToast.error(message, mergeOptions(options));
	},
	deleted(message: ToastArg, options?: ExternalToast) {
		return sonnerToast.error(message, mergeOptions(options));
	},
	dismiss(id?: string | number) {
		return sonnerToast.dismiss(id);
	},
};
