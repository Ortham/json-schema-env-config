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

export class UnsupportedSchema extends Error {
  constructor(message: string) {
    super(message);
  }
}
