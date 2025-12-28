import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Oastel Admin",
  description: "Administration panel for Oastel tours and transfers",
  icons: {
    icon: "/favicons/favicon.ico",
    shortcut: "/favicons/favicon.ico",
    apple: "/favicons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          <AdminLayout>{children}</AdminLayout>
          <Toaster
            position="top-right"
            containerStyle={{ top: "3.5rem", right: "1.25rem" }}
            toastOptions={{
              duration: 4000,
              style: {
                background: "#111827",
                color: "#ffffff",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.06)",
                maxWidth: "28rem",
              },
              success: {
                duration: 3000,
                style: {
                  background: "#059669",
                  color: "#ffffff",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                  border: "1px solid rgba(0,0,0,0.06)",
                },
              },
              error: {
                duration: 4000,
                style: {
                  background: "#dc2626",
                  color: "#ffffff",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.06)",
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
