import {
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { PageLoader } from "@/components/PageLoader";
import { RouteSeo } from "@/components/RouteSeo";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useMaintenanceModeFeature } from "@/hooks/useSystemFeatureFlags";
import MaintenancePage from "./pages/MaintenancePage";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Loader2 } from "lucide-react";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const queryClient = new QueryClient();
const AppShellLayout = lazy(() =>
	import("@/components/AppShellLayout").then((module) => ({
		default: module.AppShellLayout,
	})),
);
const AdminLayout = lazy(() =>
	import("@/components/admin/AdminLayout").then((module) => ({
		default: module.AdminLayout,
	})),
);
const LguLayout = lazy(() =>
	import("@/components/lgu/LguLayout").then((module) => ({
		default: module.LguLayout,
	})),
);
const Index = lazy(() => import("./pages/Index"));
const MapPage = lazy(() => import("./pages/MapPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const EmbeddedStationsPage = lazy(() => import("./pages/EmbeddedStationsPage"));
const ReportPage = lazy(() => import("./pages/ReportPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const AdminStationsPage = lazy(() => import("./pages/AdminStationsPage"));
const AdminStationsSummaryPage = lazy(
	() => import("./pages/AdminStationsSummaryPage"),
);
const AdminReportsPage = lazy(() => import("./pages/AdminReportsPage"));
const AdminClaimsPage = lazy(() => import("./pages/AdminClaimsPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminLguUsersPage = lazy(() => import("./pages/AdminLguUsersPage"));
const AdminBrandLogosPage = lazy(() => import("./pages/AdminBrandLogosPage"));
const AdminDonationGatewaysPage = lazy(
	() => import("./pages/AdminDonationGatewaysPage"),
);
const AdminStationDiscoveryPage = lazy(
	() => import("./pages/AdminStationDiscoveryPage"),
);
const AdminAccessRequestsPage = lazy(
	() => import("./pages/AdminAccessRequestsPage"),
);
const AdminAccessRequestDetailPage = lazy(
	() => import("./pages/AdminAccessRequestDetailPage"),
);
const AdminInvitesPage = lazy(() => import("./pages/AdminInvitesPage"));
const AdminGeoBackfillPage = lazy(() => import("./pages/AdminGeoBackfillPage"));
const AdminPlatformControlsPage = lazy(
	() => import("./pages/AdminPlatformControlsPage"),
);
const AdminStationExperiencesPage = lazy(
	() => import("./pages/AdminStationExperiencesPage"),
);
const SystemPreviewPage = lazy(() => import("./pages/SystemPreviewPage"));
const Auth = lazy(() => import("./pages/Auth"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const AdminAccessRequestPage = lazy(
	() => import("./pages/AdminAccessRequestPage"),
);
const AdminInviteRegistrationPage = lazy(
	() => import("./pages/AdminInviteRegistrationPage"),
);
const ContactUs = lazy(() => import("./pages/ContactUs"));
const DonatePage = lazy(() => import("./pages/DonatePage"));
const StationExperiencesPage = lazy(
	() => import("./pages/StationExperiencesPage"),
);
const LguPage = lazy(() => import("./pages/LguPage"));
const LguStationsPage = lazy(() => import("./pages/LguStationsPage"));
const LguStationsSummaryPage = lazy(
	() => import("./pages/LguStationsSummaryPage"),
);
const LguReportsPage = lazy(() => import("./pages/LguReportsPage"));
const LguStationExperiencesPage = lazy(
	() => import("./pages/LguStationExperiencesPage"),
);
const LguTeamPage = lazy(() => import("./pages/LguTeamPage"));
const Profile = lazy(() => import("./pages/Profile"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const StationManagerDashboard = lazy(
	() => import("./pages/StationManagerDashboard"),
);
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));
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

function RouteFallback() {
	return (
		<div className="flex min-h-[320px] items-center justify-center bg-background">
			<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
		</div>
	);
}

function withRouteSuspense(element: ReactNode) {
	return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
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
			<RouteSeo />
			<PageLoader visible={pageLoaderVisible} />
			<div className="flex-1">
				<Routes>
					<Route
						path="/embed/stations"
						element={withRouteSuspense(<EmbeddedStationsPage />)}
					/>
					<Route element={withRouteSuspense(<AppShellLayout />)}>
						<Route path="/" element={withRouteSuspense(<Index />)} />
						<Route
							path="/map"
							element={withRouteSuspense(<MapPage />)}
						/>
						<Route
							path="/search"
							element={withRouteSuspense(<SearchPage />)}
						/>
						<Route
							path="/report"
							element={withRouteSuspense(<ReportPage />)}
						/>
						<Route
							path="/donate"
							element={withRouteSuspense(<DonatePage />)}
						/>
						<Route
							path="/manager"
							element={withRouteSuspense(
								<StationManagerDashboard />,
							)}
						/>
						<Route
							path="/station-experiences"
							element={withRouteSuspense(
								<StationExperiencesPage />,
							)}
						/>
						<Route
							path="/admin"
							element={withRouteSuspense(<AdminLayout />)}
						>
							<Route
								index
								element={withRouteSuspense(<AdminPage />)}
							/>
							<Route
								path="stations"
								element={withRouteSuspense(
									<AdminStationsPage />,
								)}
							/>
							<Route
								path="stations-summary"
								element={withRouteSuspense(
									<AdminStationsSummaryPage />,
								)}
							/>
							<Route
								path="reports"
								element={withRouteSuspense(
									<AdminReportsPage />,
								)}
							/>
							<Route
								path="station-experiences"
								element={withRouteSuspense(
									<AdminStationExperiencesPage />,
								)}
							/>
							<Route
								path="claims"
								element={withRouteSuspense(
									<AdminClaimsPage />,
								)}
							/>
							<Route
								path="users"
								element={withRouteSuspense(<AdminUsersPage />)}
							/>
							<Route
								path="station-discovery"
								element={withRouteSuspense(
									<AdminStationDiscoveryPage />,
								)}
							/>
							<Route
								path="brand-logos"
								element={withRouteSuspense(
									<AdminBrandLogosPage />,
								)}
							/>
							<Route
								path="donation-gateways"
								element={withRouteSuspense(
									<AdminDonationGatewaysPage />,
								)}
							/>
							<Route
								path="lgu-users"
								element={withRouteSuspense(
									<AdminLguUsersPage />,
								)}
							/>
							<Route
								path="access-requests"
								element={withRouteSuspense(
									<AdminAccessRequestsPage />,
								)}
							/>
							<Route
								path="access-requests/:requestId"
								element={withRouteSuspense(
									<AdminAccessRequestDetailPage />,
								)}
							/>
							<Route
								path="invites"
								element={withRouteSuspense(
									<AdminInvitesPage />,
								)}
							/>
							<Route
								path="geo-backfill"
								element={withRouteSuspense(
									<AdminGeoBackfillPage />,
								)}
							/>
							<Route
								path="platform-controls"
								element={withRouteSuspense(
									<AdminPlatformControlsPage />,
								)}
							/>
							<Route
								path="system-preview"
								element={withRouteSuspense(
									<SystemPreviewPage />,
								)}
							/>
						</Route>
						<Route
							path="/lgu"
							element={withRouteSuspense(<LguLayout />)}
						>
							<Route
								index
								element={withRouteSuspense(<LguPage />)}
							/>
							<Route
								path="stations"
								element={withRouteSuspense(
									<LguStationsPage />,
								)}
							/>
							<Route
								path="stations-summary"
								element={withRouteSuspense(
									<LguStationsSummaryPage />,
								)}
							/>
							<Route
								path="reports"
								element={withRouteSuspense(<LguReportsPage />)}
							/>
							<Route
								path="station-experiences"
								element={withRouteSuspense(
									<LguStationExperiencesPage />,
								)}
							/>
							<Route
								path="team"
								element={withRouteSuspense(<LguTeamPage />)}
							/>
						</Route>
					</Route>
					<Route
						path="/auth"
						element={withRouteSuspense(<Auth />)}
					/>
					<Route
						path="/admin-access-request"
						element={withRouteSuspense(<AdminAccessRequestPage />)}
					/>
					<Route
						path="/admin-invite/:token"
						element={withRouteSuspense(
							<AdminInviteRegistrationPage />,
						)}
					/>
					<Route
						path="/about-us"
						element={withRouteSuspense(<AboutUs />)}
					/>
					<Route
						path="/contact-us"
						element={withRouteSuspense(<ContactUs />)}
					/>
					<Route
						path="/profile"
						element={withRouteSuspense(<Profile />)}
					/>
					<Route
						path="/privacy-policy"
						element={withRouteSuspense(<PrivacyPolicy />)}
					/>
					<Route
						path="/terms"
						element={withRouteSuspense(<Terms />)}
					/>
					<Route
						path="*"
						element={withRouteSuspense(<NotFound />)}
					/>
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
