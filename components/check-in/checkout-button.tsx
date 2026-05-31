"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

interface CheckoutButtonProps {
  checkInId: string;
}

export function CheckoutButton({ checkInId }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("check_ins")
        .update({ status: "checked_out", checked_out_at: new Date().toISOString() })
        .eq("id", checkInId)
        .eq("status", "active");

      if (error) throw error;
      router.refresh();
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleCheckout}
      disabled={loading}
    >
      <LogOut className="w-4 h-4 mr-1.5" />
      {loading ? "Uscita..." : "Lascio il campo"}
    </Button>
  );
}
