import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-foreground text-white">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="font-margo text-2xl tracking-tight mb-4">
              <span className="text-white">stevie</span>
              <span className="text-stevie-green">social</span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed max-w-xs">
              Strategic content creation and social management for established
              brands ready to stop chasing trends and start building trust.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-white/80">Company</h4>
            {/* FE-40: each link uses min-h-[44px] + flex items-center for a
                44px hit target. Removed `space-y-3` since the min-height
                now owns vertical spacing (touch-friendly list). */}
            <div>
              {[
                { href: "/about", label: "About" },
                { href: "/portfolio", label: "Portfolio" },
                { href: "/blog", label: "Blog" },
                { href: "/book", label: "Book a call" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center min-h-[44px] text-sm text-white/50 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-white/80">Get In Touch</h4>
            <p className="text-sm text-white/50 leading-relaxed mb-5">
              Ready to build a social presence that speaks for your brand?
            </p>
            <Link
              href="/book"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors"
            >
              Book a strategy call
            </Link>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-white/10 text-center text-xs text-white/30">
          &copy; {new Date().getFullYear()} Stevie Social. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
