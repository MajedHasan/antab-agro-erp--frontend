import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ReduxProvider } from "@/providers/ReduxProvider";
import AppInitializer from "@/providers/AppInitializer";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Antab Agro Limited ERP",
  description: "Antab Agro Limited ERP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReduxProvider>
          <AppInitializer />
          {/* <AuthProvider> */}
          <LanguageProvider>{children}</LanguageProvider>
          {/* </AuthProvider> */}
        </ReduxProvider>
        <Toaster />
      </body>
    </html>
  );
}
