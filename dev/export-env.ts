import {
  isEnvironmentOverrideAllowed,
  readEnvironmentFile
} from "../constants/environment.ts";

const environmentValues = readEnvironmentFile(process.env);

for (const [name, value] of Object.entries(environmentValues)) {
  if (
    isEnvironmentOverrideAllowed(name)
    && value.trim().length > 0
  ) {
    process.stdout.write(`export ${name}=${shellQuote(value)}\n`);
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}
