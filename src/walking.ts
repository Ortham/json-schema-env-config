import { JSONSchema, UnsupportedSchema } from './common';

export const IN_PLACE_APPLICATOR_KEYWORDS: ['anyOf', 'oneOf', 'allOf'] = [
  'anyOf',
  'oneOf',
  'allOf'
];

export type Visitor = {
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

export type ConfigPropertyPathItem = {
  value: string;
  meta?: boolean;
  named: boolean;
};
export type ConfigPropertyPath = ConfigPropertyPathItem[];

export const META_PATH_ITEM_FILE = { value: 'file', meta: true, named: true };

export const META_PATH_ITEM_EVERY = { value: 'every', meta: true, named: true };

export const META_PATH_ITEM_EACH = { value: 'each', meta: true, named: true };

export function walkConfigProperties(
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
