import debugConstructor from 'debug';
import { JSONSchema, JSONType, UnsupportedSchema } from './common';

const debug = debugConstructor('json-schema-env-config');

function parseNull(envVarName: string, envVarValue: string): null | undefined {
  if (envVarValue !== 'null') {
    debug(
      'Ignoring env var "%s": the value "%s" is not "null"',
      envVarName,
      envVarValue
    );
    return undefined;
  }
  return null;
}

function parseBoolean(value: string): boolean | undefined {
  switch (value) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      return undefined;
  }
}

function parseObject(
  envVarName: string,
  envVarValue: string
): { [member: string]: JSONType } | undefined {
  try {
    const value = JSON.parse(envVarValue);
    if (typeof value !== 'object' || Array.isArray(value) || value === null) {
      debug(
        'Ignoring env var "%s": the value "%s" is not a JSON object.',
        envVarName,
        envVarValue
      );
      return undefined;
    }
    return value;
  } catch (err) {
    debug(
      'Ignoring env var "%s": the value "%s" is not valid JSON. Details: %s',
      envVarName,
      envVarValue,
      err.message
    );
    return undefined;
  }
}

function allElementsDefined(
  array: (JSONType | undefined)[]
): array is JSONType[] {
  return !array.some((element) => element === undefined);
}

function parseCSVArray(
  envVarName: string,
  envVarValue: string,
  schema: JSONSchema
): JSONType[] | undefined {
  const itemsSchema = schema.items;
  if (itemsSchema === undefined) {
    debug('Ignoring env var "%s": its items schema is undefined', envVarName);
    return undefined;
  }

  const value = envVarValue.split(',').map((value, index) => {
    if (Array.isArray(itemsSchema)) {
      const itemSchema = itemsSchema[index] ?? schema.additionalItems;
      if (itemSchema === undefined || typeof itemSchema === 'boolean') {
        return undefined;
      }
      return parseEnvVarValue(`${envVarName}[${index}]`, value, itemSchema);
    }

    if (typeof itemsSchema === 'boolean') {
      throw new UnsupportedSchema(
        'Boolean "items" keyword values are not supported'
      );
    }

    return parseEnvVarValue(`${envVarName}[${index}]`, value, itemsSchema);
  });

  if (!allElementsDefined(value)) {
    debug(
      'Ignoring env var "%s": one or more of its elements could not be parsed into the required type',
      envVarName
    );
    return undefined;
  }

  return value;
}

function parseArray(
  envVarName: string,
  envVarValue: string,
  schema: JSONSchema
): JSONType[] | undefined {
  // Arrays can be comma-separated values if the values are scalars,
  // or they can be JSON. The values themselves also need to be
  // separately converted if the env value is interpreted as CSV.
  try {
    const value = JSON.parse(envVarValue);
    if (!Array.isArray(value)) {
      throw new Error('Parsed value is not an array');
    }
    return value;
  } catch (err) {
    debug(
      'Attempting to parse the value "%s" of env var "%s" as JSON failed, interpreting it as CSV. Parsing error: %s',
      envVarValue,
      envVarName,
      err.message
    );
    return parseCSVArray(envVarName, envVarValue, schema);
  }
}

function parseNumber(
  envVarName: string,
  envVarValue: string
): number | undefined {
  try {
    const value = JSON.parse(envVarValue);
    if (typeof value !== 'number' || Number.isNaN(value)) {
      debug(
        'Ignoring env var "%s": the value "%s" is not numeric',
        envVarName,
        envVarValue
      );
      return undefined;
    }
    return value;
  } catch (err) {
    debug(
      'Ignoring env var "%s": the value "%s" is not numeric',
      envVarName,
      envVarValue
    );
    return undefined;
  }
}

function parseInteger(
  envVarName: string,
  envVarValue: string
): number | undefined {
  const number = parseNumber(envVarName, envVarValue);
  if (number === undefined) {
    return undefined;
  }
  if (number % 1) {
    debug(
      'Ignoring env var "%s": the value "%s" is not an integer',
      envVarName,
      envVarValue
    );
    return undefined;
  }
  return number;
}

export function parseEnvVarValue(
  envVarName: string,
  envVarValue: string,
  schema: JSONSchema
): JSONType | undefined {
  const propertyType = schema.type;
  if (Array.isArray(propertyType)) {
    debug(
      'Converting env var named "%s" with value "%s", trying the following types in order: %j',
      envVarName,
      envVarValue,
      propertyType
    );

    for (const propType of propertyType) {
      const value = parseEnvVarValue(envVarName, envVarValue, {
        ...schema,
        type: propType
      });
      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }

  debug(
    'Converting env var named "%s" with value "%s" using the following schema: %j',
    envVarName,
    envVarValue,
    schema
  );

  switch (propertyType) {
    case undefined:
      debug('Ignoring env var "%s": its type is undefined', envVarName);
      return undefined;
    case 'null':
      return parseNull(envVarName, envVarValue);
    case 'boolean':
      return parseBoolean(envVarValue);
    case 'object':
      return parseObject(envVarName, envVarValue);
    case 'array':
      return parseArray(envVarName, envVarValue, schema);
    case 'integer':
      return parseInteger(envVarName, envVarValue);
    case 'number':
      return parseNumber(envVarName, envVarValue);
    case 'string':
      return envVarValue;
    default:
      throw new UnsupportedSchema(
        `Cannot handle JSON schema type ${propertyType}`
      );
  }
}
