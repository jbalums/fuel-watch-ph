import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { PageLoader } from "@/components/PageLoader";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteFooter } from "@/components/SiteFooter";
import { AppShellLayout } from "@/components/AppShellLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LguLayout } from "@/components/lgu/LguLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useMaintenanceModeFeature } from "@/hooks/useSystemFeatureFlags";
import Index from "./pages/Index";
import MapPage from "./pages/MapPage";
import SearchPage from "./pages/SearchPage";
import EmbeddedStationsPage from "./pages/EmbeddedStationsPage";
import ReportPage from "./pages/ReportPage";
import AdminPage from "./pages/AdminPage";
import AdminStationsPage from "./pages/AdminStationsPage";
import AdminStationsSummaryPage from "./pages/AdminStationsSummaryPage";
import AdminReportsPage from "./pages/AdminReportsPage";
import AdminClaimsPage from "./pages/AdminClaimsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminLguUsersPage from "./pages/AdminLguUsersPage";
import AdminBrandLogosPage from "./pages/AdminBrandLogosPage";
import AdminDonationGatewaysPage from "./pages/AdminDonationGatewaysPage";
import AdminStationDiscoveryPage from "./pages/AdminStationDiscoveryPage";
import AdminAccessRequestsPage from "./pages/AdminAccessRequestsPage";
import AdminAccessRequestDetailPage from "./pages/AdminAccessRequestDetailPage";
import AdminInvitesPage from "./pages/AdminInvitesPage";
import AdminGeoBackfillPage from "./pages/AdminGeoBackfillPage";
import AdminPlatformControlsPage from "./pages/AdminPlatformControlsPage";
import AdminStationExperiencesPage from "./pages/AdminStationExperiencesPage";
import SystemPreviewPage from "./pages/SystemPreviewPage";
import Auth from "./pages/Auth";
import AboutUs from "./pages/AboutUs";
import AdminAccessRequestPage from "./pages/AdminAccessRequestPage";
import AdminInviteRegistrationPage from "./pages/AdminInviteRegistrationPage";
import ContactUs from "./pages/ContactUs";
import DonatePage from "./pages/DonatePage";
import StationExperiencesPage from "./pages/StationExperiencesPage";
import LguPage from "./pages/LguPage";
import LguStationsPage from "./pages/LguStationsPage";
import LguStationsSummaryPage from "./pages/LguStationsSummaryPage";
import LguReportsPage from "./pages/LguReportsPage";
import LguStationExperiencesPage from "./pages/LguStationExperiencesPage";
import LguTeamPage from "./pages/LguTeamPage";
import Profile from "./pages/Profile";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import StationManagerDashboard from "./pages/StationManagerDashboard";
import Terms from "./pages/Terms";
import MaintenancePage from "./pages/MaintenancePage";
import NotFound from "./pages/NotFound";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Loader2 } from "lucide-react";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const queryClient = new QueryClient();
const MAINTENANCE_BYPASS_PREFIXES = [
	"/admin",
	"/lgu",
	"/auth",
	"/profile",
	"/manager",
	"/admin-access-request",
	"/admin-invite",
];

function isMaintenanceBypassed(pathname: string) {
	return MAINTENANCE_BYPASS_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}

function RouterContent() {
	const location = useLocation();
	const { data: maintenanceModeFeature, isLoading: maintenanceLoading } =
		useMaintenanceModeFeature();
	const isEmbedRoute = location.pathname.startsWith("/embed/");
	const previousPathnameRef = useRef(location.pathname);
	const [pageLoaderVisible, setPageLoaderVisible] = useState(false);

	// Uncomment the line below to enable the global maintenance mode page.
	// return <MaintenancePage />;

	useEffect(() => {
		if (previousPathnameRef.current === location.pathname) {
			return;
		}

		previousPathnameRef.current = location.pathname;
		setPageLoaderVisible(true);

		const hideTimer = window.setTimeout(() => {
			setPageLoaderVisible(false);
		}, 1000);

		return () => {
			window.clearTimeout(hideTimer);
		};
	}, [location.pathname]);

	if (maintenanceLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (
		maintenanceModeFeature?.isEnabled &&
		!isMaintenanceBypassed(location.pathname)
	) {
		return <MaintenancePage />;
	}

	return (
		<div className="flex min-h-screen flex-col">
			<PageLoader visible={pageLoaderVisible} />
			<div className="flex-1">
				<Routes>
					<Route
						path="/embed/stations"
						element={<EmbeddedStationsPage />}
					/>
					<Route element={<AppShellLayout />}>
						<Route path="/" element={<Index />} />
						<Route path="/map" element={<MapPage />} />
						<Route path="/search" element={<SearchPage />} />
						<Route path="/report" element={<ReportPage />} />
						<Route path="/donate" element={<DonatePage />} />
						<Route
							path="/manager"
							element={<StationManagerDashboard />}
						/>
						<Route
							path="/station-experiences"
							element={<StationExperiencesPage />}
						/>
						<Route path="/admin" element={<AdminLayout />}>
							<Route index element={<AdminPage />} />
							<Route
								path="stations"
								element={<AdminStationsPage />}
							/>
							<Route
								path="stations-summary"
								element={<AdminStationsSummaryPage />}
							/>
							<Route
								path="reports"
								element={<AdminReportsPage />}
							/>
							<Route
								path="station-experiences"
								element={<AdminStationExperiencesPage />}
							/>
							<Route
								path="claims"
								element={<AdminClaimsPage />}
							/>
							<Route path="users" element={<AdminUsersPage />} />
							<Route
								path="station-discovery"
								element={<AdminStationDiscoveryPage />}
							/>
							<Route
								path="brand-logos"
								element={<AdminBrandLogosPage />}
							/>
							<Route
								path="donation-gateways"
								element={<AdminDonationGatewaysPage />}
							/>
							<Route
								path="lgu-users"
								element={<AdminLguUsersPage />}
							/>
							<Route
								path="access-requests"
								element={<AdminAccessRequestsPage />}
							/>
							<Route
								path="access-requests/:requestId"
								element={<AdminAccessRequestDetailPage />}
							/>
							<Route
								path="invites"
								element={<AdminInvitesPage />}
							/>
							<Route
								path="geo-backfill"
								element={<AdminGeoBackfillPage />}
							/>
							<Route
								path="platform-controls"
								element={<AdminPlatformControlsPage />}
							/>
							<Route
								path="system-preview"
								element={<SystemPreviewPage />}
							/>
						</Route>
						<Route path="/lgu" element={<LguLayout />}>
							<Route index element={<LguPage />} />
							<Route
								path="stations"
								element={<LguStationsPage />}
							/>
							<Route
								path="stations-summary"
								element={<LguStationsSummaryPage />}
							/>
							<Route
								path="reports"
								element={<LguReportsPage />}
							/>
							<Route
								path="station-experiences"
								element={<LguStationExperiencesPage />}
							/>
							<Route path="team" element={<LguTeamPage />} />
						</Route>
					</Route>
					<Route path="/auth" element={<Auth />} />
					<Route
						path="/admin-access-request"
						element={<AdminAccessRequestPage />}
					/>
					<Route
						path="/admin-invite/:token"
						element={<AdminInviteRegistrationPage />}
					/>
					<Route path="/about-us" element={<AboutUs />} />
					<Route path="/contact-us" element={<ContactUs />} />
					<Route path="/profile" element={<Profile />} />
					<Route path="/privacy-policy" element={<PrivacyPolicy />} />
					<Route path="/terms" element={<Terms />} />
					<Route path="*" element={<NotFound />} />
				</Routes>
			</div>
			{isEmbedRoute ? null : <SiteFooter />}
		</div>
	);
}

const App = () => (
	<QueryClientProvider client={queryClient}>
		<GoogleOAuthProvider clientId={clientId}>
			<ThemeProvider>
				<AuthProvider>
					<TooltipProvider>
						<Toaster />
						<Sonner />
						<BrowserRouter>
							<RouterContent />
						</BrowserRouter>
					</TooltipProvider>
				</AuthProvider>
			</ThemeProvider>
		</GoogleOAuthProvider>
	</QueryClientProvider>
);

export default App;
