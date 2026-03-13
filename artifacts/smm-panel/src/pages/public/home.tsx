import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, ShieldCheck, Zap, Layers } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 selection:text-primary">
      
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold font-display text-xl shadow-lg shadow-primary/30">
                S
              </div>
              <span className="font-display font-bold text-2xl tracking-tight text-foreground">SMM Pro</span>
            </div>
            <nav className="hidden md:flex gap-8">
              <Link href="/services" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Services</Link>
              <Link href="/api-docs" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">API</Link>
              <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Pricing</Link>
            </nav>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" className="font-semibold text-base hidden sm:inline-flex">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button className="font-semibold text-base shadow-lg shadow-primary/20 px-6 rounded-xl">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-40 pb-20 lg:pt-52 lg:pb-32 relative overflow-hidden">
        {/* Abstract Background mapped from requirements */}
        <div className="absolute inset-0 z-0 opacity-15 mix-blend-multiply" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/hero-bg.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
        <div className="absolute top-0 right-0 w-1/2 h-[600px] bg-primary/5 rounded-full blur-[120px] -z-10 translate-x-1/3 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-[400px] bg-accent/30 rounded-full blur-[100px] -z-10 -translate-x-1/3 translate-y-1/4"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium bg-primary/10 text-primary mb-8 border border-primary/20">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
            V2 API is now live. Faster than ever.
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-extrabold tracking-tight text-foreground max-w-5xl mx-auto leading-[1.1]">
            Scale your social <br className="hidden md:block"/> presence <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#9d4edd]">instantly.</span>
          </h1>
          <p className="mt-8 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The most advanced and reliable SMM Panel for resellers and individuals. Premium quality services delivered automatically 24/7.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/register">
              <Button size="lg" className="h-14 px-8 text-lg w-full sm:w-auto shadow-xl shadow-primary/30 hover:scale-105 transition-transform duration-300">
                Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/services">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg w-full sm:w-auto bg-background/50 backdrop-blur-sm border-border/80 hover:bg-secondary">
                View Services
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-secondary/30 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground">Why choose SMM Pro?</h2>
            <p className="mt-4 text-lg text-muted-foreground">Engineered for speed, reliability, and scale.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-3xl shadow-lg shadow-black/5 border border-border/60 hover:-translate-y-1 transition-transform duration-300">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
                <Zap className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold font-display mb-3">Lightning Fast</h3>
              <p className="text-muted-foreground leading-relaxed">Our automated system processes thousands of orders per minute without breaking a sweat.</p>
            </div>
            
            <div className="bg-card p-8 rounded-3xl shadow-lg shadow-black/5 border border-border/60 hover:-translate-y-1 transition-transform duration-300">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold font-display mb-3">Premium Quality</h3>
              <p className="text-muted-foreground leading-relaxed">We only source the highest quality profiles to ensure long-lasting, stable results.</p>
            </div>

            <div className="bg-card p-8 rounded-3xl shadow-lg shadow-black/5 border border-border/60 hover:-translate-y-1 transition-transform duration-300">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
                <BarChart3 className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold font-display mb-3">Reseller API</h3>
              <p className="text-muted-foreground leading-relaxed">Connect your own panel seamlessly with our developer-friendly V2 API endpoints.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card py-12 border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold font-display">S</div>
             <span className="font-display font-bold text-xl">SMM Pro</span>
          </div>
          <p className="text-muted-foreground text-sm">© 2024 SMM Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
