import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, ImagePlus, Loader2, Pencil, QrCode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDonationGateways } from "@/hooks/useDonationGateways";
import {
	removeDonationGatewayQr,
	uploadDonationGatewayQr,
	validateDonationGatewayQr,
} from "@/lib/donation-gateway-upload";
import type { DonationGateway } from "@/types/station";

type DonationGatewayFormState = {
	gatewayName: string;
	accountName: string;
	accountNumber: string;
	walletDetails: string;
	qrImagePath: string;
	qrImageUrl: string;
	isActive: boolean;
	sortOrder: string;
};

const initialFormState: DonationGatewayFormState = {
	gatewayName: "",
	accountName: "",
	accountNumber: "",
	walletDetails: "",
	qrImagePath: "",
	qrImageUrl: "",
	isActive: true,
	sortOrder: "0",
};

export default function AdminDonationGatewaysPage() {
	const queryClient = useQueryClient();
	const { data: gateways = [], isLoading } = useDonationGateways();
	const [editingGatewayId, setEditingGatewayId] = useState<string | null>(
		null,
	);
	const [form, setForm] = useState<DonationGatewayFormState>(initialFormState);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState<
		string | null
	>(null);

	useEffect(() => {
		if (!selectedFile) {
			setSelectedFilePreviewUrl(null);
			return;
		}

		const objectUrl = URL.createObjectURL(selectedFile);
		setSelectedFilePreviewUrl(objectUrl);

		return () => {
			URL.revokeObjectURL(objectUrl);
		};
	}, [selectedFile]);

	const activePreviewUrl = selectedFilePreviewUrl ?? form.qrImageUrl;

	const resetForm = () => {
		setEditingGatewayId(null);
		setForm(initialFormState);
		setSelectedFile(null);
	};

	const saveGateway = useMutation({
		mutationFn: async () => {
			const gatewayName = form.gatewayName.trim();
			if (!gatewayName) {
				throw new Error("Gateway name is required");
			}

			const sortOrder = Number.parseInt(form.sortOrder, 10);
			if (!Number.isFinite(sortOrder)) {
				throw new Error("Sort order must be a valid number");
			}

			let nextQrImagePath = form.qrImagePath.trim();
			let uploadedQrPath: string | null = null;

			if (selectedFile) {
				const validationError = validateDonationGatewayQr(selectedFile);
				if (validationError) {
					throw new Error(validationError);
				}

				const uploaded = await uploadDonationGatewayQr({
					file: selectedFile,
					gatewayName,
				});
				nextQrImagePath = uploaded.path;
				uploadedQrPath = uploaded.path;
			}

			const payload = {
				gateway_name: gatewayName,
				account_name: form.accountName.trim() || null,
				account_number: form.accountNumber.trim() || null,
				wallet_details: form.walletDetails.trim() || null,
				qr_image_path: nextQrImagePath || null,
				is_active: form.isActive,
				sort_order: sortOrder,
			};

			try {
				if (editingGatewayId) {
					const { error } = await supabase
						.from("donation_gateways")
						.update(payload)
						.eq("id", editingGatewayId);

					if (error) {
						throw error;
					}

					if (
						uploadedQrPath &&
						form.qrImagePath &&
						form.qrImagePath !== uploadedQrPath
					) {
						await removeDonationGatewayQr(form.qrImagePath).catch(
							() => undefined,
						);
					}

					return "updated" as const;
				}

				const { error } = await supabase
					.from("donation_gateways")
					.insert(payload);

				if (error) {
					throw error;
				}

				return "created" as const;
			} catch (error) {
				if (uploadedQrPath) {
					await removeDonationGatewayQr(uploadedQrPath).catch(
						() => undefined,
					);
				}

				throw error;
			}
		},
		onSuccess: async (mode) => {
			await queryClient.invalidateQueries({
				queryKey: ["donation_gateways"],
			});
			resetForm();
			toast.success(
				mode === "created"
					? "Donation gateway created"
					: "Donation gateway updated",
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const deleteGateway = useMutation({
		mutationFn: async (gateway: DonationGateway) => {
			const { error } = await supabase
				.from("donation_gateways")
				.delete()
				.eq("id", gateway.id);

			if (error) {
				throw error;
			}

			if (gateway.qrImagePath) {
				await removeDonationGatewayQr(gateway.qrImagePath).catch(
					() => undefined,
				);
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["donation_gateways"],
			});
			if (editingGatewayId) {
				resetForm();
			}
			toast.deleted("Donation gateway deleted");
		},
		onError: (error) => toast.error(error.message),
	});

	const editingGateway = useMemo(
		() =>
			editingGatewayId
				? gateways.find((gateway) => gateway.id === editingGatewayId) ??
					null
				: null,
		[editingGatewayId, gateways],
	);

	return (
		<div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<div className="mb-4">
					<h3 className="text-xl font-semibold text-foreground">
						{editingGateway
							? "Edit Donation Gateway"
							: "Add Donation Gateway"}
					</h3>
					<p className="text-sm text-muted-foreground">
						Add donation wallets, payment details, and optional QR
						codes for the public Donate page.
					</p>
				</div>

				<form
					onSubmit={(event) => {
						event.preventDefault();
						saveGateway.mutate();
					}}
					className="flex flex-col gap-4"
				>
					<input
						type="text"
						placeholder="Gateway name (e.g. GCash)"
						value={form.gatewayName}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								gatewayName: event.target.value,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
					<input
						type="text"
						placeholder="Account name"
						value={form.accountName}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								accountName: event.target.value,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
					<input
						type="text"
						placeholder="Wallet or account number"
						value={form.accountNumber}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								accountNumber: event.target.value,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
					<textarea
						rows={4}
						placeholder="Additional wallet details, reminders, or instructions"
						value={form.walletDetails}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								walletDetails: event.target.value,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
					<input
						type="number"
						placeholder="Sort order"
						value={form.sortOrder}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								sortOrder: event.target.value,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
					<label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
						<ImagePlus className="h-4 w-4" />
						<span className="min-w-0 flex-1 truncate">
							{selectedFile
								? selectedFile.name
								: editingGateway
									? "Replace current QR image"
									: "Upload QR code image (optional)"}
						</span>
						<input
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(event) => {
								const file = event.target.files?.[0] ?? null;
								setSelectedFile(file);
							}}
						/>
					</label>

					<div className="rounded-xl border border-border bg-secondary/20 p-4">
						<p className="text-sm font-medium text-foreground">
							Public Preview
						</p>
						<div className="mt-3 flex items-center gap-3">
							<div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
								{activePreviewUrl ? (
									<img
										src={activePreviewUrl}
										alt={form.gatewayName || "QR preview"}
										className="h-full w-full object-cover"
									/>
								) : (
									<QrCode className="h-5 w-5 text-muted-foreground" />
								)}
							</div>
							<div className="text-xs text-muted-foreground">
								<p className="font-medium text-foreground">
									{form.gatewayName || "No gateway name yet"}
								</p>
								<p>
									{form.accountNumber || "Add a wallet number or details for donors."}
								</p>
							</div>
						</div>
					</div>

					<label className="flex items-center gap-2 text-sm text-foreground">
						<input
							type="checkbox"
							checked={form.isActive}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									isActive: event.target.checked,
								}))
							}
						/>
						Visible on the public Donate page
					</label>

					<div className="flex items-center justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={resetForm}
							disabled={saveGateway.isPending}
						>
							Clear
						</Button>
						<Button type="submit" disabled={saveGateway.isPending}>
							{saveGateway.isPending ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Saving
								</>
							) : editingGateway ? (
								"Update Gateway"
							) : (
								"Create Gateway"
							)}
						</Button>
					</div>
				</form>
			</div>

			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<div className="mb-4">
					<h3 className="text-xl font-semibold text-foreground">
						Donation Gateways
					</h3>
					<p className="text-sm text-muted-foreground">
						Manage the wallets and QR images shown on the public
						Donate page.
					</p>
				</div>

				{isLoading ? (
					<div className="flex items-center justify-center p-10">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : gateways.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
						No donation gateways yet.
					</div>
				) : (
					<div className="grid gap-3 md:grid-cols-2">
						{gateways.map((gateway) => (
							<div
								key={gateway.id}
								className="rounded-xl border border-border bg-secondary/30 p-4"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="font-semibold text-foreground">
											{gateway.gatewayName}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											Sort order: {gateway.sortOrder}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{gateway.isActive
												? "Visible to donors"
												: "Hidden from donors"}
										</p>
									</div>
									<div className="flex gap-1">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => {
												setEditingGatewayId(gateway.id);
												setSelectedFile(null);
												setForm({
													gatewayName:
														gateway.gatewayName,
													accountName:
														gateway.accountName ??
														"",
													accountNumber:
														gateway.accountNumber ??
														"",
													walletDetails:
														gateway.walletDetails ??
														"",
													qrImagePath:
														gateway.qrImagePath ??
														"",
													qrImageUrl:
														gateway.qrImageUrl ??
														"",
													isActive:
														gateway.isActive,
													sortOrder: String(
														gateway.sortOrder,
													),
												});
											}}
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() =>
												deleteGateway.mutate(gateway)
											}
											disabled={deleteGateway.isPending}
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</div>
								</div>

								{gateway.accountName ? (
									<p className="mt-3 text-sm text-foreground">
										Account name: {gateway.accountName}
									</p>
								) : null}
								{gateway.accountNumber ? (
									<div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
										<p className="min-w-0 truncate text-sm font-medium text-foreground">
											{gateway.accountNumber}
										</p>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={async () => {
												try {
													await navigator.clipboard.writeText(
														gateway.accountNumber ??
															"",
													);
													toast.success(
														"Account number copied",
													);
												} catch {
													toast.error(
														"Could not copy account number",
													);
												}
											}}
										>
											<Copy className="h-3.5 w-3.5" />
										</Button>
									</div>
								) : null}
								{gateway.walletDetails ? (
									<p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
										{gateway.walletDetails}
									</p>
								) : null}
								{gateway.qrImageUrl ? (
									<div className="mt-4 overflow-hidden rounded-xl border border-border bg-background p-2">
										<img
											src={gateway.qrImageUrl}
											alt={`${gateway.gatewayName} QR`}
											className="h-44 w-full rounded-lg object-contain"
										/>
									</div>
								) : null}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
