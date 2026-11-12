import Fs from "node:fs";
import Path from "node:path";

import { VisibleError } from "~/sst/error";

export function findPackagePath(name: string, path: string) {
  if (Fs.existsSync(Path.join(path, "package.json"))) return path;

  const parent = Path.dirname(path);
  if (parent === path)
    throw new VisibleError(`Arrived at root, could not find ${name}'s package.json`);

  return findPackagePath(name, parent);
}
