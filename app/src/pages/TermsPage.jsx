import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText } from 'lucide-react';

export default function TermsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('terms');

  return (
    <div className="terms-page">
      <div className="terms-header-bar">
        <button className="detail-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1>{activeTab === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}</h1>
      </div>

      <div className="terms-tabs">
        <button
          className={`terms-tab ${activeTab === 'terms' ? 'active' : ''}`}
          onClick={() => setActiveTab('terms')}
        >
          <FileText size={14} /> Terms & Conditions
        </button>
        <button
          className={`terms-tab ${activeTab === 'privacy' ? 'active' : ''}`}
          onClick={() => setActiveTab('privacy')}
        >
          <Shield size={14} /> Privacy Policy
        </button>
      </div>

      {activeTab === 'terms' && (
        <div className="terms-content">
          <p className="terms-updated">Last updated: March 2026</p>

          <h3>1. Introduction</h3>
          <p>By accessing the MyBuddyMaid platform, you agree to these legal terms regarding the facilitation of domestic professional services.</p>

          <h3>2. Nature of Platform</h3>
          <p>MyBuddyMaid operates as a facilitation marketplace connecting clients with independent domestic professionals.</p>
          <ul>
            <li>We do not directly employ the service providers.</li>
            <li>Providers act as independent entities.</li>
            <li>Final employment terms (salary, specific duties) are negotiated between the client and the professional.</li>
          </ul>

          <h3>3. Verification & Safety</h3>
          <ul>
            <li>Basic KYC (Aadhaar profiling) is mandatory.</li>
            <li>Police Verification entails checking public records; however, clients bear final responsibility for establishing trust during employment.</li>
          </ul>

          <h3>4. Fee & Replacement Policy</h3>
          <ul>
            <li>The platform fee guarantees access to our verified pool and replacement timelines.</li>
            <li>If unsuited, up to 3 replacements are provided within the scope of your selected package term (Silver: 10 months / 3 replacements, Gold: 12 months / 5 replacements, Diamond: 18 months / 10 replacements).</li>
          </ul>

          <h3>5. Refund Policy</h3>
          <p>Refunds (minus processing fees) are only issued if the platform fails to provide 3 verified candidate profiles matching absolute stated criteria within 60 days of payment. No refunds are granted once a candidate is successfully hired or if the client becomes unresponsive.</p>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="terms-content">
          <p className="terms-updated">Last updated: April 2026</p>

          <h3>1. Introduction</h3>
          <p>MyBuddyMaid ("we," "our," or "us") is committed to protecting the privacy and personal data of our users. This Privacy Policy explains how we collect, use, store, and protect your information when you use our website (mybuddymaid.in) and our services.</p>

          <h3>2. Information We Collect</h3>
          <p>We collect the following types of personal information:</p>
          <ul>
            <li><strong>Identity Information:</strong> Full name as provided in booking and payment forms.</li>
            <li><strong>Contact Information:</strong> Mobile/WhatsApp number and email address.</li>
            <li><strong>Location Information:</strong> City of residence as selected during booking.</li>
            <li><strong>Service Preferences:</strong> Type of household help required and any additional notes.</li>
            <li><strong>Payment Information:</strong> Transaction IDs and payment confirmation details processed securely via Razorpay. We do not store your card numbers, UPI PINs, or bank credentials.</li>
            <li><strong>Usage Data:</strong> Pages visited, time spent, and interactions on our website collected via Google Analytics.</li>
          </ul>

          <h3>3. How We Use Your Information</h3>
          <p>Your personal data is used exclusively for:</p>
          <ul>
            <li>Processing and fulfilling your service bookings and package enrollments.</li>
            <li>Matching you with suitable, verified household professionals.</li>
            <li>Communicating booking confirmations, updates, and support via email and WhatsApp.</li>
            <li>Processing payments securely through Razorpay payment gateway.</li>
            <li>Generating invoices and maintaining transaction records.</li>
            <li>Improving our services and website experience through aggregated analytics.</li>
          </ul>

          <h3>4. Data Storage & Security</h3>
          <ul>
            <li>All data is stored securely using enterprise-grade encryption.</li>
            <li>Payment transactions are processed via Razorpay, which is PCI-DSS Level 1 compliant — the highest level of payment security certification.</li>
            <li>We use 256-bit SSL/TLS encryption for all data transmitted between your browser and our servers.</li>
            <li>Access to personal data is restricted to authorized team members only.</li>
          </ul>

          <h3>5. Third-Party Services</h3>
          <p>We use the following third-party services that may process your data:</p>
          <ul>
            <li><strong>Razorpay:</strong> For secure payment processing.</li>
            <li><strong>Google Analytics:</strong> For website usage analytics — collects anonymized browsing data.</li>
            <li><strong>Resend:</strong> For sending transactional emails (booking confirmations, invoices).</li>
          </ul>

          <h3>6. Data Sharing</h3>
          <p>We do not sell, rent, or trade your personal information to any third parties. Your data is shared only with:</p>
          <ul>
            <li>Verified household professionals matched to your booking — limited to your name, contact number, and service requirements.</li>
            <li>Payment processors (Razorpay) for transaction processing.</li>
            <li>Law enforcement authorities, if required by applicable Indian law.</li>
          </ul>

          <h3>7. Data Retention</h3>
          <p>We retain your personal data for as long as your service engagement is active, plus an additional 18 months for support and replacement guarantee purposes. Payment records are retained for 7 years as required by Indian tax regulations.</p>

          <h3>8. Your Rights</h3>
          <p>Under applicable Indian data protection laws, you have the right to:</p>
          <ul>
            <li>Request access to the personal data we hold about you.</li>
            <li>Request correction of inaccurate or incomplete data.</li>
            <li>Request deletion of your data (subject to legal retention requirements).</li>
            <li>Withdraw consent for marketing communications at any time.</li>
          </ul>
          <p>To exercise any of these rights, email us at <strong>info@mybuddymaid.in</strong>.</p>

          <h3>9. Contact Us</h3>
          <p>For any privacy-related queries or concerns, please contact:</p>
          <ul>
            <li><strong>Email:</strong> info@mybuddymaid.in</li>
            <li><strong>Address:</strong> 175, 5th Floor, Main Road, Chandra Layout, Bengaluru, KA 560040</li>
          </ul>
        </div>
      )}
    </div>
  );
}
