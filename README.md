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

The library exports a single function:

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
    case: 'SCREAMING_SNAKE_CASE',
    propertySeparator: '_',
    prefix: undefined
  }
): Record<string, JSONType>
```

See `tests/environment.test.ts` for many examples of this function being called
with different inputs and outputs.

To see debug logging output, export `DEBUG=json-schema-env-config`.

## Deriving environment variable names

A config property's environment variable name can be derived by:

1. taking the JSON pointer to that option
2. removing the `#/` prefix
3. adding the value of `options.prefix` as a prefix, if set
4. replacing `/` with `_` (or the value of `options.propertySeparator` if set)
5. converting all `camelCase` words to `SCREAMING_SNAKE_CASE` (or the value of
   `options.case` if set).

For example, `#/camelCase/variable1` can be set using the
`CAMEL_CASE_VARIABLE_1` environment variable.

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
to `CAMEL_CASE_VARIABLE_1`, `#/camelCase/variable1` can be set using the
`CAMEL_CASE_VARAIBLE_1_FILE` environment variable.

While the environment variables without the `_FILE` suffix have their values
used directly, the `_FILE`-suffixed variables must be set to the path to a file.
The file content is read as a UTF-8 string and leading and trailing whitespace
is trimmed, and the resulting value is set as the config property's value.

If the file cannot be read or is empty, SG treats this environment variable as
being undefined. If the suffixed and non-suffixed env vars are both defined, the
non-suffixed env var overrides the suffixed env var. For example,
`CAMEL_CASE_VARAIBLE_1_FILE` can be set to the path to a file containing a
value, but it will be ignored if `CAMEL_CASE_VARIABLE_1` is also set.

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
                ".*length": {
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

The environment variable `BOOK_metadata_LENGTHSUFFIX='{"author":{"Joe"}}'` has a
name starts with `BOOK_`, so it qualifies as potentially configuring a pattern
property. It doesn't match the `.*length` pattern because patterns are
case-sensitive. It does match the `.*metadata` pattern, and although the
`LENGTH` substring matches the `length` property, it's not at the end of the
string and isn't followed by the property separator `_`, so can't set the
`length` property. As such, the env var is used to set the config object below.

```javascript
{
    METADATA_LENGTHSUFFIX: {
        author: "Joe"
    }
}
```

The process for discovering additional properties is equivalent to discovering
properties for the pattern `.*`.

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
const config: any = loadFromEnv(
    {
        ANY_OF_PROPERTY_KEY_1: '3.14',
        ANY_OF_PROPERTY_KEY_2: 'true'
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
