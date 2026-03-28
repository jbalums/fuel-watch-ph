import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { StationClaimRequest, StationClaimReviewStatus } from "@/types/station";
import {
  createStationClaimProofUrl,
  removeStationClaimProof,
} from "@/lib/station-claim-upload";

type StationClaimRow = Tables<"station_claim_requests">;

async function mapStationClaimRequest(
  claim: StationClaimRow,
): Promise<StationClaimRequest> {
  const proofDocumentUrl = claim.proof_document_path
    ? await createStationClaimProofUrl(claim.proof_document_path).catch(() => null)
    : null;

  return {
    id: claim.id,
    stationId: claim.station_id,
    userId: claim.user_id,
    businessName: claim.business_name,
    contactName: claim.contact_name,
    contactPhone: claim.contact_phone,
    notes: claim.notes,
    proofDocumentPath: claim.proof_document_path,
    proofDocumentFilename: claim.proof_document_filename,
    proofDocumentUrl,
    reviewStatus: claim.review_status as StationClaimReviewStatus,
    reviewedAt: claim.reviewed_at,
    reviewedBy: claim.reviewed_by,
    createdAt: claim.created_at,
  };
}

export function useMyStationClaims() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["station_claim_requests", "mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("station_claim_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return await Promise.all((data ?? []).map(mapStationClaimRequest));
    },
  });
}

export function useAdminStationClaims(enabled = false) {
  return useQuery({
    queryKey: ["admin", "station_claim_requests"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("station_claim_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return await Promise.all((data ?? []).map(mapStationClaimRequest));
    },
  });
}

export function useSubmitStationClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      stationId: string;
      userId: string;
      businessName: string;
      contactName: string;
      contactPhone: string;
      notes: string;
      proofDocumentPath?: string | null;
      proofDocumentFilename?: string | null;
    }) => {
      const { error } = await supabase.from("station_claim_requests").insert({
        station_id: payload.stationId,
        user_id: payload.userId,
        business_name: payload.businessName,
        contact_name: payload.contactName,
        contact_phone: payload.contactPhone,
        notes: payload.notes.trim() || null,
        proof_document_path: payload.proofDocumentPath ?? null,
        proof_document_filename: payload.proofDocumentFilename ?? null,
      });

      if (error) {
        if (payload.proofDocumentPath) {
          await removeStationClaimProof(payload.proofDocumentPath).catch(
            () => undefined,
          );
        }
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["station_claim_requests", "mine"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "station_claim_requests"],
        }),
      ]);
    },
  });
}

export function useApproveStationClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (claimId: string) => {
      const { data, error } = await supabase.rpc("approve_station_claim", {
        _claim_id: claimId,
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "station_claim_requests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "gas_stations"],
        }),
        queryClient.invalidateQueries({ queryKey: ["gas_stations"] }),
        queryClient.invalidateQueries({ queryKey: ["managed_station"] }),
        queryClient.invalidateQueries({
          queryKey: ["station_claim_requests", "mine"],
        }),
      ]);
    },
  });
}

export function useRejectStationClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (claimId: string) => {
      const { data, error } = await supabase.rpc("reject_station_claim", {
        _claim_id: claimId,
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "station_claim_requests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["station_claim_requests", "mine"],
        }),
      ]);
    },
  });
}
