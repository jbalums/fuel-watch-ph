import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ReportForm } from "@/components/ReportForm";
import { useAuth } from "@/contexts/AuthContext";

export default function ReportPage() {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div className="flex min-h-[calc(100dvh-185px)] items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/auth" replace />;
	}

	return (
		<div className="min-h-[calc(100dvh-185px)]">
			<ReportForm />
		</div>
	);
}
