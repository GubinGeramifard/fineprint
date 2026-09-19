import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuChat",
  description: "Ask questions over your documents, grounded in the sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
