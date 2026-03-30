import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteFooter } from "@/components/SiteFooter";
import { AppShellLayout } from "@/components/AppShellLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import MapPage from "./pages/MapPage";
import SearchPage from "./pages/SearchPage";
import ReportPage from "./pages/ReportPage";
import AdminPage from "./pages/AdminPage";
import AdminStationsPage from "./pages/AdminStationsPage";
import AdminReportsPage from "./pages/AdminReportsPage";
import AdminClaimsPage from "./pages/AdminClaimsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import Auth from "./pages/Auth";
import AboutUs from "./pages/AboutUs";
import ContactUs from "./pages/ContactUs";
import Profile from "./pages/Profile";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import StationManagerDashboard from "./pages/StationManagerDashboard";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import { GoogleOAuthProvider } from "@react-oauth/google";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<GoogleOAuthProvider clientId={clientId}>
			<ThemeProvider>
				<AuthProvider>
					<TooltipProvider>
						<Toaster />
						<Sonner />
						<BrowserRouter>
							<div className="flex min-h-screen flex-col">
								<div className="flex-1">
									<Routes>
										<Route element={<AppShellLayout />}>
											<Route path="/" element={<Index />} />
											<Route path="/map" element={<MapPage />} />
											<Route
												path="/search"
												element={<SearchPage />}
											/>
										<Route
											path="/report"
											element={<ReportPage />}
										/>
										<Route
											path="/admin"
											element={<AdminLayout />}
										>
											<Route
												index
												element={<AdminPage />}
											/>
											<Route
												path="stations"
												element={<AdminStationsPage />}
											/>
											<Route
												path="reports"
												element={<AdminReportsPage />}
											/>
											<Route
												path="claims"
												element={<AdminClaimsPage />}
											/>
											<Route
												path="users"
												element={<AdminUsersPage />}
											/>
										</Route>
										</Route>
										<Route path="/auth" element={<Auth />} />
										<Route
											path="/about-us"
											element={<AboutUs />}
										/>
										<Route
											path="/contact-us"
											element={<ContactUs />}
										/>
										<Route path="/profile" element={<Profile />} />
										<Route
											path="/manager"
											element={<StationManagerDashboard />}
										/>
										<Route
											path="/privacy-policy"
											element={<PrivacyPolicy />}
										/>
										<Route path="/terms" element={<Terms />} />
										<Route path="*" element={<NotFound />} />
									</Routes>
								</div>
								<SiteFooter />
							</div>
						</BrowserRouter>
					</TooltipProvider>
				</AuthProvider>
			</ThemeProvider>
		</GoogleOAuthProvider>
	</QueryClientProvider>
);

export default App;
