import debugConstructor from 'debug';
import { EnvVarNamingOptions, JSONSchema, UnsupportedSchema } from './common';
import { getEnvVarName, transformPropertyName } from './naming';
import { ConfigPropertyPath } from './walking';

const debug = debugConstructor('json-schema-env-config');

export type DiscoveredProperty = {
  path: ConfigPropertyPath;
  schema: JSONSchema;
};

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

export function discoverPatternProperties(
  pattern: string,
  propertiesSchema: JSONSchema,
  parentConfigPropertyPath: ConfigPropertyPath,
  env: NodeJS.ProcessEnv,
  options: EnvVarNamingOptions
): DiscoveredProperty[] {
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

  return discoverUnnamedProperties(
    propertiesSchema,
    candidateEnvVarNameSuffixes,
    parentConfigPropertyPath,
    options
  );
}

export function discoverAdditionalProperties(
  propertiesSchema: JSONSchema,
  parentConfigPropertyPath: ConfigPropertyPath,
  env: NodeJS.ProcessEnv,
  options: EnvVarNamingOptions
): DiscoveredProperty[] {
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

  return discoverUnnamedProperties(
    propertiesSchema,
    candidateEnvVarNameSuffixes,
    parentConfigPropertyPath,
    options
  );
}
