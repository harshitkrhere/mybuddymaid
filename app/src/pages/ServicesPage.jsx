import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SERVICES } from '../lib/constants';
import { SERVICE_ICONS, SERVICE_COLORS } from '../components/ServiceIcons';

export default function ServicesPage() {
  return (
    <div className="services-page fade-in" style={{ padding: '24px' }}>
      <h1 className="services-page-title" style={{ color: '#F1F5F9' }}>Service Directory</h1>
      <div className="service-list">
        {SERVICES.map((s) => {
          const Icon = SERVICE_ICONS[s.id];
          return (
            <Link to={`/services/${s.id}`} key={s.id} className="service-list-card" style={{ background: '#1A1A1A', borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="svc-icon-box" style={{ background: SERVICE_COLORS[s.id] }}>
                {Icon && <Icon size={32} />}
              </div>
              <div className="service-list-info">
                <h3 style={{ color: '#F1F5F9' }}>{s.name}</h3>
                <p style={{ color: '#94A3B8' }}>{s.description.slice(0, 85)}...</p>
                <div className="service-list-bottom">
                  <span className="service-list-price" style={{ color: '#34D399' }}>{s.price}</span>
                  <div className="service-list-action" style={{ color: '#34D399' }}>
                    <ArrowRight size={16} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
