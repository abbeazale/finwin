import type { Metadata } from 'next'
import { DM_Sans, Sora } from 'next/font/google'
import './globals.css'

const heading = Sora({
  subsets: ['latin'],
  variable: '--font-finwin-heading',
  weight: ['600', '700', '800'],
})

const body = DM_Sans({
  subsets: ['latin'],
  variable: '--font-finwin-body',
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'Finwind - Manage Your Finances with Ease',
  description: 'Welcome to finwind, the best way to manage your finances.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${body.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
