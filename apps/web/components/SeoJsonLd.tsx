/**
 * Renders JSON-LD script tag(s) for structured data. Safe injection via JSON.stringify.
 */

type Schema = object | object[];

export function SeoJsonLd({ schema }: { schema: Schema }) {
  const payload = Array.isArray(schema) ? schema : [schema];
  const content = JSON.stringify(payload.length === 1 ? payload[0] : payload);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
