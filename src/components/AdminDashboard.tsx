import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  FileText,
  Fuel,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import {
  FuelReport,
  FuelReportReviewStatus,
  FuelType,
  StationStatus,
} from "@/types/station";
import { StatusBadge } from "./StatusBadge";
import { StationLocationPicker } from "./StationLocationPicker";

type GasStationRow = Tables<"gas_stations">;
type FuelReportRow = Tables<"fuel_reports">;
type AdminSection = "stations" | "reports";
type ReportFilter = FuelReportReviewStatus | "all";

type StationFormState = {
  name: string;
  address: string;
  lat: string;
  lng: string;
  fuelType: FuelType;
  pricePerLiter: string;
  status: StationStatus;
};

const initialStationForm: StationFormState = {
  name: "",
  address: "",
  lat: "",
  lng: "",
  fuelType: "Diesel",
  pricePerLiter: "",
  status: "Available",
};

const reportFilters: { value: ReportFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function mapFuelReport(report: FuelReportRow): FuelReport {
  return {
    id: report.id,
    stationName: report.station_name,
    lat: report.lat,
    lng: report.lng,
    price: Number(report.price) || 0,
    fuelType: report.fuel_type as FuelType,
    status: report.status as StationStatus,
    reportedAt: report.created_at,
    reportedBy: report.user_id,
    reviewStatus: (report.review_status ?? "pending") as FuelReportReviewStatus,
    reviewedAt: report.reviewed_at,
    reviewedBy: report.reviewed_by,
    appliedStationId: report.applied_station_id,
  };
}

function formatReviewStatusLabel(status: FuelReportReviewStatus) {
  if (status === "pending") return "Pending";
  if (status === "approved") return "Approved";
  return "Rejected";
}

function ReviewStatusBadge({ status }: { status: FuelReportReviewStatus }) {
  const styles =
    status === "approved"
      ? "bg-success/15 text-success"
      : status === "rejected"
        ? "bg-destructive/15 text-destructive"
        : "bg-warning/15 text-warning";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles}`}>
      {formatReviewStatusLabel(status)}
    </span>
  );
}

function buildStationPayload(stationForm: StationFormState) {
  const lat = Number.parseFloat(stationForm.lat);
  const lng = Number.parseFloat(stationForm.lng);
  const pricePerLiter = Number.parseFloat(stationForm.pricePerLiter);

  if (!stationForm.name.trim()) throw new Error("Station name is required");
  if (!stationForm.address.trim()) throw new Error("Station address is required");
  if (Number.isNaN(lat)) throw new Error("Latitude must be a valid number");
  if (Number.isNaN(lng)) throw new Error("Longitude must be a valid number");
  if (Number.isNaN(pricePerLiter)) throw new Error("Price per liter must be a valid number");

  return {
    name: stationForm.name.trim(),
    address: stationForm.address.trim(),
    lat,
    lng,
    fuel_type: stationForm.fuelType,
    price_per_liter: pricePerLiter,
    status: stationForm.status,
  };
}

export function AdminDashboard() {
  const { user } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useAdminRole();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<AdminSection>("stations");
  const [showStationForm, setShowStationForm] = useState(false);
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [stationForm, setStationForm] = useState<StationFormState>(initialStationForm);
  const [stationSearch, setStationSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportFilter, setReportFilter] = useState<ReportFilter>("pending");

  const { data: stations = [], isLoading: stationsLoading } = useQuery({
    queryKey: ["admin", "gas_stations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gas_stations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ["admin", "fuel_reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(mapFuelReport);
    },
    enabled: isAdmin,
  });

  const stationLookup = useMemo(
    () => new Map(stations.map((station) => [station.id, station])),
    [stations],
  );

  const filteredStations = useMemo(() => {
    const query = stationSearch.trim().toLowerCase();
    if (!query) return stations;

    return stations.filter((station) => {
      return (
        station.name.toLowerCase().includes(query) ||
        station.address.toLowerCase().includes(query)
      );
    });
  }, [stations, stationSearch]);

  const filteredReports = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesFilter = reportFilter === "all" || report.reviewStatus === reportFilter;
      const matchesSearch =
        !query ||
        report.stationName.toLowerCase().includes(query) ||
        report.fuelType.toLowerCase().includes(query) ||
        report.status.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [reportFilter, reportSearch, reports]);

  const pendingReports = reports.filter((report) => report.reviewStatus === "pending").length;
  const reviewedReports = reports.filter((report) => report.reviewStatus !== "pending").length;
  const updatesToday = reports.filter((report) => {
    return new Date(report.reportedAt).toDateString() === new Date().toDateString();
  }).length;

  const resetStationEditor = () => {
    setEditingStationId(null);
    setStationForm(initialStationForm);
    setShowStationForm(false);
  };

  const refreshAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "gas_stations"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "fuel_reports"] }),
      queryClient.invalidateQueries({ queryKey: ["gas_stations"] }),
    ]);
  };

  const saveStation = useMutation({
    mutationFn: async () => {
      const payload = buildStationPayload(stationForm);

      if (editingStationId) {
        const { error } = await supabase
          .from("gas_stations")
          .update(payload)
          .eq("id", editingStationId);

        if (error) throw error;
        return "updated" as const;
      }

      const { error } = await supabase.from("gas_stations").insert({
        ...payload,
        report_count: 0,
      });

      if (error) throw error;
      return "created" as const;
    },
    onSuccess: async (mode) => {
      await refreshAdminData();
      toast.success(mode === "created" ? "Station created" : "Station updated");
      resetStationEditor();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteStation = useMutation({
    mutationFn: async (stationId: string) => {
      const { error } = await supabase.from("gas_stations").delete().eq("id", stationId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshAdminData();
      toast.success("Station deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const approveReport = useMutation({
    mutationFn: async (reportId: string) => {
      const { data, error } = await supabase.rpc("approve_fuel_report", {
        _report_id: reportId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (stationId) => {
      await refreshAdminData();
      const matchedStation = stationId ? stationLookup.get(stationId) : null;
      toast.success(
        matchedStation
          ? `Report approved and applied to ${matchedStation.name}`
          : "Report approved",
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const rejectReport = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase.rpc("reject_fuel_report", {
        _report_id: reportId,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshAdminData();
      toast.success("Report rejected");
    },
    onError: (error) => toast.error(error.message),
  });

  const beginCreateStation = () => {
    setEditingStationId(null);
    setStationForm(initialStationForm);
    setShowStationForm(true);
  };

  const beginEditStation = (station: GasStationRow) => {
    setEditingStationId(station.id);
    setStationForm({
      name: station.name,
      address: station.address,
      lat: String(station.lat),
      lng: String(station.lng),
      fuelType: station.fuel_type as FuelType,
      pricePerLiter: String(Number(station.price_per_liter) || 0),
      status: station.status as StationStatus,
    });
    setShowStationForm(true);
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="rounded-2xl bg-card p-6 shadow-sovereign">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
          <div>
            <h2 className="text-headline text-foreground">Admin access required</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This dashboard is only available to users with the admin role.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ease: [0.2, 0.8, 0.2, 1] }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-headline text-foreground">Admin Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage fuel stations and review community-submitted reports.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSection("stations")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeSection === "stations"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Stations
          </button>
          <button
            onClick={() => setActiveSection("reports")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeSection === "reports"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Reports
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Stations", value: stations.length, icon: Fuel },
          { label: "Pending Reports", value: pendingReports, icon: FileText },
          { label: "Reviewed Reports", value: reviewedReports, icon: CheckCircle2 },
          { label: "Updates Today", value: updatesToday, icon: Activity },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
            className="rounded-xl bg-card p-5 shadow-sovereign"
          >
            <stat.icon className="h-5 w-5 text-accent" />
            <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">{stat.value}</p>
            <p className="text-label text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {activeSection === "stations" && (
        <div className="rounded-2xl bg-card p-5 shadow-sovereign">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-ui font-semibold text-foreground">Fuel Stations</h3>
              <p className="text-sm text-muted-foreground">
                Create, update, and remove station records.
              </p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search stations"
                  value={stationSearch}
                  onChange={(event) => setStationSearch(event.target.value)}
                  className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 md:w-64"
                />
              </div>
              <button
                onClick={showStationForm ? resetStationEditor : beginCreateStation}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {showStationForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {showStationForm ? "Cancel" : "Add Station"}
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showStationForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={(event) => {
                  event.preventDefault();
                  saveStation.mutate();
                }}
                className="mb-5 overflow-hidden"
              >
                <div className="grid gap-3 rounded-xl bg-muted p-4 md:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Station name"
                    value={stationForm.name}
                    onChange={(event) =>
                      setStationForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    type="text"
                    placeholder="Address"
                    value={stationForm.address}
                    onChange={(event) =>
                      setStationForm((current) => ({ ...current, address: event.target.value }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Latitude"
                    value={stationForm.lat}
                    onChange={(event) =>
                      setStationForm((current) => ({ ...current, lat: event.target.value }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Longitude"
                    value={stationForm.lng}
                    onChange={(event) =>
                      setStationForm((current) => ({ ...current, lng: event.target.value }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <StationLocationPicker
                    value={{ lat: stationForm.lat, lng: stationForm.lng }}
                    onChange={(coords) =>
                      setStationForm((current) => ({
                        ...current,
                        lat: coords.lat,
                        lng: coords.lng,
                      }))
                    }
                    existingStations={stations.map((station) => ({
                      lat: station.lat,
                      lng: station.lng,
                    }))}
                  />
                  <select
                    value={stationForm.fuelType}
                    onChange={(event) =>
                      setStationForm((current) => ({
                        ...current,
                        fuelType: event.target.value as FuelType,
                      }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Unleaded">Unleaded</option>
                    <option value="Premium">Premium</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price per liter"
                    value={stationForm.pricePerLiter}
                    onChange={(event) =>
                      setStationForm((current) => ({
                        ...current,
                        pricePerLiter: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <select
                    value={stationForm.status}
                    onChange={(event) =>
                      setStationForm((current) => ({
                        ...current,
                        status: event.target.value as StationStatus,
                      }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="Available">Available</option>
                    <option value="Low">Low</option>
                    <option value="Out">Out</option>
                  </select>
                  <button
                    type="submit"
                    disabled={saveStation.isPending}
                    className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                  >
                    {saveStation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {editingStationId ? "Save Station" : "Create Station"}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-3">
            {stationsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredStations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No stations found.
              </p>
            ) : (
              filteredStations.map((station) => (
                <div
                  key={station.id}
                  className="rounded-xl border border-border bg-secondary/40 p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{station.name}</p>
                        <StatusBadge status={station.status as StationStatus} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{station.address}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {station.fuel_type} • ₱{Number(station.price_per_liter).toFixed(2)} •{" "}
                        {station.report_count} reports
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => beginEditStation(station)}
                        className="flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete ${station.name}?`)) {
                            deleteStation.mutate(station.id);
                          }
                        }}
                        disabled={deleteStation.isPending}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSection === "reports" && (
        <div className="rounded-2xl bg-card p-5 shadow-sovereign">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-ui font-semibold text-foreground">Report Review</h3>
              <p className="text-sm text-muted-foreground">
                Approve or reject community-submitted fuel updates.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search reports"
                value={reportSearch}
                onChange={(event) => setReportSearch(event.target.value)}
                className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 md:w-64"
              />
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {reportFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setReportFilter(filter.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  reportFilter === filter.value
                    ? "bg-accent text-accent-foreground"
                    : "bg-surface-alt text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {reportsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredReports.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No reports match the current filter.
              </p>
            ) : (
              filteredReports.map((report) => {
                const appliedStation = report.appliedStationId
                  ? stationLookup.get(report.appliedStationId)
                  : null;
                const isPending = report.reviewStatus === "pending";

                return (
                  <div
                    key={report.id}
                    className="rounded-xl border border-border bg-secondary/40 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{report.stationName}</p>
                          <ReviewStatusBadge status={report.reviewStatus} />
                          <StatusBadge status={report.status} />
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {report.fuelType} • ₱{report.price.toFixed(2)} •{" "}
                          {new Date(report.reportedAt).toLocaleString()}
                        </p>

                        {report.lat !== null && report.lng !== null && (
                          <p className="text-xs text-muted-foreground">
                            GPS: {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
                          </p>
                        )}

                        <p className="mt-2 text-xs text-muted-foreground">
                          Submitted by {report.reportedBy.slice(0, 8)}
                          {report.reviewedAt
                            ? ` • Reviewed ${new Date(report.reviewedAt).toLocaleString()}`
                            : ""}
                        </p>

                        {appliedStation && (
                          <p className="mt-1 text-xs font-medium text-success">
                            Applied to station: {appliedStation.name}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {isPending ? (
                          <>
                            <button
                              onClick={() => approveReport.mutate(report.id)}
                              disabled={approveReport.isPending || rejectReport.isPending}
                              className="flex items-center gap-1.5 rounded-lg bg-success/15 px-3 py-2 text-sm font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => rejectReport.mutate(report.id)}
                              disabled={approveReport.isPending || rejectReport.isPending}
                              className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {formatReviewStatusLabel(report.reviewStatus)} report
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
