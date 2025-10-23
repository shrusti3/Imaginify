import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define all public routes required by the tutorial
const isPublicRoute = createRouteMatcher([
  '/', // Homepage
  '/sign-in(.*)', // Sign-in pages
  '/sign-up(.*)', // Sign-up pages
  '/api/webhooks/clerk', // Clerk webhook
  '/api/webhooks/stripe'  // Stripe webhook
]);

// Remove 'async' here and use the provided 'auth' object directly
export default clerkMiddleware((auth, req) => {
  // Protect routes that are NOT public
  if (!isPublicRoute(req)) {
    auth.protect(); // Use the 'auth' object passed to the function
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};