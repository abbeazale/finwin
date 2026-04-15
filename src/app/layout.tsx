import type { Metadata } from 'next'
import {DM_Sans, Sora} from 'next/font/google'
import './globals.css'
 

const heading = Sora({})

export const metadata: Metadata = {
  title: 'Finwind - Manage Your Finances with Ease',
  description: 'Welcome to finwind, the best way to manage your finances.',
}

export default function RootLayout({
    // Layouts must accept a children prop.
    // This will be populated with nested layouts or pages
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
      <html lang="en">
        <body className={``}>{children}</body>
      </html>
    )
}
