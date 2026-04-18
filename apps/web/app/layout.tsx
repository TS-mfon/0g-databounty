import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "0G DataBounty",
  description: "Verifiable dataset bounty market for AI builders on 0G.",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
