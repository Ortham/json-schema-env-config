json-schema-env-config
======================

This library allows you to define an application's configuration parameters
using JSON schema, and to then load configuration from environment variables
using that schema, without having to explicitly name the parameter's environment
variables.

No particular version of JSON schema is targeted, and full compatibility is not
attempted: only a useful subset of syntax is supported. See below for
details.

This library does not validate that the resulting config actually conforms to
the JSON schema: it's only interested in the data types.

## Deriving environment variable names

A config property's environment variable name can be derived by:

1. taking the JSON pointer to that option
2. removing the `#/` prefix
3. replacing `/` with `_`
4. converting all `camelCase` words to `SCREAMING_SNAKE_CASE`.

For example, `#/camelCase/variable1` can be set using the
`CAMEL_CASE_VARIABLE_1` environment variable.

Environment variable values are parsed as JSON, and must be parseable as the
type given in the JSON Schema, e.g. a `boolean` property's environment variable
value must be `true` or `false`. There are two exceptions to this:

* arrays may be given as JSON or CSV. JSON is tried first.
* the `integer` JSON Schema `type` value must be a number with no fractional
  part: unlike the JSON Schema specification, an exponent will be accepted.

If a property can have multiple types (e.g. `type` is set to an array of
strings), then the environment variable value is parsed as each type in the
order that they are listed: the first successfully parsed value is used to set
the value of the property.

If a property's environment variable is not set or its value cannot be
successfully parsed, the property is left unset. Properties are set in the order
they are given in the schema, and objects are set before their properties. If
a property's value can be set and any of its ancestor objects are not already
set, the ancestor objects will first be initialised to empty objects.

### Loading values from the filesystem

Every config property has a second environment variable, which adds a `_FILE`
suffix to the name of the first. For example, in addition to
`CAMEL_CASE_VARIABLE_1`, `#/camelCase/variable1` can be set using the
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

## JSON Schema compatibility

The input JSON schema must contain no schema references. If a schema contains
references, they can be resolved before the schema is passed to this library:
several libraries exist for doing this.

As this library is only concerned with config data structures and not with
validation, most JSON schema keywords are irrelevant and ignored. Only relevant
keywords are listed below.

Supported keywords:

* `type`
* `properties`
* `items`
* `additionalItems`

Unsupported keywords:

* `additionalProperties`
* `patternProperties`
* `oneOf`
* `anyOf`
* `allOf`
* `dependencies` (`dependentSchemas` in draft 2019-09)
