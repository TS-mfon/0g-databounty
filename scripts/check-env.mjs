const required = [
  "ZERO_G_RPC_URL",
  "ZERO_G_STORAGE_INDEXER",
  "DATABOUNTY_CONTRACT",
  "VALIDATOR_PRIVATE_KEY"
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Required deployment environment variables are present.");
