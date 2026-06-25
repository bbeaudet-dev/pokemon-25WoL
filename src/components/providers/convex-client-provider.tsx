"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

const missingConvexUrl =
  "https://missing-convex-url-placeholder.convex.cloud";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(
    () =>
      new ConvexReactClient(
        process.env.NEXT_PUBLIC_CONVEX_URL ?? missingConvexUrl,
      ),
    [],
  );

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
