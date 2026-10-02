import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Indicativos | Pesquisa',
  description: 'Pesquisa rápida de indicativos de estações.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
