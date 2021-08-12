json-schema-env-config
======================

This library allows you to define an application's configuration parameters
using JSON schema, and to then load configuration from environment variables
using that schema, without having to explicitly name the parameter's environment
variables.

This library is built using the TypeScript types for JSON Schema drafts 4 and 6
that are provided by the `@types/json-schema` package. Drafts 5, 7 and 2019-09
are probably also compatible. See the section below for details.

This library does not validate that the resulting config actually conforms to
the JSON schema: it's only interested in the data types.

## Usage

The library exports two functions:

```typescript
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
function loadFromEnv(
  env: NodeJS.ProcessEnv,
  schema: JSONSchema,
  options: EnvVarNamingOptions = {
    case: 'snake_case',
    propertySeparator: '__',
    prefix: undefined
  }
): Record<string, JSONType>

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
  options: EnvVarNamingOptions = {
    case: 'snake_case',
    propertySeparator: '__',
    prefix: undefined,
    truncateTargetArrays: undefined,
    extendTargetArrays: undefined
  }
): Record<string, JSONType>
```

See `tests/environment.test.ts` and `tests/override.test.ts` for many examples
of these function being called with different inputs and outputs.

To see debug logging output, export `DEBUG=json-schema-env-config`.

## Deriving environment variable names

A config property's environment variable name can be derived by:

1. taking the JSON pointer to that option
2. removing the `#/` prefix
3. adding the value of `options.prefix` as a prefix, if set
4. replacing `/` with `_` (or the value of `options.propertySeparator` if set)
5. converting all `camelCase` words to `snake_case` (or the value of
   `options.case` if set).

For example, `#/camelCase/variable1` can be set using the
`camel_case__variable_1` environment variable.

Environment variable values are parsed as JSON, and must be parseable as the
type given in the JSON Schema, e.g. a `boolean` property's environment variable
value must be `true` or `false`. There are two exceptions to this:

* arrays may be given as JSON or CSV. JSON is tried first.
* the `integer` JSON Schema `type` value must be a number with no fractional
  part: unlike earlier JSON Schema specifications, an exponent will be accepted.

If a property can have multiple types (e.g. `type` is set to an array of
strings, or a keyword like `anyOf` is used with different types), then the
environment variable value is parsed as each type in the order that they are
listed: the first successfully parsed value is used to set the value of the
property. Note that because environment variable values are strings, they will
always successfully parse as the `string` type.

If a property's environment variable is not set or its value cannot be
successfully parsed, the property is left unset. Properties are set in the order
they are given in the schema, and objects are set before their properties. If
a property's value can be set and any of its ancestor objects are not already
set, the ancestor objects will first be initialised to empty objects.

### Loading values from the filesystem

Every config property has a second environment variable, which is named as if
the config property had a child property named `file`. For example, in addition
to `camel_case__variable_1`, `#/camelCase/variable1` can be set using the
`camel_case__variable_1__file` environment variable.

While the environment variables without the `__file` suffix have their values
used directly, the `__file`-suffixed variables must be set to the path to a file.
The file content is read as a UTF-8 string and leading and trailing whitespace
is trimmed, and the resulting value is set as the config property's value. If
the file cannot be read or is empty after whitespace is trimmed, the file's
existence is ignored.

If the suffixed and non-suffixed env vars are both defined, the non-suffixed env
var overrides the suffixed env var. For example, `camel_case__variable_1__file`
can be set to the path to a file containing a value, but it will be ignored if
`camel_case__variable_1` is also set.

### Unnamed properties

This library is able to load values for config properties that are defined in
JSON Schema using `patternProperties` and `additionalProperties`. However, as
the names of these properties are not predetermined, they are extracted from
the names of qualifying environment variables.

An environment variable qualifies if its name starts with the expected env var
name for the parent object of the pattern properties. If the `type` of the
pattern property is `null`, `boolean`, `string`, `integer`, `number` or `array`,
the env var name suffix (everything after the parent object's expected env var
name) is used as the property name.

If the `type` of the pattern property is `object` and the env var name suffix
also includes the env var name substring for one of the object's `properties`,
the substring from the start of the env var name suffix to the start of the
property's substring is used as the property name. If none of the object's named
properties appear in the env var name, the whole suffix is used as the property
name, just like for the other `type` values.

For example, given the schema

```json
{
    "type": "object",
    "properties": {
        "book": {
            "type": "object",
            "patternProperties": {
                ".*LENGTH": {
                    "type": "number"
                },
                ".*metadata": {
                    "type": "object",
                    "properties": {
                        "length": {
                            "type": "number"
                        },
                        "author": {
                            "type": "string"
                        }
                    }
                }
            }
        }
    }
}
```

The environment variable `book__metadata__lengthsuffix='{"author":{"Joe"}}'` has
a name starts with `book__`, so it qualifies as potentially configuring a
pattern property. It doesn't match the `.*LENGTH` pattern because patterns are
case-sensitive. It does match the `.*metadata` pattern, and although the
`length` substring matches the `length` property, it's not at the end of the
string and isn't followed by the property separator `__`, so can't set the
`length` property. As such, the env var is used to set the config object below.

```javascript
{
    metadata__lengthsuffix: {
        author: "Joe"
    }
}
```

The process for discovering additional properties is equivalent to discovering
properties for the pattern `.*`.

### Setting properties in array element objects

Given a config property that is an array of homogeneous objects, as well as
setting the value of the whole array, it's possible to do one of the following:

* Set a property to the same value for every element of an array
* Set a property value for each element of an array.

This includes the ability to set the values of nested properties, including
those defined as pattern or additional properties.

It's not possible to combine or nest setting every or each element of arrays,
i.e. you can't set a property in every/each element of an array in every/each
element of another array. However, you can set properties in each and every
element of the same array: properties will be applied to each element before
they are applied to every element.

An array of objects is considered to by homogeneous if its schema satisfies all
of the following conditions:

1. `items` and/or `additionalItems` are defined.
2. If `items` is defined and not an array, its `type` property is set to
   `object`.
3. If `items` is defined and an array, all elements of the array are deeply
   equal and have a `type` property is set to `object`.
4. If `additionalItems` is defined, its `type` property is set to `object`.
5. If `items` and `additionalItems` are both defined and `items` is an array,
   its first element must be deeply equal to the value of `additionalItems`.
6. If `items` and `additionalItems` are both defined and `items` is not an
   array, its value must be deeply equal to the value of `additionalItems`.

#### Setting a single property value for every element

It's possible to set a single value for a property in every element of an array
of homogeneous objects by defining an environment variable that has a name of
the form `<env var name for array>__every__<env var name for property>` and a
value that is of the correct type for the target property.

For example, given a schema like

```json
{
    "type": "object",
    "properties": {
    "array": {
        "type": "array",
        "items": {
        "type": "object",
        "properties": {
            "prop1": {
            "type": "string"
            },
            "prop2": {
            "type": "number"
            }
        }
        }
    }
    }
}
```

and an existing config value of

```javascript
{
    array: [
        { prop1: 'a', prop2: 0 },
        { prop1: 'b' }
    ]
}
```

and setting the environment variable `array__every__prop_2=1` would cause
`overrideArrayValues()` to return

```javascript
{
    array: [
        { prop1: 'a', prop2: 1 },
        { prop1: 'b', prop2: 1 }
    ]
}
```

#### Setting a property value for each element

It's also possible to set a different value for a property in each element of
an array of homogeneous objects by defining an environment variable that has a
name of the form `<env var name for array>__each__<env var name for property>`
and a value that is an array of values that are of the correct type for the
target property.

Each element in the environment variable value array will be applied to the
target property in the corresponding element object in the target array. If
the target and value arrays are of different lengths, changes will only be made
up to the length of the shorter array. This behaviour can be changed by setting
the `truncateTargetArrays` and `extendTargetArrays` to `true`.

For example, given a schema like

```json
{
    "type": "object",
    "properties": {
    "array": {
        "type": "array",
        "items": {
        "type": "object",
        "properties": {
            "prop1": {
            "type": "string"
            },
            "prop2": {
            "type": "number"
            }
        }
        }
    }
    }
}
```

and an existing config value of

```javascript
{
    array: [
        { prop1: 'a', prop2: 0 },
        { prop1: 'b' }
    ]
}
```

and setting the environment variable `array__each__prop_2=1,2` would cause
`overrideArrayValues()` to return

```javascript
{
    array: [
        { prop1: 'a', prop2: 1 },
        { prop1: 'b', prop2: 2 }
    ]
}
```

## JSON Schema compatibility

The input JSON schema must contain no schema references. If a schema contains
references, they can be resolved before the schema is passed to this library:
there are several existing libraries that can resolve JSON references.

As this library is only concerned with config data structures and not with
validation, most JSON schema keywords are irrelevant and ignored. Only the
following keywords are used:

* `type`
* `properties`
* `additionalProperties`
* `patternProperties`
* `items`
* `additionalItems`
* `anyOf`
* `oneOf`
* `allOf`

Other keywords that may be relevant to defining the structure of a JSON document
but which are currently ignored by this library are:

* `if`
* `then`
* `else`
* `dependencies` / `dependentSchemas`
* `unevaluatedItems`
* `unevaluatedProperties`

As the JSON Schema specification evolves, it may also add additional relevant
keywords.

### Limitations

As this library allows properties to be set individually and does not perform
validation against the schema, it may produce invalid config if a property can
have different types depending on its siblings.

For example:

```js
const config = loadFromEnv(
    {
        any_of_property__key_1: '3.14',
        any_of_property__key_2: 'true'
    },
    {
        type: 'object',
        properties: {
            anyOfProperty: {
                anyOf: [
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            key1: {
                                type: 'number'
                            }
                        }
                    },
                    {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            key1: {
                                type: 'string'
                            },
                            key2: {
                                type: 'boolean'
                            }
                        }
                    }
                ]
            }
        }
    }
);

// This combination of variables would fail schema validation, as the
// value for key1 conforms to the first schema, but the value for key2
// conforms to the second, and the two are incompatible.
expect(config.anyOfProperty.key1).toBe(3.14);
expect(config.anyOfProperty.key2).toBe(true);
```
