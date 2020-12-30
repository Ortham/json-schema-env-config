import { readFileSync } from 'fs';
import { snakeCase, isObject } from 'lodash';
import { JSONSchema4, JSONSchema6 } from 'json-schema';
import debugConstructor from 'debug';

const debug = debugConstructor('json-schema-env-config');

const IN_PLACE_APPLICATOR_KEYWORDS: ['anyOf', 'oneOf', 'allOf'] = [
  'anyOf',
  'oneOf',
  'allOf'
];

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
  visitPatternProperty: (
    pattern: string,
    propertySchema: JSONSchema,
    parentConfigPropertyPath: ConfigPropertyPath
  ) => void;
  visitAdditionalProperties: (
    additionalPropertiesSchema: JSONSchema,
    parentConfigPropertyPath: ConfigPropertyPath
  ) => void;
};

type ConfigPropertyPathItem = { value: string; named: boolean };
type ConfigPropertyPath = ConfigPropertyPathItem[];

type DiscoveredProperty = {
  path: ConfigPropertyPath;
  schema: JSONSchema;
};

type EnvVarNamingOptions = {
  case?: 'snake_case' | 'SCREAMING_SNAKE_CASE';
  propertySeparator?: string;
  prefix?: string;
};

export class UnsupportedSchema extends Error {
  constructor(message: string) {
    super(message);
  }
}

function transformPropertyName(
  name: string,
  options: EnvVarNamingOptions
): string {
  if (options.case === 'snake_case') {
    return snakeCase(name);
  }

  return snakeCase(name).toUpperCase();
}

function getEnvVarName(
  configPropertyPath: ConfigPropertyPath,
  options: EnvVarNamingOptions
): string {
  const name = configPropertyPath
    .map((pathItem) => {
      if (pathItem.named) {
        return transformPropertyName(pathItem.value, options);
      }
      return pathItem.value;
    })
    .join(options.propertySeparator);

  if (options.prefix) {
    return options.prefix + options.propertySeparator + name;
  }

  return name;
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
  for (const keyword of IN_PLACE_APPLICATOR_KEYWORDS) {
    const schemas = schema[keyword];
    if (schemas) {
      for (const elementSchema of schemas) {
        if (typeof elementSchema === 'boolean') {
          throw new UnsupportedSchema(
            `Boolean "${keyword}" keyword element values are not supported`
          );
        }

        // It doesn't matter that this doesn't stop on the first success, because
        // an env var will only be used to set a config property once.
        // However, if two or more of the elements have the 'object' type
        // and properties with the same name(s) but different type(s), this can
        // lead to invalid config being read, but that can't be avoided without
        // performing validation against all possible combinations of values to
        // discard any that are invalid before selecting one to use.
        walkConfigProperties(elementSchema, configPropertyPath, visitor);
      }
      return;
    }
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

  if (schema.patternProperties) {
    for (const pattern of Object.keys(schema.patternProperties)) {
      const propertySchema = schema.patternProperties[pattern];

      if (typeof propertySchema === 'boolean') {
        throw new UnsupportedSchema(
          'Boolean "patternProperties" keyword object properties are not supported'
        );
      }

      visitor.visitPatternProperty(pattern, propertySchema, configPropertyPath);
    }
  }

  if (
    schema.additionalProperties !== true &&
    schema.additionalProperties !== false &&
    schema.additionalProperties !== undefined
  ) {
    visitor.visitAdditionalProperties(
      schema.additionalProperties,
      configPropertyPath
    );
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
  envVarNames: Map<string, ConfigPropertyPath>,
  options: EnvVarNamingOptions
): JSONType | undefined {
  const envVarName = getEnvVarName(configPropertyPath, options);
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
  envVarNames: Map<string, ConfigPropertyPath>,
  options: EnvVarNamingOptions
): JSONType | undefined {
  const envVarName = getEnvVarName(
    configPropertyPath.concat({ value: 'FILE', named: false }),
    options
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

function getCandidateEnvVarNameSuffixes(
  env: NodeJS.ProcessEnv,
  envVarNamePrefix: string
): string[] {
  return Object.keys(env).reduce((previous, current) => {
    if (!current.startsWith(envVarNamePrefix)) {
      debug(
        'Skipping the env var "%s", does not start with "%s"',
        current,
        envVarNamePrefix
      );
      return previous;
    }

    const suffix = current.substring(envVarNamePrefix.length);

    return previous.concat(suffix);
  }, [] as string[]);
}

function discoverUnnamedProperties(
  propertiesSchema: JSONSchema,
  candidateEnvVarNameSuffixes: string[],
  parentPath: ConfigPropertyPath,
  options: EnvVarNamingOptions
): DiscoveredProperty[] {
  switch (propertiesSchema.type) {
    case undefined:
      // No type, ignore any candidates.
      return [];
    case 'null':
    case 'boolean':
    case 'string':
    case 'integer':
    case 'number':
    case 'array': {
      // Each candidate is a field.
      return candidateEnvVarNameSuffixes.map((suffix) => ({
        path: parentPath.concat({ value: suffix, named: false }),
        schema: propertiesSchema
      }));
    }
    case 'object': {
      // Candidates may be for properties or they may be for properties of the properties.
      // We can only tell by comparing their suffixes against sub-field names.
      const propertyNameSuffixes = Object.keys(
        propertiesSchema.properties ?? {}
      ).map(
        (name) =>
          options.propertySeparator + transformPropertyName(name, options)
      );

      return candidateEnvVarNameSuffixes.map((envVarSuffix) => {
        const matchedSuffix = propertyNameSuffixes.find(
          (propertySuffix) =>
            envVarSuffix.includes(propertySuffix) &&
            envVarSuffix.length > propertySuffix.length
        );

        const additionalPropertyName = matchedSuffix
          ? envVarSuffix.substring(0, envVarSuffix.indexOf(matchedSuffix))
          : envVarSuffix;

        debug(
          'Extracted additional property name "%s" from env var suffix "%s"',
          envVarSuffix,
          matchedSuffix
        );

        return {
          schema: propertiesSchema,
          path: parentPath.concat({
            value: additionalPropertyName,
            named: false
          })
        };
      });
    }
    default:
      throw new UnsupportedSchema(
        `Cannot handle JSON schema type ${propertiesSchema.type}`
      );
  }
}

// From MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping>
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function getPatternRegex(
  pattern: string,
  propertiesSchema: JSONSchema,
  options: EnvVarNamingOptions
): RegExp {
  // If the property schema is for an object, the env var suffix may include the
  // name of one of its properties, so take that into account.
  // This only matters if the regexp matches the end of the string.

  if (
    propertiesSchema.type !== 'object' ||
    pattern.endsWith('\\$') ||
    !pattern.endsWith('$')
  ) {
    return new RegExp(pattern, 'u');
  }

  const propertyEnvVarSubstrings = Object.keys(
    propertiesSchema.properties ?? {}
  ).map((property) =>
    escapeRegExp(
      options.propertySeparator + transformPropertyName(property, options)
    )
  );

  if (propertyEnvVarSubstrings.length === 0) {
    return new RegExp(pattern, 'u');
  }

  propertyEnvVarSubstrings.push('$');
  return new RegExp(
    `${pattern.substring(
      0,
      pattern.length - 1
    )}(${propertyEnvVarSubstrings.join('|')})`,
    'u'
  );
}

function getEnvVarNamePrefix(
  parentConfigPropertyPath: ConfigPropertyPath,
  options: EnvVarNamingOptions
): string {
  const parentPropertyEnvVarName = getEnvVarName(
    parentConfigPropertyPath,
    options
  );
  return parentConfigPropertyPath.length > 0
    ? parentPropertyEnvVarName + options.propertySeparator
    : '';
}

export function loadFromEnv(
  env: NodeJS.ProcessEnv,
  schema: JSONSchema,
  options: EnvVarNamingOptions = {
    case: 'SCREAMING_SNAKE_CASE',
    propertySeparator: '_',
    prefix: undefined
  }
): Record<string, JSONType> {
  if (!options.case) {
    options.case = 'SCREAMING_SNAKE_CASE';
  }
  if (!options.propertySeparator) {
    options.propertySeparator = '_';
  }

  const envConfig: Record<string, JSONType> = {};

  const envVarNames = new Map<string, ConfigPropertyPath>();

  const visitor: Visitor = {
    visitSchema(schema, configPropertyPath) {
      if (configPropertyPath.length === 0) {
        return;
      }

      let value = readFromEnvVar(
        schema,
        configPropertyPath,
        env,
        envVarNames,
        options
      );

      if (value === undefined) {
        value = readFromFileEnvVar(
          schema,
          configPropertyPath,
          env,
          envVarNames,
          options
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
    },
    visitPatternProperty(pattern, propertiesSchema, parentConfigPropertyPath) {
      const patternRegex = getPatternRegex(pattern, propertiesSchema, options);
      const envVarNamePrefix = getEnvVarNamePrefix(
        parentConfigPropertyPath,
        options
      );

      const candidateEnvVarNameSuffixes = getCandidateEnvVarNameSuffixes(
        env,
        envVarNamePrefix
      ).filter((envVarNameSuffix) => {
        const result = patternRegex.test(envVarNameSuffix);
        if (debug.enabled) {
          const message = result
            ? 'The env var "%s" suffix "%s" matches the regex "%s" for pattern "%s"'
            : 'Skipping the env var "%s", its suffix "%s" does not match the regex "%s" for pattern "%s"';

          debug(
            message,
            envVarNamePrefix + envVarNameSuffix,
            envVarNameSuffix,
            patternRegex,
            pattern
          );
        }

        return result;
      });

      const discoveredProperties = discoverUnnamedProperties(
        propertiesSchema,
        candidateEnvVarNameSuffixes,
        parentConfigPropertyPath,
        options
      );

      for (const property of discoveredProperties) {
        walkConfigProperties(property.schema, property.path, visitor);
      }
    },
    visitAdditionalProperties(
      additionalPropertiesSchema,
      parentConfigPropertyPath
    ) {
      // Additional properties have a schema, but we don't know what they're
      // named. Their env var names will start with the env var name for this
      // field, so filter out any that don't.
      const envVarNamePrefix = getEnvVarNamePrefix(
        parentConfigPropertyPath,
        options
      );

      const candidateEnvVarNameSuffixes = getCandidateEnvVarNameSuffixes(
        env,
        envVarNamePrefix
      );

      const discoveredProperties = discoverUnnamedProperties(
        additionalPropertiesSchema,
        candidateEnvVarNameSuffixes,
        parentConfigPropertyPath,
        options
      );

      for (const property of discoveredProperties) {
        walkConfigProperties(property.schema, property.path, visitor);
      }
    }
  };

  // Iterate through the schema to discover all possible config fields. For
  // each field, work out what its fully-qualified (i.e. including parent
  // field names) environment variable would be called, and check if it
  // exists.
  walkConfigProperties(schema, [], visitor);

  return envConfig;
}
