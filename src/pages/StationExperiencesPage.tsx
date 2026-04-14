import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ImagePlus,
	Loader2,
	MapPin,
	MessageSquarePlus,
	Search,
	Star,
	TriangleAlert,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { useStations } from "@/hooks/useStations";
import { useApprovedStationExperiences } from "@/hooks/useStationExperiences";
import { toast } from "@/lib/app-toast";
import {
	removeStationExperiencePhoto,
	STATION_EXPERIENCE_FILE_INPUT_ACCEPT,
	STATION_EXPERIENCE_MAX_PHOTO_COUNT,
	uploadStationExperiencePhoto,
	validateStationExperiencePhoto,
} from "@/lib/station-experience-photo-upload";
import {
	buildStationExperienceIdentityFromStation,
	buildStationExperienceSearch,
	getStationExperienceSentimentClassName,
	getStationExperienceSentimentLabel,
	parseStationExperienceIdentityFromSearch,
} from "@/lib/station-experience";
import { supabase } from "@/integrations/supabase/client";
import type {
	GasStation,
	StationExperienceIdentity,
	StationExperienceSentiment,
} from "@/types/station";

type LocalPhotoPreview = {
	file: File;
	previewUrl: string;
};

function identityMatchesStation(
	identity: StationExperienceIdentity | null,
	station: GasStation,
) {
	return identity?.stationId === station.id;
}

function parseSearchIdentity(searchParams: URLSearchParams) {
	return parseStationExperienceIdentityFromSearch(searchParams);
}

export default function StationExperiencesPage() {
	const queryClient = useQueryClient();
	const { user, loading: authLoading } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();
	const parsedSearchIdentity = useMemo(
		() => parseSearchIdentity(searchParams),
		[searchParams],
	);
	const { data: stations = [], isLoading: stationsLoading } = useStations();
	const [selectedIdentity, setSelectedIdentity] =
		useState<StationExperienceIdentity | null>(parsedSearchIdentity);
	const [stationSearchQuery, setStationSearchQuery] = useState("");
	const [sentiment, setSentiment] =
		useState<StationExperienceSentiment>("good");
	const [experienceText, setExperienceText] = useState("");
	const [provinceCode, setProvinceCode] = useState("");
	const [cityMunicipalityCode, setCityMunicipalityCode] = useState("");
	const [selectedPhotos, setSelectedPhotos] = useState<LocalPhotoPreview[]>(
		[],
	);
	const selectedPhotosRef = useRef<LocalPhotoPreview[]>([]);
	const selectedListedStation = useMemo(
		() =>
			stations.find((station) =>
				identityMatchesStation(selectedIdentity, station),
			) ?? null,
		[selectedIdentity, stations],
	);
	const effectiveIdentity = selectedListedStation
		? buildStationExperienceIdentityFromStation(selectedListedStation)
		: selectedIdentity;
	const { provinces, citiesByProvince } = useGeoReferences({
		provinceCode,
	});
	const availableCities = useMemo(
		() => (provinceCode ? (citiesByProvince.get(provinceCode) ?? []) : []),
		[citiesByProvince, provinceCode],
	);
	const approvedExperiencesQuery =
		useApprovedStationExperiences(effectiveIdentity);

	useEffect(() => {
		if (!parsedSearchIdentity) {
			return;
		}

		if (parsedSearchIdentity.stationId) {
			const matchedStation = stations.find(
				(station) => station.id === parsedSearchIdentity.stationId,
			);
			if (matchedStation) {
				setSelectedIdentity(
					buildStationExperienceIdentityFromStation(matchedStation),
				);
				setStationSearchQuery(matchedStation.name);
				return;
			}
		}

		setSelectedIdentity(parsedSearchIdentity);
		setStationSearchQuery(parsedSearchIdentity.stationName);
	}, [parsedSearchIdentity, stations]);

	useEffect(() => {
		if (!effectiveIdentity) {
			setProvinceCode("");
			setCityMunicipalityCode("");
			return;
		}

		setProvinceCode(effectiveIdentity.provinceCode ?? "");
		setCityMunicipalityCode(effectiveIdentity.cityMunicipalityCode ?? "");
	}, [
		effectiveIdentity?.cityMunicipalityCode,
		effectiveIdentity?.provinceCode,
		effectiveIdentity?.externalId,
		effectiveIdentity?.stationId,
	]);

	useEffect(() => {
		selectedPhotosRef.current = selectedPhotos;
	}, [selectedPhotos]);

	useEffect(() => {
		return () => {
			for (const photo of selectedPhotosRef.current) {
				URL.revokeObjectURL(photo.previewUrl);
			}
		};
	}, []);

	const stationSuggestions = useMemo(() => {
		const query = stationSearchQuery.trim().toLowerCase();
		if (!query) {
			return stations.slice(0, 8);
		}

		return stations
			.filter((station) => {
				return (
					station.name.toLowerCase().includes(query) ||
					station.address.toLowerCase().includes(query)
				);
			})
			.slice(0, 8);
	}, [stationSearchQuery, stations]);

	const selectListedStation = (station: GasStation) => {
		const nextIdentity = buildStationExperienceIdentityFromStation(station);
		setSelectedIdentity(nextIdentity);
		setStationSearchQuery(station.name);
		setSearchParams(
			new URLSearchParams(buildStationExperienceSearch(nextIdentity)),
		);
	};

	const clearSelectedIdentity = () => {
		setSelectedIdentity(null);
		setStationSearchQuery("");
		setProvinceCode("");
		setCityMunicipalityCode("");
		setSearchParams(new URLSearchParams());
	};

	const submitExperience = useMutation({
		mutationFn: async () => {
			if (!user) {
				throw new Error(
					"You need to sign in before submitting an experience.",
				);
			}
			if (!effectiveIdentity) {
				throw new Error(
					"Select a station before submitting an experience.",
				);
			}

			const trimmedExperience = experienceText.trim();
			if (!trimmedExperience) {
				throw new Error("Experience details are required.");
			}
			if (!provinceCode.trim()) {
				throw new Error("Province is required.");
			}
			if (!cityMunicipalityCode.trim()) {
				throw new Error("City or municipality is required.");
			}
			if (selectedPhotos.length > STATION_EXPERIENCE_MAX_PHOTO_COUNT) {
				throw new Error(
					`You can upload up to ${STATION_EXPERIENCE_MAX_PHOTO_COUNT} photos.`,
				);
			}

			const uploadedPhotos: { path: string; filename: string }[] = [];

			try {
				for (const photo of selectedPhotos) {
					const uploaded = await uploadStationExperiencePhoto({
						file: photo.file,
						userId: user.id,
					});
					uploadedPhotos.push(uploaded);
				}

				const payload = {
					user_id: user.id,
					station_id: effectiveIdentity.stationId,
					source: effectiveIdentity.source,
					external_id: effectiveIdentity.externalId,
					station_name: effectiveIdentity.stationName.trim(),
					station_address: effectiveIdentity.stationAddress.trim(),
					lat: effectiveIdentity.lat,
					lng: effectiveIdentity.lng,
					province_code: provinceCode.trim(),
					city_municipality_code: cityMunicipalityCode.trim(),
					sentiment,
					experience_text: trimmedExperience,
					photo_paths: uploadedPhotos.map((photo) => photo.path),
					photo_filenames: uploadedPhotos.map(
						(photo) => photo.filename,
					),
				};

				const { error } = await supabase
					.from("station_experiences")
					.insert(payload);

				if (error) {
					throw error;
				}
			} catch (error) {
				await Promise.all(
					uploadedPhotos.map((photo) =>
						removeStationExperiencePhoto(photo.path).catch(
							() => undefined,
						),
					),
				);
				throw error;
			}
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["station_experiences"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["admin", "station_experiences"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["lgu", "station_experiences"],
				}),
			]);
			setExperienceText("");
			setSentiment("good");
			setSelectedPhotos((current) => {
				for (const photo of current) {
					URL.revokeObjectURL(photo.previewUrl);
				}
				return [];
			});
			toast.success(
				"Thanks for sharing. Your experience was submitted for review.",
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const handlePhotoSelection = (files: FileList | null) => {
		if (!files) {
			return;
		}

		const nextFiles = Array.from(files);
		if (
			selectedPhotos.length + nextFiles.length >
			STATION_EXPERIENCE_MAX_PHOTO_COUNT
		) {
			toast.error(
				`You can upload up to ${STATION_EXPERIENCE_MAX_PHOTO_COUNT} photos.`,
			);
			return;
		}

		const nextPreviews: LocalPhotoPreview[] = [];
		for (const file of nextFiles) {
			const validationError = validateStationExperiencePhoto(file);
			if (validationError) {
				toast.error(validationError);
				continue;
			}

			nextPreviews.push({
				file,
				previewUrl: URL.createObjectURL(file),
			});
		}

		setSelectedPhotos((current) => [...current, ...nextPreviews]);
	};

	const removeSelectedPhoto = (previewUrl: string) => {
		setSelectedPhotos((current) => {
			const matchedPhoto = current.find(
				(photo) => photo.previewUrl === previewUrl,
			);
			if (matchedPhoto) {
				URL.revokeObjectURL(matchedPhoto.previewUrl);
			}

			return current.filter((photo) => photo.previewUrl !== previewUrl);
		});
	};

	return (
		<div className="space-y-6">
			<section className="rounded-2xl bg-card p-5 shadow-sovereign">
				<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div>
						<h2 className="text-2xl font-semibold text-foreground">
							Fuel Station Experience
						</h2>
						<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
							Share good or bad station experiences so the
							community and local authorities can review them.
							Public entries are shown only after review, and
							poster identity stays hidden on approved posts.
						</p>
					</div>
					<div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
						<div className="flex items-center gap-2 font-medium text-foreground">
							<MapPin className="h-4 w-4 text-primary" />
							Station-linked feedback
						</div>
						<p className="mt-1 text-xs">
							Choose a station from the map or search by name
							here.
						</p>
					</div>
				</div>
			</section>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
				<section className="rounded-2xl bg-card p-5 shadow-sovereign">
					<div className="mb-4">
						<h3 className="text-lg font-semibold text-foreground">
							Approved Experiences
						</h3>
						<p className="text-sm text-muted-foreground">
							Read recent station experiences that passed review.
						</p>
					</div>

					{effectiveIdentity ? (
						<div className="mb-4 rounded-xl border border-border bg-secondary/30 p-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-sm font-semibold text-foreground">
										{effectiveIdentity.stationName}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{effectiveIdentity.stationAddress}
									</p>
									<p className="mt-2 text-[11px] text-muted-foreground">
										{effectiveIdentity.stationId
											? "Listed FuelWatch PH station"
											: "Discovered station"}
									</p>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-8 px-2"
									onClick={clearSelectedIdentity}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						</div>
					) : null}

					<div className="relative mb-5">
						<Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
						<Command className="rounded-md border border-border">
							<CommandInput
								value={stationSearchQuery}
								onValueChange={setStationSearchQuery}
								placeholder="Search listed stations by name or address"
								className="pl-2"
							/>
							{stationSearchQuery.trim() ? (
								<CommandList className="max-h-64">
									<CommandEmpty>
										No listed stations match your search.
									</CommandEmpty>
									{stationSuggestions.map((station) => (
										<CommandItem
											key={station.id}
											value={`${station.name} ${station.address}`}
											onSelect={() =>
												selectListedStation(station)
											}
											className="flex flex-col items-start gap-1 py-3"
										>
											<span className="font-bold">
												{station.name}
											</span>
											<span className="text-xs ">
												{station.address}
											</span>
										</CommandItem>
									))}
								</CommandList>
							) : null}
						</Command>
					</div>

					{approvedExperiencesQuery.isLoading || stationsLoading ? (
						<div className="flex items-center justify-center py-10">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : !effectiveIdentity ? (
						<p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
							Choose a listed station from the search field, or
							open this page from the map to load a discovered
							station.
						</p>
					) : (approvedExperiencesQuery.data?.length ?? 0) === 0 ? (
						<p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
							No approved experiences for this station yet.
						</p>
					) : (
						<div className="space-y-4">
							{approvedExperiencesQuery.data?.map(
								(experience) => (
									<article
										key={experience.id}
										className="rounded-xl border border-border bg-secondary/30 p-4"
									>
										<div className="flex flex-wrap items-center gap-2">
											<span
												className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStationExperienceSentimentClassName(experience.sentiment)}`}
											>
												{getStationExperienceSentimentLabel(
													experience.sentiment,
												)}
											</span>
											<span className="text-xs text-muted-foreground">
												{new Date(
													experience.createdAt,
												).toLocaleString()}
											</span>
											<span className="text-xs text-muted-foreground">
												{experience.reporterLabel}
											</span>
										</div>
										<p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
											{experience.experienceText}
										</p>
										{experience.photoUrls.length > 0 ? (
											<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
												{experience.photoUrls.map(
													(photoUrl, index) => (
														<a
															key={`${experience.id}-photo-${index}`}
															href={photoUrl}
															target="_blank"
															rel="noreferrer"
															className="overflow-hidden rounded-lg border border-border bg-background"
														>
															<img
																src={photoUrl}
																alt={
																	experience
																		.photoFilenames[
																		index
																	] ??
																	"Station experience photo"
																}
																className="h-28 w-full object-cover"
															/>
														</a>
													),
												)}
											</div>
										) : null}
									</article>
								),
							)}
						</div>
					)}
				</section>

				<section className="rounded-2xl bg-card p-5 shadow-sovereign">
					<div className="mb-4">
						<h3 className="text-lg font-semibold text-foreground">
							Share an Experience
						</h3>
						<p className="text-sm text-muted-foreground">
							Posts are reviewed first before becoming public.
						</p>
					</div>

					{authLoading ? (
						<div className="flex items-center justify-center py-10">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : !user ? (
						<div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
							<p>
								Sign in first so we can tie your submission to
								your account for moderation.
							</p>
							<Button asChild className="mt-4">
								<Link to="/auth">Sign In to Share</Link>
							</Button>
						</div>
					) : (
						<form
							onSubmit={(event) => {
								event.preventDefault();
								submitExperience.mutate();
							}}
							className="space-y-4"
						>
							<div className="grid grid-cols-2 gap-3">
								<button
									type="button"
									onClick={() => setSentiment("good")}
									className={`rounded-xl border px-4 py-3 text-left sovereign-ease ${
										sentiment === "good"
											? "border-emerald-500 bg-emerald-500/10"
											: "border-border bg-background"
									}`}
								>
									<div className="flex items-center gap-2 text-sm font-medium text-foreground">
										<Star className="h-4 w-4 text-emerald-600" />
										Good
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										Helpful staff, fair process, or a
										positive visit.
									</p>
								</button>
								<button
									type="button"
									onClick={() => setSentiment("bad")}
									className={`rounded-xl border px-4 py-3 text-left sovereign-ease ${
										sentiment === "bad"
											? "border-rose-500 bg-rose-500/10"
											: "border-border bg-background"
									}`}
								>
									<div className="flex items-center gap-2 text-sm font-medium text-foreground">
										<TriangleAlert className="h-4 w-4 text-rose-600" />
										Bad
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										Share issues that authorities should be
										aware of.
									</p>
								</button>
							</div>

							<Textarea
								value={experienceText}
								onChange={(event) =>
									setExperienceText(event.target.value)
								}
								placeholder="Describe what happened, what stood out, and what people or authorities should know."
								className="min-h-32"
							/>

							<GeoScopeFields
								provinces={provinces}
								cities={availableCities}
								provinceCode={provinceCode}
								cityMunicipalityCode={cityMunicipalityCode}
								requestedRole="city_admin"
								onProvinceChange={(nextProvinceCode) => {
									setProvinceCode(nextProvinceCode);
									setCityMunicipalityCode("");
								}}
								onCityChange={setCityMunicipalityCode}
							/>

							<div className="rounded-xl border border-border bg-secondary/20 p-4">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<p className="text-sm font-medium text-foreground">
											Optional photos
										</p>
										<p className="text-xs text-muted-foreground">
											Up to{" "}
											{STATION_EXPERIENCE_MAX_PHOTO_COUNT}{" "}
											photos.
										</p>
									</div>
									<label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground">
										<ImagePlus className="h-4 w-4" />
										Add Photos
										<input
											type="file"
											accept={
												STATION_EXPERIENCE_FILE_INPUT_ACCEPT
											}
											multiple
											className="hidden"
											onChange={(event) => {
												handlePhotoSelection(
													event.target.files,
												);
												event.target.value = "";
											}}
										/>
									</label>
								</div>
								{selectedPhotos.length > 0 ? (
									<div className="mt-4 grid grid-cols-2 gap-3">
										{selectedPhotos.map((photo) => (
											<div
												key={photo.previewUrl}
												className="relative overflow-hidden rounded-lg border border-border bg-background"
											>
												<img
													src={photo.previewUrl}
													alt={photo.file.name}
													className="h-28 w-full object-cover"
												/>
												<button
													type="button"
													onClick={() =>
														removeSelectedPhoto(
															photo.previewUrl,
														)
													}
													className="absolute right-2 top-2 rounded-full bg-background/90 p-1 text-foreground shadow"
												>
													<X className="h-3.5 w-3.5" />
												</button>
											</div>
										))}
									</div>
								) : null}
							</div>

							<div className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
								Identity is hidden on approved public posts.
								Admin and LGU reviewers can still see who
								submitted the experience while they review it.
							</div>

							<Button
								type="submit"
								className="w-full"
								disabled={
									submitExperience.isPending ||
									!effectiveIdentity ||
									!experienceText.trim()
								}
							>
								{submitExperience.isPending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Submitting for Review...
									</>
								) : (
									<>
										<MessageSquarePlus className="h-4 w-4" />
										Submit Experience
									</>
								)}
							</Button>
						</form>
					)}
				</section>
			</div>
		</div>
	);
}
