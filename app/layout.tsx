import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GBTI 캘린더",
  description: "GBTI 서버 전용 스케줄 정리 캘린더",
  openGraph: {
    title: "GBTI 캘린더",
    description: "GBTI 서버 전용 스케줄 정리 캘린더",
    images: [
      {
        url: "/gbti_small.jpg",
        width: 1200,
        height: 630,
        alt: "GBTI 캘린더",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GBTI 캘린더",
    description: "GBTI 서버 전용 스케줄 정리 캘린더",
    images: ["/gbti_small.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
