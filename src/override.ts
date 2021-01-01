import { cloneDeep, defaultsDeep, isEqual, isObject } from 'lodash';
import debugConstructor from 'debug';
import {
  DEFAULT_OPTIONS,
  EnvVarNamingOptions,
  initialiseOptions,
  JSONSchema,
  JSONType
} from './common';
import {
  discoverPatternProperties,
  discoverAdditionalProperties
} from './discovery';
import {
  ConfigPropertyPath,
  META_PATH_ITEM_EACH,
  META_PATH_ITEM_EVERY,
  Visitor,
  walkConfigProperties
} from './walking';
import { JSONSchema4, JSONSchema6Definition } from 'json-schema';
import { createParentObjects, readFromEnvVars } from './environment';

const debug = debugConstructor('json-schema-env-config');

function describesObject(schema: JSONSchema | boolean): boolean {
  return typeof schema !== 'boolean' && schema.type === 'object';
}

function areItemsHomogenousObjects(
  items:
    | JSONSchema4
    | JSONSchema6Definition
    | JSONSchema4[]
    | JSONSchema6Definition[]
): boolean {
  if (Array.isArray(items)) {
    if (items.length === 0) {
      return false;
    }

    const firstItem = items[0];
    if (!describesObject(firstItem)) {
      return false;
    }

    for (const item of items.slice(1)) {
      if (!isEqual(item, firstItem)) {
        return false;
      }
    }

    return true;
  }

  return describesObject(items);
}

function isArrayOfHomogenousObjects(arraySchema: JSONSchema): boolean {
  if (!arraySchema.items && !arraySchema.additionalItems) {
    return false;
  }

  if (arraySchema.items && arraySchema.additionalItems) {
    const items = [arraySchema.additionalItems].concat(arraySchema.items);
    return areItemsHomogenousObjects(items);
  }

  if (arraySchema.items && !areItemsHomogenousObjects(arraySchema.items)) {
    return false;
  }

  if (
    arraySchema.additionalItems &&
    !areItemsHomogenousObjects(arraySchema.additionalItems)
  ) {
    return false;
  }

  return true;
}

function getItemSchema(schema: JSONSchema): JSONSchema | undefined {
  // Assume array is of homogenous objects.
  if (typeof schema.additionalItems === 'object') {
    return schema.additionalItems;
  }

  if (Array.isArray(schema.items)) {
    if (schema.items.length > 0 && typeof schema.items[0] !== 'boolean') {
      return schema.items[0];
    }
  } else if (typeof schema.items === 'object') {
    return schema.items;
  }

  return undefined;
}

function walkObjectArrayProperties(
  schema: JSONSchema,
  configPropertyPath: ConfigPropertyPath,
  visitor: Visitor
): void {
  if (schema.type !== 'array') {
    debug('Skipping property at %j as it is not an array', configPropertyPath);
    return;
  }

  if (!isArrayOfHomogenousObjects(schema)) {
    debug(
      'Skipping property at %j as it is not an array of homogeneous objects',
      configPropertyPath
    );
    return;
  }

  const itemSchema = getItemSchema(schema);

  if (!itemSchema) {
    debug('Skipping array at %j: items have no schema', configPropertyPath);
    return;
  }

  debug(
    'Found array of homogeneous objects property at %j',
    configPropertyPath
  );

  walkConfigProperties(
    itemSchema,
    configPropertyPath.concat(META_PATH_ITEM_EVERY),
    visitor
  );

  walkConfigProperties(
    itemSchema,
    configPropertyPath.concat(META_PATH_ITEM_EACH),
    visitor
  );
}

function createOverrideElement(
  configPropertyPath: ConfigPropertyPath,
  metaPathItemIndex: number,
  value: JSONType
): { [key: string]: JSONType } {
  const elementOverride = {};
  const valueParentObject = createParentObjects(
    configPropertyPath.slice(metaPathItemIndex + 1),
    elementOverride
  );

  valueParentObject[
    configPropertyPath[configPropertyPath.length - 1].value
  ] = cloneDeep(value);

  return elementOverride;
}

function mergeIntoArrayElement(
  configPropertyPath: ConfigPropertyPath,
  metaPathItemIndex: number,
  element: JSONType,
  overrideValue: JSONType
): JSONType {
  const elementObject = createOverrideElement(
    configPropertyPath,
    metaPathItemIndex,
    overrideValue
  );

  debug('Merging array element %j and override %j', element, elementObject);
  return defaultsDeep({}, elementObject, element);
}

function getArrayToOverride(
  config: Record<string, JSONType>,
  configPropertyPath: ConfigPropertyPath
): JSONType[] | undefined {
  let configObject: JSONType = config;
  for (const pathItem of configPropertyPath) {
    if (!isObject(configObject) || Array.isArray(configObject)) {
      throw new Error(
        `Cannot recurse into non-object property named ${JSON.stringify(
          pathItem
        )} in path ${JSON.stringify(configPropertyPath)}`
      );
    }

    configObject = configObject[pathItem.value];
  }

  if (!Array.isArray(configObject)) {
    debug(
      'Ignoring config property path %j because the config property %j is not an array',
      configPropertyPath,
      configObject
    );
    return undefined;
  }

  return configObject;
}

function applyToEveryElement(
  config: Record<string, JSONType>,
  configPropertyPath: ConfigPropertyPath,
  value: JSONType,
  everyIndex: number
): void {
  const configArray = getArrayToOverride(
    config,
    configPropertyPath.slice(0, everyIndex)
  );

  if (configArray === undefined) {
    return;
  }

  configArray.forEach((element, index, array) => {
    array[index] = mergeIntoArrayElement(
      configPropertyPath,
      everyIndex,
      element,
      value
    );
  });
}

function applyToEachElement(
  config: Record<string, JSONType>,
  configPropertyPath: ConfigPropertyPath,
  value: JSONType,
  eachIndex: number
): void {
  const configArray = getArrayToOverride(
    config,
    configPropertyPath.slice(0, eachIndex)
  );

  if (configArray === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    debug(
      'Not applying value at %s because parsed value %j is not an array',
      configPropertyPath,
      value
    );
    return;
  }

  for (let i = 0; i < configArray.length && i < value.length; ++i) {
    configArray[i] = mergeIntoArrayElement(
      configPropertyPath,
      eachIndex,
      configArray[i],
      value[i]
    );
  }
}

function findOnlyIndex<T>(array: T[], needle: T): number {
  let needleIndex = -1;
  for (let i = 0; i < array.length; ++i) {
    if (isEqual(array[i], needle)) {
      if (needleIndex !== -1) {
        return -1;
      }
      needleIndex = i;
    }
  }

  return needleIndex;
}

/**
 * Override property values in arrays of homogeneous objects using config loaded
 * from environment variables, performing type conversion according to the given
 * schema and options.
 * @param config The existing config containing the arrays to override.
 * @param env The environment variables to load overriding config from.
 * @param schema The configuration object's JSON schema.
 * @param options Options that control how property names are mapped to
 *                environment variable names.
 * @return A copy of the configuration object that has array values overridden
 *         according to the given environment variables.
 */
export function overrideArrayValues(
  config: Record<string, JSONType>,
  env: NodeJS.ProcessEnv,
  schema: JSONSchema,
  options: EnvVarNamingOptions = DEFAULT_OPTIONS
): Record<string, JSONType> {
  // eslint-disable-next-line no-param-reassign
  options = initialiseOptions(options);

  // eslint-disable-next-line no-param-reassign
  config = defaultsDeep({}, config);

  const envVarNames = new Map<string, ConfigPropertyPath>();

  const visitor: Visitor = {
    visitSchema(schema, configPropertyPath) {
      if (configPropertyPath.length === 0) {
        return;
      }

      const everyIndex = findOnlyIndex(
        configPropertyPath,
        META_PATH_ITEM_EVERY
      );
      const eachIndex = findOnlyIndex(configPropertyPath, META_PATH_ITEM_EACH);

      if (everyIndex !== -1 && eachIndex === -1) {
        const value = readFromEnvVars(
          schema,
          configPropertyPath,
          env,
          envVarNames,
          options
        );

        if (value !== undefined) {
          applyToEveryElement(config, configPropertyPath, value, everyIndex);
        }
      }

      if (everyIndex === -1 && eachIndex !== -1) {
        // Use type assertion here because it's obvious that the type asserted
        // is valid, but the union type makes it difficult to prove that.
        const eachArraySchema = {
          type: 'array',
          items: schema
        } as JSONSchema;

        const value = readFromEnvVars(
          eachArraySchema,
          configPropertyPath,
          env,
          envVarNames,
          options
        );

        if (value !== undefined) {
          applyToEachElement(config, configPropertyPath, value, eachIndex);
        }
      }

      // Now do the bit that looks for overridden array element properties.
      walkObjectArrayProperties(schema, configPropertyPath, visitor);
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

  return config;
}
