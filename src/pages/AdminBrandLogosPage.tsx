import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ImagePlus,
	Loader2,
	MapPinned,
	Pencil,
	Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { useStationBrandLogos } from "@/hooks/useStationBrandLogos";
import {
	removeStationBrandLogo,
	uploadStationBrandLogo,
	validateStationBrandLogo,
} from "@/lib/station-brand-logo-upload";
import type { StationBrandLogo } from "@/types/station";

type BrandLogoFormState = {
	brandName: string;
	matchKeywords: string;
	isActive: boolean;
	logoPath: string;
	logoUrl: string;
};

const initialFormState: BrandLogoFormState = {
	brandName: "",
	matchKeywords: "",
	isActive: true,
	logoPath: "",
	logoUrl: "",
};

function parseKeywords(value: string) {
	return Array.from(
		new Set(
			value
				.split(",")
				.map((keyword) => keyword.trim())
				.filter(Boolean),
		),
	);
}

export default function AdminBrandLogosPage() {
	const queryClient = useQueryClient();
	const { data: brandLogos = [], isLoading } = useStationBrandLogos();
	const [editingBrandLogoId, setEditingBrandLogoId] = useState<string | null>(
		null,
	);
	const [form, setForm] = useState<BrandLogoFormState>(initialFormState);
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

	const activePreviewUrl = selectedFilePreviewUrl ?? form.logoUrl;

	const resetForm = () => {
		setEditingBrandLogoId(null);
		setForm(initialFormState);
		setSelectedFile(null);
	};

	const saveBrandLogo = useMutation({
		mutationFn: async () => {
			const brandName = form.brandName.trim();
			if (!brandName) {
				throw new Error("Brand name is required");
			}

			const keywords = parseKeywords(form.matchKeywords);
			let nextLogoPath = form.logoPath.trim();
			let uploadedLogoPath: string | null = null;

			if (selectedFile) {
				const validationError = validateStationBrandLogo(selectedFile);
				if (validationError) {
					throw new Error(validationError);
				}

				const uploaded = await uploadStationBrandLogo({
					file: selectedFile,
					brandName,
				});
				nextLogoPath = uploaded.path;
				uploadedLogoPath = uploaded.path;
			}

			if (!nextLogoPath) {
				throw new Error("Upload a logo image before saving");
			}

			const payload = {
				brand_name: brandName,
				match_keywords: keywords,
				logo_path: nextLogoPath,
				is_active: form.isActive,
			};

			try {
				if (editingBrandLogoId) {
					const { error } = await supabase
						.from("station_brand_logos")
						.update(payload)
						.eq("id", editingBrandLogoId);

					if (error) {
						throw error;
					}

					if (
						uploadedLogoPath &&
						form.logoPath &&
						form.logoPath !== uploadedLogoPath
					) {
						await removeStationBrandLogo(form.logoPath).catch(
							() => undefined,
						);
					}

					return "updated" as const;
				}

				const { error } = await supabase
					.from("station_brand_logos")
					.insert(payload);

				if (error) {
					throw error;
				}

				return "created" as const;
			} catch (error) {
				if (uploadedLogoPath) {
					await removeStationBrandLogo(uploadedLogoPath).catch(
						() => undefined,
					);
				}

				throw error;
			}
		},
		onSuccess: async (mode) => {
			await queryClient.invalidateQueries({
				queryKey: ["station_brand_logos"],
			});
			resetForm();
			toast.success(
				mode === "created" ? "Brand logo created" : "Brand logo updated",
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const deleteBrandLogo = useMutation({
		mutationFn: async (brandLogo: StationBrandLogo) => {
			const { error } = await supabase
				.from("station_brand_logos")
				.delete()
				.eq("id", brandLogo.id);

			if (error) {
				throw error;
			}

			await removeStationBrandLogo(brandLogo.logoPath).catch(
				() => undefined,
			);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["station_brand_logos"],
			});
			if (editingBrandLogoId) {
				resetForm();
			}
			toast.deleted("Brand logo deleted");
		},
		onError: (error) => toast.error(error.message),
	});

	const editingBrandLogo = useMemo(
		() =>
			editingBrandLogoId
				? brandLogos.find((brandLogo) => brandLogo.id === editingBrandLogoId) ??
					null
				: null,
		[brandLogos, editingBrandLogoId],
	);

	return (
		<div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<div className="mb-4">
					<h3 className="text-xl font-semibold text-foreground">
						{editingBrandLogo ? "Edit Brand Logo" : "Add Brand Logo"}
					</h3>
					<p className="text-sm text-muted-foreground">
						Upload a brand logo, define its matching keywords, and
						control whether it can be used for automatic station
						marker matching.
					</p>
				</div>

				<form
					onSubmit={(event) => {
						event.preventDefault();
						saveBrandLogo.mutate();
					}}
					className="flex flex-col gap-4"
				>
					<input
						type="text"
						placeholder="Brand name"
						value={form.brandName}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								brandName: event.target.value,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
					<textarea
						rows={4}
						placeholder="Match keywords, separated by commas (e.g. PETRON, Petron, Petron Corporation)"
						value={form.matchKeywords}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								matchKeywords: event.target.value,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
					<label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
						<ImagePlus className="h-4 w-4" />
						<span className="min-w-0 flex-1 truncate">
							{selectedFile
								? selectedFile.name
								: editingBrandLogo
									? "Replace current logo image"
									: "Upload logo image"}
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
							Marker Preview
						</p>
						<div className="mt-3 flex items-center gap-3">
							<div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background">
								{activePreviewUrl ? (
									<img
										src={activePreviewUrl}
										alt={form.brandName || "Brand logo preview"}
										className="h-10 w-10 object-contain"
									/>
								) : (
									<MapPinned className="h-5 w-5 text-muted-foreground" />
								)}
							</div>
							<div className="text-xs text-muted-foreground">
								<p className="font-medium text-foreground">
									{form.brandName || "No brand name yet"}
								</p>
								<p>
									Unmatched stations continue using the default
									FuelWatch map pin.
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
						Active and available for automatic matching
					</label>

					<div className="flex items-center justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={resetForm}
							disabled={saveBrandLogo.isPending}
						>
							Clear
						</Button>
						<Button type="submit" disabled={saveBrandLogo.isPending}>
							{saveBrandLogo.isPending ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Saving
								</>
							) : editingBrandLogo ? (
								"Update Brand Logo"
							) : (
								"Create Brand Logo"
							)}
						</Button>
					</div>
				</form>
			</div>

			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<div className="mb-4">
					<h3 className="text-xl font-semibold text-foreground">
						Brand Logo Library
					</h3>
					<p className="text-sm text-muted-foreground">
						These rules drive automatic station logo matching across
						map markers and can still be overridden per station.
					</p>
				</div>

				{isLoading ? (
					<div className="flex items-center justify-center py-10">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : brandLogos.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
						No brand logos added yet.
					</div>
				) : (
					<div className="grid gap-3 md:grid-cols-2">
						{brandLogos.map((brandLogo) => (
							<div
								key={brandLogo.id}
								className="rounded-xl border border-border bg-background p-4"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="flex items-center gap-3">
										<div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-secondary/20">
											<img
												src={brandLogo.logoUrl}
												alt={brandLogo.brandName}
												className="h-10 w-10 object-contain"
											/>
										</div>
										<div>
											<p className="font-semibold text-foreground">
												{brandLogo.brandName}
											</p>
											<span
												className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
													brandLogo.isActive
														? "bg-success/15 text-success"
														: "bg-muted text-muted-foreground"
												}`}
											>
												{brandLogo.isActive ? "Active" : "Inactive"}
											</span>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => {
												setEditingBrandLogoId(brandLogo.id);
												setForm({
													brandName: brandLogo.brandName,
													matchKeywords:
														brandLogo.matchKeywords.join(", "),
													isActive: brandLogo.isActive,
													logoPath: brandLogo.logoPath,
													logoUrl: brandLogo.logoUrl,
												});
												setSelectedFile(null);
											}}
											className="rounded-lg bg-secondary p-2 text-muted-foreground transition-colors hover:text-foreground"
										>
											<Pencil className="h-4 w-4" />
										</button>
										<button
											type="button"
											onClick={() => deleteBrandLogo.mutate(brandLogo)}
											className="rounded-lg bg-destructive/10 p-2 text-destructive transition-colors hover:bg-destructive/15"
											disabled={deleteBrandLogo.isPending}
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</div>
								</div>

								<div className="mt-4 flex flex-wrap gap-2">
									{brandLogo.matchKeywords.length > 0 ? (
										brandLogo.matchKeywords.map((keyword) => (
											<span
												key={`${brandLogo.id}-${keyword}`}
												className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground"
											>
												{keyword}
											</span>
										))
									) : (
										<span className="text-xs text-muted-foreground">
											No extra keywords. Brand name will still be used
											for matching.
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
