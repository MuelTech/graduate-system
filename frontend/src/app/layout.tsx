import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: "EARIST Graduate School Information System",
  description:
    "Your comprehensive portal for graduate school management — from application to thesis defense and research repository.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
