import type { Metadata } from 'next'
import { Geist, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const display = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-finwin-display',
  weight: ['400'],
  style: ['normal', 'italic'],
})

const body = Geist({
  subsets: ['latin'],
  variable: '--font-finwin-body',
  weight: ['300', '400', '500', '600'],
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-finwin-mono',
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'FinWin — a command center for your money',
  description:
    'An architectural dark-mode personal finance workspace. Import transactions, read the room, and test your moves before making them.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
