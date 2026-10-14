export const newsIngestionConfig = Object.freeze({
  maximumFeedCount: 12,
  maximumTotalItems: 210,
  minimumSuccessfulFeeds: 8,
  productionConfirmation:
    "INGEST APPROVED NEWS INTO NEON MAIN ep-spring-grass-b7iye83x",
});

export class NewsIngestionGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "NewsIngestionGuardError";
  }
}

function stop(message) {
  throw new NewsIngestionGuardError(message);
}

export function parseNewsIngestionCommand(arguments_) {
  if (arguments_.length !== 2) {
    stop("Choose an environment and mode: --development|--production plus --preflight|--execute.");
  }
  const [environment, mode] = arguments_;
  if (!new Set(["--development", "--production"]).has(environment)) {
    stop("Choose --development or --production.");
  }
  if (!new Set(["--preflight", "--execute"]).has(mode)) {
    stop("Choose --preflight or --execute.");
  }
  return Object.freeze({
    environment: environment.slice(2),
    mode: mode.slice(2),
  });
}

export function validateFeedCatalog(configs) {
  if (!Array.isArray(configs) || configs.length < 4 || configs.length > newsIngestionConfig.maximumFeedCount) {
    stop("The news collector exceeds its reviewed feed-count bounds.");
  }
  const sourceKeys = new Set();
  const feedUrls = new Set();
  for (const config of configs) {
    let url;
    try {
      url = new URL(config.feedUrl);
    } catch {
      stop("A configured feed URL is invalid.");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !config.allowedFeedHosts.includes(url.hostname.toLowerCase())
    ) {
      stop("Every configured feed must use its approved credential-free HTTPS host.");
    }
    if (
      sourceKeys.has(config.sourceKey) ||
      feedUrls.has(config.feedUrl) ||
      config.maxItems < 1 ||
      config.maxItems > 20 ||
      config.allowedArticleHosts.length === 0
    ) {
      stop("The feed catalog contains a duplicate or unsafe batch configuration.");
    }
    if (
      config.articleLinkPolicy !== undefined &&
      (config.articleLinkPolicy !== "linux_kernel_changelog" || config.sourceKey !== "linux-kernel-archives")
    ) {
      stop("The feed catalog contains an unsupported article-link policy.");
    }
    sourceKeys.add(config.sourceKey);
    feedUrls.add(config.feedUrl);
  }
  const totalItems = configs.reduce((total, config) => total + config.maxItems, 0);
  if (totalItems > newsIngestionConfig.maximumTotalItems) {
    stop("The feed catalog exceeds its reviewed item-processing bound.");
  }
  return configs;
}
