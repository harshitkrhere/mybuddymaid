'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import './Header.css';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial scroll position
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="container nav-container">
          <Link href="/" className="nav-logo" onClick={closeMobileMenu}>
            <img src="/logo.png" alt="MyBuddyMaid Logo" />
          </Link>
          
          <nav className="nav-links">
            <Link href="/#services">Services</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/#blog">Blog</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>
          
          <div className="nav-right">
            <Link href="/home" className="btn btn-primary btn-nav-cta">
              Book Now
            </Link>
            <button 
              className={`hamburger ${isMobileMenuOpen ? 'active' : ''}`} 
              aria-label="Open Mobile Menu"
              onClick={toggleMobileMenu}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      <div id="mobileMenu" className={`mobile-menu ${isMobileMenuOpen ? 'active' : ''}`}>
        <Link href="/#services" onClick={closeMobileMenu}>Services</Link>
        <Link href="/#pricing" onClick={closeMobileMenu}>Pricing</Link>
        <Link href="/#blog" onClick={closeMobileMenu}>Blog</Link>
        <Link href="/#faq" onClick={closeMobileMenu}>FAQ</Link>
      </div>
    </>
  );
}
