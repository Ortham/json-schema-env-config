import { readFileSync } from 'fs';
import { snakeCase, isObject } from 'lodash';
import { JSONSchema4, JSONSchema6 } from 'json-schema';
import debugConstructor from 'debug';

const debug = debugConstructor('json-schema-env-config');

type JSONType =
  | string
  | number
  | boolean
  | null
  | Array<JSONType>
  // Can't use Record here without hitting a circular reference error.
  | { [member: string]: JSONType };

type JSONSchema = JSONSchema4 | JSONSchema6;

type Visitor = {
  visitSchema: (
    schema: JSONSchema,
    configPropertyPath: ConfigPropertyPath
  ) => void;
};

type ConfigPropertyPathItem = { value: string; named: boolean };
type ConfigPropertyPath = ConfigPropertyPathItem[];

export class UnsupportedSchema extends Error {
  constructor(message: string) {
    super(message);
  }
}

function getEnvVarName(configPropertyPath: ConfigPropertyPath): string {
  return configPropertyPath
    .map((pathItem) => {
      if (pathItem.named) {
        return snakeCase(pathItem.value).toUpperCase();
      }
      return pathItem.value;
    })
    .join('_');
}

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
  switch (value.toLowerCase()) {
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
    return JSON.parse(envVarValue);
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
    return JSON.parse(envVarValue);
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
  const value = Number(envVarValue);
  if (Number.isNaN(value)) {
    debug(
      'Ignoring env var "%s": the value "%s" is not numeric',
      envVarName,
      envVarValue
    );
    return undefined;
  }
  return value;
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

function parseEnvVarValue(
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

function walkConfigProperties(
  schema: JSONSchema,
  configPropertyPath: ConfigPropertyPath,
  visitor: Visitor
): void {
  if (schema.anyOf) {
    for (const elementSchema of schema.anyOf) {
      if (typeof elementSchema === 'boolean') {
        throw new UnsupportedSchema(
          'Boolean "anyOf" keyword element values are not supported'
        );
      }

      // It doesn't matter that this doesn't stop on the first success, because
      // an env var will only be used to set a config property once.
      // However, if two or more of the anyOf elements have the 'object' type
      // and properties with the same name(s) but different type(s), this can
      // lead to invalid config being read, but that can't be avoided without
      // performing validation against all possible combinations of values to
      // discard any that are invalid before selecting one to use.
      walkConfigFields(elementSchema, configPropertyPath, visitor);
    }
    return;
  }

  visitor.visitSchema(schema, configPropertyPath);

  if (schema.properties) {
    for (const name of Object.keys(schema.properties)) {
      const propertySchema = schema.properties[name];

      if (typeof propertySchema === 'boolean') {
        throw new UnsupportedSchema(
          'Boolean "properties" keyword object properties are not supported'
        );
      }

      walkConfigProperties(
        propertySchema,
        configPropertyPath.concat({ value: name, named: true }),
        visitor
      );
    }
  }
}

function readFromFileVariant(
  envVarName: string,
  env: NodeJS.ProcessEnv
): string | undefined {
  const filePath = env[envVarName];

  if (!filePath) {
    return undefined;
  }

  try {
    const content = readFileSync(filePath, 'utf8').trim();
    debug('Loaded value for "%s" from file at "%s"', envVarName, filePath);
    return content || undefined;
  } catch (err) {
    debug(
      'Could not load value for "%s" from file at "%s"',
      envVarName,
      filePath
    );
    return undefined;
  }
}

function readFromEnvVar(
  schema: JSONSchema,
  configPropertyPath: ConfigPropertyPath,
  env: NodeJS.ProcessEnv,
  envVarNames: Map<string, ConfigPropertyPath>
): JSONType | undefined {
  const envVarName = getEnvVarName(configPropertyPath);
  const envVarValue = env[envVarName];

  const previousPath = envVarNames.get(envVarName);
  if (previousPath !== undefined) {
    debug(
      'Env var named "%s" was derived for %j and previously for %j',
      envVarName,
      configPropertyPath,
      previousPath
    );
    return undefined;
  }

  if (envVarValue === undefined) {
    return undefined;
  }

  const value = parseEnvVarValue(envVarName, envVarValue, schema);

  if (value !== undefined) {
    envVarNames.set(envVarName, configPropertyPath);
    debug(
      'Loaded value "%s" for env var "%s" using raw value "%s"',
      value,
      envVarName,
      envVarValue
    );
  }

  return value;
}

function readFromFileEnvVar(
  schema: JSONSchema,
  configPropertyPath: ConfigPropertyPath,
  env: NodeJS.ProcessEnv,
  envVarNames: Map<string, ConfigPropertyPath>
): JSONType | undefined {
  const envVarName = getEnvVarName(
    configPropertyPath.concat({ value: 'FILE', named: false })
  );
  const envVarValue = env[envVarName];

  const previousPath = envVarNames.get(envVarName);
  if (previousPath !== undefined) {
    debug(
      'Env var named "%s" was derived for %j and previously for %j',
      envVarName,
      configPropertyPath,
      previousPath
    );
    return undefined;
  }

  if (envVarValue === undefined) {
    return undefined;
  }

  const rawValue = readFromFileVariant(envVarName, env);
  if (rawValue === undefined) {
    return undefined;
  }

  const value = parseEnvVarValue(envVarName, rawValue, schema);

  if (value !== undefined) {
    envVarNames.set(envVarName, configPropertyPath);
  }

  return value;
}

function createParentObjects(
  configPropertyPath: ConfigPropertyPath,
  rootObject: Record<string, JSONType>
): Record<string, JSONType> {
  let configObject = rootObject;
  for (const pathItem of configPropertyPath.slice(
    0,
    configPropertyPath.length - 1
  )) {
    if (configObject[pathItem.value] === undefined) {
      configObject[pathItem.value] = {};
    }
    const propertyValue = configObject[pathItem.value];
    if (!isObject(propertyValue) || Array.isArray(propertyValue)) {
      throw new Error(
        `Cannot recurse into non-object property named ${pathItem} in path ${JSON.stringify(
          configPropertyPath
        )}`
      );
    }

    configObject = propertyValue;
  }

  return configObject;
}

export function loadFromEnv(
  env: NodeJS.ProcessEnv,
  schema: JSONSchema
): Record<string, JSONType> {
  const envConfig: Record<string, JSONType> = {};

  const envVarNames = new Map<string, ConfigPropertyPath>();

  const visitor: Visitor = {
    visitSchema(schema, configPropertyPath) {
      if (configPropertyPath.length === 0) {
        return;
      }

      let value = readFromEnvVar(schema, configPropertyPath, env, envVarNames);

      if (value === undefined) {
        value = readFromFileEnvVar(
          schema,
          configPropertyPath,
          env,
          envVarNames
        );
      }

      if (value === undefined) {
        return;
      }

      // Now add the value to the config object, creating any parent objects
      // as necessary.
      const configObject = createParentObjects(configPropertyPath, envConfig);

      configObject[
        configPropertyPath[configPropertyPath.length - 1].value
      ] = value;
    }
  };

  // Iterate through the schema to discover all possible config fields. For
  // each field, work out what its fully-qualified (i.e. including parent
  // field names) environment variable would be called, and check if it
  // exists.
  walkConfigProperties(schema, [], visitor);

  return envConfig;
}
