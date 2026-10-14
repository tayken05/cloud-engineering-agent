import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cloud-engineering-agent.vercel.app"),
  title: "Cloud Engineering Agent",
  description: "Cloud Engineering Intelligence and X Content Platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Resolve only the theme attribute before paint; browser preference is unavailable on the server. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('cloud-agent-theme-v1');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{}`,
          }}
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
