import { Link } from "react-router-dom";
import logo from "@/assets/images/logo.png";
export function SiteFooter() {
	return (
		<footer className="border-t border-border bg-card/80 px-5 pb-24 pt-6 md:pb-6">
			<div className="container flex flex-col items-center gap-3 text-center">
				<img src={logo} className="h-20 w-20" />
				<div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
					<Link
						to="/privacy-policy"
						className="font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						Privacy Policy
					</Link>
					<Link
						to="/terms"
						className="font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						Terms
					</Link>
				</div>
				<p className="text-xs text-muted-foreground">
					FuelWatch PH is a community-powered platform. Prices may
					change anytime. Help us keep it accurate by reporting
					updates.
				</p>
			</div>
		</footer>
	);
}
