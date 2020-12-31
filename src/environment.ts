import { readFileSync } from 'fs';
import { isObject } from 'lodash';
import debugConstructor from 'debug';
import { EnvVarNamingOptions, JSONSchema, JSONType } from './common';
import { parseEnvVarValue } from './parsing';
import { ConfigPropertyPath, Visitor, walkConfigProperties } from './walking';
import {
  discoverAdditionalProperties,
  discoverPatternProperties
} from './discovery';
import { getEnvVarName } from './naming';

const debug = debugConstructor('json-schema-env-config');

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

/**
 * Load config from the given environment variables, identifying relevant
 * variables and performing type conversion according to the given schema and
 * options.
 * @param env The environment variables to load config from.
 * @param schema The configuration object's JSON schema.
 * @param options Options that control how property names are mapped to
 *                environment variable names.
 * @return A configuration object containing values loaded from the given
 *         environment variables.
 */
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
      const discoveredProperties = discoverPatternProperties(
        pattern,
        propertiesSchema,
        parentConfigPropertyPath,
        env,
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
      const discoveredProperties = discoverAdditionalProperties(
        additionalPropertiesSchema,
        parentConfigPropertyPath,
        env,
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
