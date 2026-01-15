import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * This file is web-only and used to configure the root HTML for every web page during static rendering.
 * The contents of this function only run in Node.js environments and are not included in the final bundle.
 */
export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        
        {/* 
          Use `ScrollViewStyleReset` to prevent the body from scrolling on web.
          This ensures the app's scrollable content is contained within the app.
        */}
        <ScrollViewStyleReset />
        
        {/* Add any additional <head> elements here */}
      </head>
      <body>{children}</body>
    </html>
  );
}
