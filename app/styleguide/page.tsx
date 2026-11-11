import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StyleguideClient } from "./styleguide-client";

export const metadata: Metadata = {
  title: "Styleguide — Drop-In",
  robots: { index: false },
};

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <StyleguideClient />;
}
