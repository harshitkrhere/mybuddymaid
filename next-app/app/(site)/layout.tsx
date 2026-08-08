// Layout for all pages EXCEPT the landing page.
// Wraps children with shared Header and Footer.

import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
