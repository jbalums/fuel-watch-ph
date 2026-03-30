import { Link, useNavigate } from "react-router-dom";
import logo from "@/assets/images/logo.png";
export function SiteFooter() {
	const navigate = useNavigate();
	return (
		<footer className="border-t border-border bg-card/80 px-5 pb-24 pt-6 md:pb-6">
			<div className="container flex flex-col items-center gap-3 text-center">
				<div
					onClick={() => {
						navigate("/");
					}}
				>
					<img src={logo} className="h-20 w-20 cursor-pointer" />
				</div>
				<div className="flex flex-wrap items-center justify-center text-sm text-foreground gap-4 mb-2">
					<Link
						to="/about-us"
						className="font-bold dark:text-white transition-colors hover:text-foreground"
					>
						About Us
					</Link>
					<Link
						to="/terms"
						className="font-bold dark:text-white transition-colors hover:text-foreground"
					>
						Terms
					</Link>
					<Link
						to="/privacy-policy"
						className="font-bold dark:text-white transition-colors hover:text-foreground"
					>
						Privacy Policy
					</Link>
					<Link
						to="/contact-us"
						className="font-bold dark:text-white transition-colors hover:text-foreground"
					>
						Contact Us
					</Link>
				</div>
				<p className="text-xs text-muted-foreground mb-2">
					FuelWatch PH is a community-powered platform.Prices may
					change anytime. Help us keep it accurate by reporting
					updates.
				</p>
			</div>
		</footer>
	);
}
