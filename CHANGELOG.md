Changelog
=========

## 1.1.1 - 2021-01-14

### Fixed

- Parsing env var values with schema type `object` would also accept other JSON
  types.
- Parsing numbers would accept a wider range of values than are allowed by
  the JSON specification. In particular, an empty string would be parsed as `0`,
  and hexadecimal, octal and binary numbers were also allowed.
- Parsing booleans would match `true` and `false` case-insensitively. Matching
  is now case-sensitive to give the documented behaviour, and for consistency.

## 1.1.0 - 2021-01-03

### Added

- The ability to truncate a config property array to the length of the override
  value array when setting a property value for each element of the array. To
  enable this, set `truncateTargetArrays: true` in the options object passed
  into `overrideArrayValues()`.
- The ability to extend a config property array to the length of the override
  value array when setting a property value for each element of the array. To
  enable this, set `truncateTargetArrays: true` in the options object passed
  into `overrideArrayValues()`. Each new element will be set to an object that
  contains no properties other than the target property or any of its ancestor
  object(s).

### Changed

- Environment variables that apply a value to a property of each element of an
  array are now processed before environment variables that apply the same value
  to a property of every element of an array. This is so that if an array is
  extended, setting a property for every element will include the array's new
  elements.

## 1.0.0 - 2021-01-02

Initial release.
