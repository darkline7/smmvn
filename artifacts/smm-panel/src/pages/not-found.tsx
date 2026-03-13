import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="text-center max-w-md">
        <div className="text-[120px] font-display font-bold leading-none text-primary/20 animate-pulse">404</div>
        <h1 className="mt-4 text-3xl font-display font-bold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-4 text-muted-foreground text-lg">
          Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
        <div className="mt-8">
          <Link href="/">
            <Button size="lg" className="rounded-xl px-8 shadow-lg shadow-primary/20">Go back home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
