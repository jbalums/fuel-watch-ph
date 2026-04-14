import { Loader2, QrCode, Wallet } from "lucide-react";
import { toast } from "@/lib/app-toast";
import { useDonationGateways } from "@/hooks/useDonationGateways";
import { Button } from "@/components/ui/button";

async function copyText(value: string, label: string) {
	try {
		await navigator.clipboard.writeText(value);
		toast.success(`${label} copied`);
	} catch {
		toast.error(`Could not copy ${label.toLowerCase()}`);
	}
}

export default function DonatePage() {
	const { data: gateways = [], isLoading } = useDonationGateways({
		onlyActive: true,
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<Wallet className="h-5 w-5" />
					</div>
					<div>
						<h2 className="text-headline text-foreground">
							Support FuelWatch PH
						</h2>
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							Your donations help us keep FuelWatch PH online,
							improve station coverage, and maintain reporting and
							map tools for motorists across the Philippines.
						</p>
					</div>
				</div>
			</div>

			{gateways.length === 0 ? (
				<div className="rounded-2xl bg-card p-8 text-center shadow-sovereign">
					<p className="text-base font-semibold text-foreground">
						Donation gateways will be available soon.
					</p>
					<p className="mt-2 text-sm text-muted-foreground">
						Please check back later if you’d like to support the
						platform.
					</p>
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{gateways.map((gateway) => (
						<div
							key={gateway.id}
							className="rounded-2xl bg-card p-5 shadow-sovereign"
						>
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-lg font-semibold text-foreground">
										{gateway.gatewayName}
									</p>
									{gateway.accountName ? (
										<p className="mt-1 text-sm text-muted-foreground">
											Account name: {gateway.accountName}
										</p>
									) : null}
								</div>
								<div className="rounded-xl bg-primary/10 p-2 text-primary">
									<QrCode className="h-4 w-4" />
								</div>
							</div>

							{gateway.accountNumber ? (
								<div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
									<p className="text-xs uppercase tracking-wide text-muted-foreground">
										Wallet / Account Number
									</p>
									<p className="mt-1 break-all text-base font-semibold text-foreground">
										{gateway.accountNumber}
									</p>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="mt-3"
										onClick={() =>
											void copyText(
												gateway.accountNumber ?? "",
												"Account number",
											)
										}
									>
										Copy Number
									</Button>
								</div>
							) : null}

							{gateway.walletDetails ? (
								<div className="mt-4 rounded-xl border border-border bg-secondary/20 p-4">
									<p className="text-xs uppercase tracking-wide text-muted-foreground">
										Details
									</p>
									<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
										{gateway.walletDetails}
									</p>
								</div>
							) : null}

							{gateway.qrImageUrl ? (
								<div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background p-3">
									<img
										src={gateway.qrImageUrl}
										alt={`${gateway.gatewayName} QR code`}
										className="h-full w-full rounded-xl object-contain"
									/>
								</div>
							) : null}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
