import { Redirect } from "expo-router";

import { DEFAULT_WEB_PATH } from "@/lib/webWrapper/webConfig";

export default function LegacyMealTypeLogRoute() {
  return <Redirect href={{ pathname: "/web", params: { path: DEFAULT_WEB_PATH } }} />;
}
