import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "QR Recorder Server",
  description: "Desktop server app for QR duplicate checking",
  icons: {
    icon: [{ url: "/favicon.ico" }]
  }
};

const themeInitScript = `
try {
  document.documentElement.classList.toggle("dark", window.localStorage.getItem("theme") === "dark");
} catch (_) {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
