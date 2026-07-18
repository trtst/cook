import { isNonEmptyString } from "./helpers";

export function requiredText(value: unknown) {
  return isNonEmptyString(value);
}
