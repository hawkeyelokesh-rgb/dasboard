import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Altira Dashboard",
  description: "Leads, bookings and closer availability",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
