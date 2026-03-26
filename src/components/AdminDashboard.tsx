import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StatusBadge } from "./StatusBadge";
import { Users, FileText, Activity, Fuel, Trash2, Plus, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReport, setNewReport] = useState({
    station_name: "",
    fuel_type: "Diesel",
    price: "",
    status: "Available",
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["fuel_reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: stationCount = 0 } = useQuery({
    queryKey: ["gas_stations_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("gas_stations")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fuel_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuel_reports"] });
      toast.success("Report deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const addReport = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("fuel_reports").insert({
        station_name: newReport.station_name,
        fuel_type: newReport.fuel_type,
        price: parseFloat(newReport.price),
        status: newReport.status,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuel_reports"] });
      toast.success("Report added");
      setShowAddForm(false);
      setNewReport({ station_name: "", fuel_type: "Diesel", price: "", status: "Available" });
    },
    onError: (e) => toast.error(e.message),
  });

  const stats = [
    { label: "Total Stations", value: stationCount, icon: Fuel },
    { label: "Total Reports", value: reports.length, icon: FileText },
    { label: "Active Users", value: "—", icon: Users },
    {
      label: "Updates Today",
      value: reports.filter((r) => {
        const today = new Date().toISOString().split("T")[0];
        return r.created_at.startsWith(today);
      }).length,
      icon: Activity,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ease: [0.2, 0.8, 0.2, 1] }}
      className="flex flex-col gap-6"
    >
      <h2 className="text-headline text-foreground">Admin Dashboard</h2>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex flex-col gap-2 rounded-xl bg-card p-5 shadow-sovereign"
          >
            <stat.icon className="h-5 w-5 text-accent" />
            <span className="text-2xl font-bold tabular-nums text-foreground">{stat.value}</span>
            <span className="text-label text-muted-foreground">{stat.label}</span>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-sovereign">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-ui font-semibold text-foreground">Fuel Reports</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAddForm ? "Cancel" : "Add Report"}
          </button>
        </div>

        <AnimatePresence>
          {showAddForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                addReport.mutate();
              }}
            >
              <div className="flex flex-col gap-3 rounded-xl bg-muted p-4">
                <input
                  type="text"
                  placeholder="Station name"
                  value={newReport.station_name}
                  onChange={(e) => setNewReport((p) => ({ ...p, station_name: e.target.value }))}
                  required
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={newReport.fuel_type}
                    onChange={(e) => setNewReport((p) => ({ ...p, fuel_type: e.target.value }))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option>Diesel</option>
                    <option>Unleaded</option>
                    <option>Premium</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    value={newReport.price}
                    onChange={(e) => setNewReport((p) => ({ ...p, price: e.target.value }))}
                    required
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <select
                    value={newReport.status}
                    onChange={(e) => setNewReport((p) => ({ ...p, status: e.target.value }))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option>Available</option>
                    <option>Low</option>
                    <option>Out</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={addReport.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {addReport.isPending ? "Adding…" : "Add Report"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-4">
          {reports.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No reports yet.</p>
          )}
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between rounded-xl bg-secondary p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{report.station_name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {report.fuel_type} • ₱{Number(report.price).toFixed(2)} •{" "}
                  {new Date(report.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={report.status as "Available" | "Low" | "Out"} />
                <button
                  onClick={() => deleteReport.mutate(report.id)}
                  disabled={deleteReport.isPending}
                  className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                  title="Delete report"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
