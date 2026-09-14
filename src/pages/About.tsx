import { Link } from 'react-router-dom';
import { ArrowRight, Users, Award, Heart } from 'lucide-react';

const TEAM = [
  { name: 'Alexandra Morgan', role: 'Founder & CEO', img: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&auto=format', bio: 'With 15 years in luxury hospitality management, Alexandra founded Luxurious Cleaning Co. with a vision to bring hotel-grade standards to residential and commercial spaces.' },
  { name: 'Marcus Chen', role: 'Head of Operations', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&auto=format', bio: 'Marcus oversees all field operations and training programs, ensuring every cleaner meets the exacting standards our clients expect.' },
  { name: 'Priya Nair', role: 'Client Relations Director', img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&auto=format', bio: 'Priya leads our client experience team, ensuring every interaction — from first booking to final photo — exceeds expectations.' },
];

export default function About() {
  return (
    <div className="pt-16 min-h-screen bg-navy-950">
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
              Founded in Toronto with a commitment to bringing luxury-hospitality standards to every home and office we touch.
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

      {/* Team */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">The People</div>
            <h2 className="font-serif text-4xl text-cream-100">Leadership Team</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {TEAM.map(member => (
              <div key={member.name} className="bg-navy-800 border border-gold-400/10 rounded-2xl overflow-hidden">
                <img src={member.img} alt={member.name} className="w-full h-56 object-cover" />
                <div className="p-6">
                  <h3 className="font-serif text-lg text-cream-100">{member.name}</h3>
                  <div className="text-xs text-gold-400 font-medium tracking-wide uppercase mt-0.5 mb-3">{member.role}</div>
                  <p className="text-sm text-cream-300 leading-relaxed">{member.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-navy-800 border-t border-gold-400/10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-serif text-3xl text-cream-100 mb-4">Ready to Experience It?</h2>
          <Link to="/book" className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold px-8 py-3.5 rounded-lg transition-colors">
            Book Your First Service <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
