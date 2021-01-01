import { JSONSchema4, JSONSchema6 } from 'json-schema';

export type JSONType =
  | string
  | number
  | boolean
  | null
  | Array<JSONType>
  // Can't use Record here without hitting a circular reference error.
  | { [member: string]: JSONType };

export type JSONSchema = JSONSchema4 | JSONSchema6;

export type EnvVarNamingOptions = {
  case?: 'snake_case' | 'SCREAMING_SNAKE_CASE';
  propertySeparator?: string;
  prefix?: string;
};

/**
 * Thrown when the library encounters unsupported values in a JSON Schema (e.g.
 * an unrecognised 'type' value).
 * @extends Error
 */
export class UnsupportedSchema extends Error {
  constructor(message: string) {
    super(message);
  }
}

export const DEFAULT_OPTIONS: EnvVarNamingOptions = {
  case: 'snake_case',
  propertySeparator: '__',
  prefix: undefined
};

export function initialiseOptions(
  options: EnvVarNamingOptions
): EnvVarNamingOptions {
  const initialisedOptions = Object.assign({}, options);

  if (!initialisedOptions.case) {
    initialisedOptions.case = 'snake_case';
  }
  if (!initialisedOptions.propertySeparator) {
    initialisedOptions.propertySeparator = '__';
  }

  return initialisedOptions;
}
