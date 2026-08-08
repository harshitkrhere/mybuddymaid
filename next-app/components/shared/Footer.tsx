import Link from 'next/link';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Column 1: Our Services */}
        <div className="footer-column">
          <h3>Our Services</h3>
          <ul>
            <li><Link href="/maid-service" className="footer-link">Maid Service</Link></li>
            <li><Link href="/full-time-maid-service" className="footer-link">Full-Time Live-In</Link></li>
            <li><Link href="/cook-service" className="footer-link">Cook Service</Link></li>
            <li><Link href="/nanny-service" className="footer-link">Nanny & Babysitting</Link></li>
            <li><Link href="/elderly-care-service" className="footer-link">Elderly Care</Link></li>
            <li><Link href="/postnatal-care-service" className="footer-link">Postnatal Care</Link></li>
          </ul>
        </div>

        {/* Column 2: Top Cities */}
        <div className="footer-column">
          <h3>Top Cities</h3>
          <ul>
            <li><Link href="/maid-service-in-delhi" className="footer-link">Delhi</Link></li>
            <li><Link href="/maid-service-in-mumbai" className="footer-link">Mumbai</Link></li>
            <li><Link href="/maid-service-in-bangalore" className="footer-link">Bangalore</Link></li>
            <li><Link href="/maid-service-in-hyderabad" className="footer-link">Hyderabad</Link></li>
            <li><Link href="/maid-service-in-pune" className="footer-link">Pune</Link></li>
            <li><Link href="/maid-service-in-chennai" className="footer-link">Chennai</Link></li>
            <li><Link href="/maid-service-in-kolkata" className="footer-link">Kolkata</Link></li>
            <li><Link href="/maid-service-in-gurugram" className="footer-link">Gurugram</Link></li>
            <li><Link href="/maid-service-in-noida" className="footer-link">Noida</Link></li>
            <li><Link href="/maid-service-in-ahmedabad" className="footer-link">Ahmedabad</Link></li>
          </ul>
        </div>

        {/* Column 3: Resources */}
        <div className="footer-column">
          <h3>Resources</h3>
          <ul>
            <li><Link href="/blog-find-reliable-maid-delhi" className="footer-link">How to Find a Maid</Link></li>
            <li><Link href="/blog-elderly-care-at-home-guide" className="footer-link">Elderly Care Guide</Link></li>
            <li><Link href="/blog-maid-vs-cook-vs-nanny" className="footer-link">Maid vs Cook vs Nanny</Link></li>
            <li><Link href="/#pricing" className="footer-link">Pricing & Packages</Link></li>
            <li><Link href="/#faq" className="footer-link">FAQs</Link></li>
          </ul>
        </div>

        {/* Column 4: Company */}
        <div className="footer-column footer-company">
          <h3>Company</h3>
          <p>MyBuddyMaid is your trusted partner for reliable, background-verified domestic help services across India.</p>
          <div className="footer-contact-item">
            <span>📞</span> +91 9599390188
          </div>
          <div className="footer-contact-item">
            <span>✉️</span> info@mybuddymaid.in
          </div>
          <a href="https://wa.me/919599390188" target="_blank" rel="noopener noreferrer" className="whatsapp-btn">
            Chat on WhatsApp
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; 2026 MyBuddyMaid. All Rights Reserved.</p>
      </div>
    </footer>
  );
}
