import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Award, Heart, MapPin, Phone, Mail } from 'lucide-react';
import { useCurrentUser } from '../store';
import AuthPromptModal from '../components/AuthPromptModal';

function FacebookIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export default function About() {
  const user = useCurrentUser();
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  function handleBookClick(e: React.MouseEvent) {
    if (user) return;
    e.preventDefault();
    setAuthPromptOpen(true);
  }

  return (
    <div className="pt-16 min-h-screen bg-navy-950">
      <AuthPromptModal open={authPromptOpen} onClose={() => setAuthPromptOpen(false)} redirectAfterLogin="/book" />
      {/* Hero */}
      <section className="relative py-28 bg-navy-900">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=600&fit=crop&auto=format)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">Our Story</div>
            <h1 className="font-serif text-5xl md:text-6xl text-cream-100 mb-6">About Luxurious Cleaning Co.</h1>
            <p className="text-cream-300 text-lg leading-relaxed">
              Founded in San Juan City, Metro Manila with a commitment to bringing luxury-hospitality standards to every home and office we touch.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">Our Mission</div>
            <h2 className="font-serif text-4xl text-cream-100 mb-5">We Believe Every Space Deserves to be Cared For</h2>
            <div className="space-y-4 text-cream-300 leading-relaxed">
              <p>
                Luxurious Cleaning Co. was born from a simple conviction: the standard of care applied to a five-star hotel suite should be available to every home, office, and property in the city.
              </p>
              <p>
                We don't simply clean. We care for the environments where people live, work, and create. Every service is an expression of that care — thorough, transparent, and delivered by professionals who take genuine pride in their work.
              </p>
              <p>
                Our real-time portal, professional training program, and relentless commitment to quality are not features — they are the natural result of taking our responsibility to clients seriously.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <img
              src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=600&fit=crop&auto=format"
              alt="Our team at work"
              className="rounded-2xl h-64 w-full object-cover"
            />
            <img
              src="https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=500&h=600&fit=crop&auto=format"
              alt="Pristine results"
              className="rounded-2xl h-64 w-full object-cover mt-8"
            />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-navy-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">What Drives Us</div>
            <h2 className="font-serif text-4xl text-cream-100">Our Values</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Award, title: 'Excellence', desc: 'We hold every team member and every job to an unwavering standard. Good enough is never good enough.' },
              { icon: Heart, title: 'Care', desc: 'We treat every home and office as if it were our own. That means attention, discretion, and genuine pride in the work.' },
              { icon: Users, title: 'Transparency', desc: 'Real-time updates, before and after photos, and honest communication at every stage of every booking.' },
            ].map(v => (
              <div key={v.title} className="text-center">
                <div className="w-14 h-14 rounded-full bg-gold-400/10 border border-gold-400/20 flex items-center justify-center mx-auto mb-5">
                  <v.icon size={20} className="text-gold-400" />
                </div>
                <h3 className="font-serif text-xl text-cream-100 mb-3">{v.title}</h3>
                <p className="text-sm text-cream-300 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-navy-800 border-t border-gold-400/10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">Visit Us</div>
          <h2 className="font-serif text-3xl text-cream-100 mb-6">Find Us in San Juan City</h2>
          <div className="bg-navy-900 border border-gold-400/10 rounded-2xl p-8 mb-10 text-left space-y-4">
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-gold-400 shrink-0 mt-0.5" />
              <p className="text-sm text-cream-300 leading-relaxed">
                Atlanta Centre, 31 Annapolis Street, San Juan City, Metro Manila, San Juan, Philippines
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Phone size={16} className="text-gold-400 shrink-0 mt-0.5" />
              <a href="tel:09190024136" className="text-sm text-cream-300 hover:text-cream-50 transition-colors">
                0919 002 4136
              </a>
            </div>
            <div className="flex items-start gap-3">
              <Mail size={16} className="text-gold-400 shrink-0 mt-0.5" />
              <a href="mailto:luxuriouscleaning.klassic@gmail.com" className="text-sm text-cream-300 hover:text-cream-50 transition-colors break-all">
                luxuriouscleaning.klassic@gmail.com
              </a>
            </div>
            <div className="flex items-start gap-3">
              <FacebookIcon size={16} className="text-gold-400 shrink-0 mt-0.5" />
              <a
                href="https://www.facebook.com/luxuriouscleaningph/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-cream-300 hover:text-cream-50 transition-colors break-all"
              >
                facebook.com/luxuriouscleaningph
              </a>
            </div>
          </div>
          <h2 className="font-serif text-3xl text-cream-100 mb-4">Ready to Experience It?</h2>
          <Link to="/book" onClick={handleBookClick} className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold px-8 py-3.5 rounded-lg transition-colors">
            Book Your First Service <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
