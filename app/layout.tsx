import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "./header";
import "./globals.css";
import RootLayoutClient from "./layout-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maintenance Tracker",
  description: "OC maintenance task and cost tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `/*
Well hello there, General Kenobi! 👋

This site has been vibecoded to the extreme, performing miracles of schema changes, reverting bad decisions and playing with prototyping on an app I care about the longevity of.

This is designed as my first properly sharable and usable tool with a decent level of complexity baked in. Have a fun play around and please report any bugs you find.

*/`,
          }}
        />
        {/* Runs synchronously before first paint — prevents dark mode flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <RootLayoutClient>
          <Header />
          {children}
        </RootLayoutClient>
      </body>
    </html>
  );
}
