// Inline, synchronous pre-paint bootstrap: rendered by src/app/layout.tsx via
// next/script with strategy="beforeInteractive" so it executes (and blocks
// parsing) before the rest of the document is parsed or painted. It only
// ever writes one narrowly-scoped attribute — no fetch, no auth, no
// session/local storage read, no display-mode check — so an eligible URL
// shows the overlay's static first frame immediately instead of the homepage
// flashing through first.
//
// Also arms an 8-second no-hydration failsafe: if the React component never
// takes over (a JS failure, a slow/broken bundle), the player must not stay
// trapped behind the static logo forever. AppSplashScreen clears this timer
// itself the moment its own hydration effect runs.
//
// Exported (test-only use, plus rendering by the root layout) so its exact
// behavior can be unit-tested directly by evaluating the string, rather than
// only trusting a description of what it's supposed to do.
export const APP_LAUNCH_BOOTSTRAP_SCRIPT = `(function(){try{var candidate=false;try{candidate=window.location.pathname==='/'&&new URLSearchParams(window.location.search).get('source')==='pwa';}catch(e){}document.documentElement.dataset.pwLaunch=candidate?'pending':'skip';if(candidate){window.__PW_APP_LAUNCH_BOOTSTRAP_TIMEOUT__=setTimeout(function(){try{document.documentElement.dataset.pwLaunch='skip';}catch(e){}},8000);}}catch(e){try{document.documentElement.dataset.pwLaunch='skip';}catch(e2){}}})();`;
