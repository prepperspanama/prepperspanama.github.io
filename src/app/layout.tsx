import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import "./globals.css";
import Navigation from "@/components/Navigation";
import PWARegistration from "@/components/PWARegistration";
import ReadingProgress from "@/components/ReadingProgress";
import BackToTop from "@/components/BackToTop";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/constants";
import logo from "../../public/logo.webp";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - Preparación y Supervivencia`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.webp",
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "es_PA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        {/* Security Headers (Meta Tag implementations for Static Sites) */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://server.arcgisonline.com https://nowcoast.noaa.gov https://unpkg.com https://satellitemaps.nesdis.noaa.gov; font-src 'self' data:; connect-src 'self' https://api.open-meteo.com https://cloud.umami.is; object-src 'none'; base-uri 'self'; frame-src 'none'; frame-ancestors 'none'; form-action 'self';"
        />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <script defer src="https://cloud.umami.is/script.js" data-website-id="91fd4640-1243-4498-9645-263f5c1ee5dd"></script>
      </head>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-cyan-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-mono"
        >
          Saltar al contenido principal
        </a>
        <PWARegistration />
        <ReadingProgress />
        <Navigation />
        <main id="main-content" className="flex-grow">{children}</main>
        <footer className="bg-zinc-900 border-t border-zinc-800 text-zinc-400 py-12">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Image src={logo} alt="Logo Preppers Panamá" width={32} height={32} className="h-8 w-auto" />
                  <h3 className="text-white font-bold">Preppers Panamá</h3>
                </div>
                <p className="text-sm">Fomentando la resiliencia y la preparación en la República de Panamá. Tecnología, equipo y conocimiento para lo inesperado.</p>
              </div>
            </div>
            <div className="pt-8 border-t border-zinc-800 text-center text-xs space-y-1">
              <p>© 2026 Preppers Panamá. La preparación es responsabilidad de todos.</p>
              <p>Este sitio está bajo la <a href="/license" className="text-zinc-500 hover:text-cyan-400 transition-colors">GNU General Public License v3.0</a>.</p>
            </div>
          </div>
        </footer>
        <BackToTop />
      </body>
    </html>
  );
}
