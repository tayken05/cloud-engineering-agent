export type JobProvider = "ashby" | "greenhouse" | "lever";

export type EmployerBoard = Readonly<{
  canonicalUrl: string;
  careersUrl: string;
  employerName: string;
  employerSlug: string;
  externalSourceId: string;
  provider: JobProvider;
  providerScope?: Readonly<{ department: string }>;
  verifiedPostingIds?: readonly string[];
  websiteUrl: string;
}>;

export type ProviderJob = Readonly<{
  applicationUrl: string;
  description: string;
  employmentType: string | null;
  externalId: string;
  location: string;
  providerUpdatedAt: Date | null;
  publishedAt: Date | null;
  sourceListingUrl: string;
  title: string;
  workplaceType: string | null;
}>;

export type BoardResult = Readonly<{
  board: EmployerBoard;
  jobs: readonly ProviderJob[];
}>;

export type BoardFailure = Readonly<{
  board: EmployerBoard;
  reason: "aborted" | "http" | "invalid_response" | "network" | "response_too_large";
}>;

export type DiscoveryResult = Readonly<{
  failures: readonly BoardFailure[];
  successes: readonly BoardResult[];
}>;
