import Link from "next/link";

export default function Home() {
  return (
    <main style={{ backgroundColor: '#020202' }} className="min-h-screen">
      {/* Navigation Bar */}
      <nav className="fixed w-full top-0 z-50" style={{ backgroundColor: 'rgba(2, 2, 2, 0.95)', borderBottomColor: '#3891A6', borderBottomWidth: '1px' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-8 w-auto" />
            <div className="text-xl font-bold" style={{ color: '#3891A6' }}>
              Kryptyk Labs
            </div>
          </Link>
          <div className="flex gap-3">
            <Link
              href="/auth/signin"
              className="px-4 py-2 rounded text-white transition hover:opacity-90 text-sm"
              style={{ backgroundColor: 'rgba(56, 145, 166, 0.8)' }}
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 rounded text-white transition hover:opacity-90 text-sm font-semibold"
              style={{ backgroundColor: '#3891A6' }}
            >
              Join Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - Redesigned */}
      <div className="pt-24 pb-20 px-4" style={{ backgroundImage: 'linear-gradient(135deg, rgba(56, 145, 166, 0.1) 0%, rgba(253, 231, 76, 0.05) 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <span className="text-sm font-semibold" style={{ color: '#FDE74C' }}>PUZZLE SOLVING PLATFORM</span>
            <h1 className="text-6xl md:text-7xl font-bold text-white mt-4 leading-tight">
              Solve Mysteries<br/>
              <span style={{ color: '#3891A6' }}>Solo or Together</span>
            </h1>
            <p className="text-xl mt-6 max-w-2xl" style={{ color: '#DDDBF1' }}>
              Crack puzzles at your own pace, solo or with teams. Earn points, compete on leaderboards, and master the ultimate cryptic challenge—your way.
            </p>
          </div>

          <div className="flex gap-4 flex-wrap">
            <Link
              href="/auth/register"
              className="px-8 py-4 rounded font-semibold text-white transition transform hover:scale-105 shadow-lg"
              style={{ backgroundColor: '#3891A6', boxShadow: '0 0 20px rgba(56, 145, 166, 0.4)' }}
            >
              Start Solving
            </Link>
            <Link
              href="/auth/signin"
              className="px-8 py-4 rounded font-semibold transition"
              style={{ borderWidth: '2px', borderColor: '#3891A6', color: '#3891A6', backgroundColor: 'rgba(56, 145, 166, 0.08)' }}
            >
              Sign In
            </Link>

          </div>
        </div>
      </div>

      {/* Features Grid - Redesigned */}
      <div className="px-4 py-20 max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-white mb-4 text-center">Why Kryptyk Labs?</h2>
        <p className="text-center mb-16" style={{ color: '#DDDBF1' }}>Challenge yourself solo, collaborate with friends, or do both—the choice is yours</p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="group rounded-lg p-6 transition-all duration-300" style={{ backgroundColor: 'rgba(56, 145, 166, 0.08)', borderColor: '#3891A6', borderWidth: '1px' }}>
            <div className="text-3xl mb-4">🧩</div>
            <h3 className="text-lg font-bold text-white mb-2">Progressive Puzzles</h3>
            <p style={{ color: '#DDDBF1' }} className="text-sm">Unlock challenges in stages with dependencies and smart unlock mechanics</p>
          </div>

          {/* Feature 2 */}
          <div className="group rounded-lg p-6 transition-all duration-300" style={{ backgroundColor: 'rgba(253, 231, 76, 0.06)', borderColor: '#FDE74C', borderWidth: '1px' }}>
            <div className="text-3xl mb-4">🎯</div>
            <h3 className="text-lg font-bold text-white mb-2">Solo or Team</h3>
            <p style={{ color: '#DDDBF1' }} className="text-sm">Play solo for a personal challenge or team up with friends for collaborative mystery solving</p>
          </div>

          {/* Feature 3 */}
          <div className="group rounded-lg p-6 transition-all duration-300" style={{ backgroundColor: 'rgba(171, 159, 157, 0.06)', borderColor: '#AB9F9D', borderWidth: '1px' }}>
            <div className="text-3xl mb-4">🏆</div>
            <h3 className="text-lg font-bold text-white mb-2">Live Leaderboards</h3>
            <p style={{ color: '#DDDBF1' }} className="text-sm">Track your position globally and compete against other teams in real-time</p>
          </div>

          {/* Feature 4 */}
          <div className="group rounded-lg p-6 transition-all duration-300" style={{ backgroundColor: 'rgba(56, 145, 166, 0.08)', borderColor: '#3891A6', borderWidth: '1px' }}>
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="text-lg font-bold text-white mb-2">Strategic Hints</h3>
            <p style={{ color: '#DDDBF1' }} className="text-sm">Use hints wisely to overcome obstacles while managing your point multiplier</p>
          </div>

          {/* Feature 5 */}
          <div className="group rounded-lg p-6 transition-all duration-300" style={{ backgroundColor: 'rgba(253, 231, 76, 0.06)', borderColor: '#FDE74C', borderWidth: '1px' }}>
            <div className="text-3xl mb-4">📊</div>
            <h3 className="text-lg font-bold text-white mb-2">Instant Feedback</h3>
            <p style={{ color: '#DDDBF1' }} className="text-sm">Get real-time scoring updates and track your progress through challenges</p>
          </div>

          {/* Feature 6 */}
          <div className="group rounded-lg p-6 transition-all duration-300" style={{ backgroundColor: 'rgba(171, 159, 157, 0.06)', borderColor: '#AB9F9D', borderWidth: '1px' }}>
            <div className="text-3xl mb-4">🎯</div>
            <h3 className="text-lg font-bold text-white mb-2">Achievements</h3>
            <p style={{ color: '#DDDBF1' }} className="text-sm">Unlock badges and milestones as you progress through the puzzle universe</p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="px-4 py-20" style={{ backgroundColor: 'rgba(56, 145, 166, 0.05)', borderTopColor: '#3891A6', borderTopWidth: '1px', borderBottomColor: '#3891A6', borderBottomWidth: '1px' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Start Your Puzzle Journey</h2>
          <p className="text-lg mb-8" style={{ color: '#DDDBF1' }}>Whether you prefer solving solo or with a team, your adventure awaits</p>
          <Link
            href="/auth/register"
            className="inline-block px-10 py-4 rounded font-bold text-white transition transform hover:scale-105 shadow-lg"
            style={{ backgroundColor: '#3891A6', boxShadow: '0 0 30px rgba(56, 145, 166, 0.5)' }}
          >
            Get Started Now
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 px-4 text-center" style={{ borderTopColor: '#3891A6', borderTopWidth: '1px', color: '#DDDBF1' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center mb-4">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-8 w-auto" />
          </div>
          <p className="text-sm">Kryptyk Labs • Collaborative Puzzle Platform</p>
          <p className="text-xs mt-2" style={{ color: '#AB9F9D' }}>© 2025 All rights reserved</p>
        </div>
      </footer>
    </main>
  );
}
