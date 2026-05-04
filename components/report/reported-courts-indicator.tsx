"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ReportedCourtsIndicatorProps {
  onCourtsUpdate?: (courtIds: string[]) => void;
}

export function ReportedCourtsIndicator({
  onCourtsUpdate,
}: ReportedCourtsIndicatorProps) {
  const [, setReportedCourtIds] = useState<string[]>([]);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const fetchReportedCourts = async () => {
      const { data } = await supabase
        .from("court_reports")
        .select("court_id")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      const ids = [...new Set(data?.map((r) => r.court_id) || [])];
      setReportedCourtIds(ids);
      onCourtsUpdate?.(ids);
    };

    fetchReportedCourts();

    const channel = supabase
      .channel("reported-courts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "court_reports" },
        () => fetchReportedCourts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, onCourtsUpdate]);

  return null;
}
