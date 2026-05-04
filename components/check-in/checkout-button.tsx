"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface CheckoutButtonProps {
  checkInId: string;
}

export function CheckoutButton({ checkInId }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("check_ins")
        .update({ status: "checked_out", checked_out_at: new Date().toISOString() })
        .eq("id", checkInId);

      if (error) throw error;
      window.location.reload();
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
