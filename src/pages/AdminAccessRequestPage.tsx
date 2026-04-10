import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "@/lib/app-toast";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import type { OfficialAdminRole } from "@/hooks/useAdminOnboarding";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/images/Icon.png";

const roleOptions: { value: OfficialAdminRole; label: string }[] = [
	{ value: "city_admin", label: "City / Municipality Admin" },
	{ value: "province_admin", label: "Province Admin" },
];

export default function AdminAccessRequestPage() {
	const navigate = useNavigate();
	const [provinceCode, setProvinceCode] = useState("");
	const { provinces, citiesByProvince, isLoading: geoLoading, error } =
		useGeoReferences({ provinceCode });
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [mobileNumber, setMobileNumber] = useState("");
	const [officeName, setOfficeName] = useState("");
	const [positionTitle, setPositionTitle] = useState("");
	const [requestedRole, setRequestedRole] =
		useState<OfficialAdminRole>("city_admin");
	const [cityMunicipalityCode, setCityMunicipalityCode] = useState("");
	const [reason, setReason] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const availableCities = useMemo(
		() => (provinceCode ? citiesByProvince.get(provinceCode) ?? [] : []),
		[citiesByProvince, provinceCode],
	);

	const submitRequest = useMutation({
		mutationFn: async () => {
			const { error: requestError } = await supabase.rpc(
				"submit_admin_access_request",
				{
					_full_name: fullName,
					_email: email,
					_mobile_number: mobileNumber,
					_office_name: officeName,
					_position_title: positionTitle,
					_requested_role: requestedRole,
					_province_code: provinceCode,
					_city_municipality_code:
						requestedRole === "city_admin" ? cityMunicipalityCode : "",
					_reason: reason,
				},
			);

			if (requestError) {
				throw requestError;
			}
		},
		onSuccess: () => {
			setSubmitted(true);
		},
		onError: (submitError) => {
			toast.error(submitError.message);
		},
	});

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();

		if (!fullName.trim()) {
			toast.error("Full name is required");
			return;
		}

		if (!email.trim() || !email.includes("@")) {
			toast.error("Enter a valid email address");
			return;
		}

		if (!mobileNumber.trim()) {
			toast.error("Mobile number is required");
			return;
		}

		if (!officeName.trim()) {
			toast.error("Office or department is required");
			return;
		}

		if (!positionTitle.trim()) {
			toast.error("Position or designation is required");
			return;
		}

		if (!provinceCode) {
			toast.error("Select a province");
			return;
		}

		if (requestedRole === "city_admin" && !cityMunicipalityCode) {
			toast.error("Select a city or municipality");
			return;
		}

		if (!reason.trim()) {
			toast.error("Reason for access is required");
			return;
		}

		submitRequest.mutate();
	};

	return (
		<div className="min-h-screen bg-background px-5 py-8">
			<div className="mx-auto flex max-w-3xl flex-col gap-6">
				<header className="sticky top-0 z-40 surface-glass px-1 py-4">
					<div className="container flex items-center justify-between">
						<button
							type="button"
							onClick={() => navigate(-1)}
							className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-alt text-muted-foreground transition-colors hover:text-foreground"
						>
							<ArrowLeft className="h-5 w-5" />
						</button>
						<button
							type="button"
							onClick={() => navigate("/")}
							className="flex items-center gap-0 rounded-xl text-left transition-opacity hover:opacity-90"
						>
							<div className="flex h-9 w-9 items-center justify-center">
								<img src={logo} className="h-9 w-12" />
							</div>
							<div>
								<h1 className="text-base font-bold tracking-tight text-foreground">
									<span className="text-primary">FuelWatch</span>{" "}
									<span className="text-amber-600">PH</span>
								</h1>
								<p className="text-[10px] text-muted-foreground">
									Know before you fill up
								</p>
							</div>
						</button>
					</div>
				</header>

				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ ease: [0.2, 0.8, 0.2, 1] }}
					className="rounded-2xl bg-card p-6 shadow-sovereign"
				>
					<div className="mb-6 text-center">
						<h2 className="text-headline text-foreground">
							Official Admin Access Request
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							Request invite-only access for your city,
							municipality, or province office.
						</p>
					</div>

					{submitted ? (
						<div className="flex flex-col items-center gap-4 py-10 text-center">
							<CheckCircle2 className="h-12 w-12 text-success" />
							<div>
								<p className="text-lg font-semibold text-foreground">
									Request submitted
								</p>
								<p className="mt-2 text-sm text-muted-foreground">
									A super admin will review your official access
									request. If approved, you&apos;ll receive an
									invite link to complete registration.
								</p>
							</div>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="flex flex-col gap-4">
							<div className="grid gap-4 md:grid-cols-2">
								<input
									type="text"
									placeholder="Full name"
									value={fullName}
									onChange={(event) =>
										setFullName(event.target.value)
									}
									className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
								/>
								<input
									type="email"
									placeholder="Official email address"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
								/>
								<input
									type="text"
									placeholder="Mobile number"
									value={mobileNumber}
									onChange={(event) =>
										setMobileNumber(event.target.value)
									}
									className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
								/>
								<input
									type="text"
									placeholder="Office / Department"
									value={officeName}
									onChange={(event) =>
										setOfficeName(event.target.value)
									}
									className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
								/>
							</div>

							<input
								type="text"
								placeholder="Position / Designation"
								value={positionTitle}
								onChange={(event) =>
									setPositionTitle(event.target.value)
								}
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
							/>

							<div className="flex flex-col gap-1.5">
								<label className="text-label text-muted-foreground">
									Requested Role
								</label>
								<select
									value={requestedRole}
									onChange={(event) => {
										const nextRole =
											event.target.value as OfficialAdminRole;
										setRequestedRole(nextRole);
										if (nextRole === "province_admin") {
											setCityMunicipalityCode("");
										}
									}}
									className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
								>
									{roleOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>

							{geoLoading ? (
								<div className="flex items-center gap-2 rounded-xl bg-surface-alt px-4 py-3 text-sm text-muted-foreground">
									<Loader2 className="h-4 w-4 animate-spin" />
									Loading province and city options...
								</div>
							) : error ? (
								<p className="text-sm text-destructive">
									{error.message}
								</p>
							) : (
								<GeoScopeFields
									provinces={provinces}
									cities={availableCities}
									provinceCode={provinceCode}
									cityMunicipalityCode={cityMunicipalityCode}
									requestedRole={requestedRole}
									onProvinceChange={(nextProvinceCode) => {
										setProvinceCode(nextProvinceCode);
										setCityMunicipalityCode("");
									}}
									onCityChange={setCityMunicipalityCode}
								/>
							)}

							<textarea
								value={reason}
								onChange={(event) => setReason(event.target.value)}
								placeholder="Reason for access"
								rows={5}
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
							/>

							<button
								type="submit"
								disabled={submitRequest.isPending}
								className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
							>
								{submitRequest.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : null}
								Submit Request
							</button>
						</form>
					)}
				</motion.div>
			</div>
		</div>
	);
}
