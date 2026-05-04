"use client";

import { BanBanner } from "@/components/karma/ban-banner";

interface BanBannerWrapperProps {
  userId: string | null;
}

export function BanBannerWrapper({ userId }: BanBannerWrapperProps) {
  if (!userId) return null;
  return <BanBanner userId={userId} />;
}
