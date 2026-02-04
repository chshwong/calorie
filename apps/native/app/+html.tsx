import * as React from "react";

export default function RootHtml({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
