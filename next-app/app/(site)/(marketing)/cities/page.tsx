import { PRIMARY_CITIES, EXPANSION_CITIES } from '@/data/cities'
import { SERVICES } from '@/data/services'
import { generatePageMetadata } from '@/lib/seo/metadata'
import { organizationSchema, breadcrumbSchema, JsonLd } from '@/lib/seo/schema'
import { generateSlug } from '@/lib/seo/slug-parser'
import Link from 'next/link'
import '@/styles/cities-hub.css'
import { Metadata } from 'next'

export const metadata: Metadata = generatePageMetadata({
  title: 'Maid Service Available in 40+ Cities Across India | MyBuddyMaid',
  description: 'Find top-rated maid services, cooks, babysitters, and more in 40+ cities across India including Mumbai, Delhi, Bangalore, and Pune with MyBuddyMaid.',
  path: '/cities',
})

export default function CitiesHubPage() {
  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Cities', url: '/cities' }
  ]

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      
      <main className="cities-hub-page">
        <section className="cities-hero">
          <div className="container">
            <h1>We Serve 40+ Cities Across India</h1>
            <p>Find professional, verified domestic help in your city. From full-time maids to expert cooks and caring babysitters.</p>
          </div>
        </section>

        <section className="cities-section primary">
          <div className="container">
            <h2>Primary Cities</h2>
            <p className="section-desc">Fully operational cities with comprehensive service coverage.</p>
            <div className="cities-grid">
              {PRIMARY_CITIES.map(city => (
                <div key={city.slug} className="city-card">
                  <div className="city-header">
                    <div>
                      <h3>{city.name}</h3>
                      <span className="city-state">{city.state}</span>
                    </div>
                    <span className="status-badge active">⭐ Active</span>
                  </div>
                  <div className="city-services">
                    {SERVICES.map(service => (
                      <Link 
                        key={service.slug} 
                        href={`/${generateSlug(service.slug, city.slug)}`}
                        className="service-link"
                      >
                        {service.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="cities-section expansion">
          <div className="container">
            <h2>Expanding Cities</h2>
            <p className="section-desc">Cities where our network of professionals is rapidly growing.</p>
            <div className="cities-grid">
              {EXPANSION_CITIES.map(city => (
                <div key={city.slug} className="city-card">
                  <div className="city-header">
                    <div>
                      <h3>{city.name}</h3>
                      <span className="city-state">{city.state}</span>
                    </div>
                    <span className="status-badge expanding">Expanding</span>
                  </div>
                  <div className="city-services">
                    {SERVICES.map(service => (
                      <Link 
                        key={service.slug} 
                        href={`/${generateSlug(service.slug, city.slug)}`}
                        className="service-link"
                      >
                        {service.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
