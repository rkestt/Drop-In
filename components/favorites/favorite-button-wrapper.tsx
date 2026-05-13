"use client";

import { FavoriteButton as FavoriteButtonClient } from "@/components/favorites/favorite-button";

interface FavoriteButtonProps {
  courtId: string;
}

export function FavoriteButtonWrapper({ courtId }: FavoriteButtonProps) {
  return <FavoriteButtonClient courtId={courtId} />;
}