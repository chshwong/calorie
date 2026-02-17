import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * This file is web-only and used to configure the root HTML for every web page during static rendering.
 * The contents of this function only run in Node.js environments and are not included in the final bundle.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        
        {/* Favicon configuration - order matters */}
        {/* SVG as primary favicon (modern browsers) */}
        <link
          rel="icon"
          type="image/svg+xml"
          href="/favicon.svg"
        />
        
        {/* ICO as legacy fallback */}
        <link
          rel="alternate icon"
          href="/favicon.ico"
        />
        
        {/* PNG for future compatibility hint */}
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32.png"
        />
        
        {/* Apple touch icon (recommended) */}
        <link
          rel="apple-touch-icon"
          href="/favicon-32.png"
        />
        
        {/* 
          Use `ScrollViewStyleReset` to prevent the body from scrolling on web.
          This ensures the app's scrollable content is contained within the app.
        */}
        <ScrollViewStyleReset />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var mode = localStorage.getItem('app_theme_mode');
                  var resolved = 'light';
                  if (mode === 'dark' || mode === 'light') {
                    resolved = mode;
                  } else {
                    resolved =
                      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
                        ? 'dark'
                        : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', resolved);
                } catch (e) {}
              })();
            `,
          }}
        />
        <style
          // Applies before hydration so startup screen respects dark mode immediately.
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --startup-bg: #f7f7f7;
                --startup-text-secondary: #6b6b6b;
              }
              html[data-theme='dark'] {
                --startup-bg: #0f1216;
                --startup-text-secondary: #b8c0ca;
              }
              html[data-theme='light'] {
                --startup-bg: #f7f7f7;
                --startup-text-secondary: #6b6b6b;
              }
              body { background: var(--startup-bg); }
              @keyframes startupMascotBob {
                0% { transform: translateY(0px) scale(1); }
                50% { transform: translateY(-3px) scale(1.01); }
                100% { transform: translateY(0px) scale(1); }
              }
              #startup-mascot-fallback {
                animation: startupMascotBob 1600ms ease-in-out infinite;
                transform-origin: center center;
                will-change: transform;
              }
            `,
          }}
        />
        
        {/* Add any additional <head> elements here */}
      </head>
      <body>{children}</body>
    </html>
  );
}

