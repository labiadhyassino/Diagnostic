import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Mind's Up - Diagnostic élève",
  description: "Diagnostic en ligne pour évaluer les acquis et les besoins des élèves.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr">
      <body>{children}</body>
    </html>
  )
}
