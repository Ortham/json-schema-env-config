/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'fs';
import { JSONSchema4 } from 'json-schema';
import { loadFromEnv } from '../src/environment';

describe('loadFromEnv', () => {
  it('should turn camelCase property name into SCREAMING_SNAKE_CASE in env var name', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        camelCasedPropertyName: {
          type: 'string'
        }
      }
    };
    const config: any = loadFromEnv(
      { CAMEL_CASED_PROPERTY_NAME: 'test' },
      schema
    );

    expect(config.camelCasedPropertyName).toBe('test');
  });

  it('should leave property undefined if its schema has no type property', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        unknownType: {}
      }
    };
    const config: any = loadFromEnv({ UNKNOWN_TYPE: 'test' }, schema);

    expect(config.unknownType).toBeUndefined();
  });

  it('tries to read values in the order that they are defined in a type schema array', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        multiType: {
          type: ['integer', 'number', 'string']
        }
      }
    };
    const config = loadFromEnv({ MULTI_TYPE: '3.14' }, schema);

    expect(config.multiType).toBeCloseTo(3.14);
  });

  it('should read value from env var if it does not end in _FILE', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        str: {
          type: 'string'
        }
      }
    };
    const config: any = loadFromEnv({ STR: 'test-string' }, schema);

    expect(config.str).toBe('test-string');
  });

  it('should read value from env var if it does not end in _FILE and the same env var with a _FILE suffix is defined', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        str: {
          type: 'string'
        }
      }
    };
    const config: any = loadFromEnv(
      { STR: 'test-string', STR_FILE: `${__dirname}/schema.json` },
      schema
    );

    expect(config.str).toBe('test-string');
  });

  it('should read value from the file path given by an env var ending in _FILE if it is set, trimming whitespace', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        str: {
          type: 'string'
        }
      }
    };
    const config: any = loadFromEnv({ STR_FILE: __filename }, schema);

    const fileContent = readFileSync(__filename, 'utf-8').trim();
    expect(config.str).toBe(fileContent);
  });

  describe('Strings', () => {
    it('should not alter env var values for string properties', () => {
      const schema: JSONSchema4 = {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      };
      const config: any = loadFromEnv({ STR: 'test-string' }, schema);

      expect(config.str).toBe('test-string');
    });
  });

  describe('Numbers', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        num: {
          type: 'number'
        }
      }
    };

    it('should convert env var values for number properties', () => {
      const config: any = loadFromEnv({ NUM: '3.14' }, schema);

      expect(config.num).toBeCloseTo(3.14);
    });

    it('should leave number property undefined if env var value is non-numeric', () => {
      const config: any = loadFromEnv({ NUM: '3.14one' }, schema);

      expect(config.num).toBeUndefined();
    });
  });

  describe('Integers', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        int: {
          type: 'integer'
        }
      }
    };

    it('should convert env var values for integer properties', () => {
      const config: any = loadFromEnv({ INT: '3' }, schema);

      expect(config.int).toBe(3);
    });

    it('should leave integer property undefined if env var value has a non-integer value', () => {
      const config: any = loadFromEnv({ INT: '3.14' }, schema);

      expect(config.int).toBeUndefined();
    });

    it('should leave integer property undefined if env var value is non-numeric', () => {
      const config: any = loadFromEnv({ INT: 'three' }, schema);

      expect(config.int).toBeUndefined();
    });
  });

  describe('Booleans', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        bool: {
          type: 'boolean'
        }
      }
    };

    it('should convert case-insensitive env var value true to true for boolean properties', () => {
      const config: any = loadFromEnv({ BOOL: 'TrUe' }, schema);

      expect(config.bool).toBe(true);
    });

    it('should convert case-insensitive env var value false to false for boolean properties', () => {
      const config: any = loadFromEnv({ BOOL: 'FaLsE' }, schema);

      expect(config.bool).toBe(false);
    });

    it('should convert env var values other than true to undefined for boolean properties', () => {
      let config: any = loadFromEnv({ BOOL: '1' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ BOOL: '0' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ BOOL: '-1' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ BOOL: 'true1' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ BOOL: 'false0' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ BOOL: 'yes' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ BOOL: 'no' }, schema);
      expect(config.bool).toBeUndefined();
    });
  });

  describe('Nulls', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        null: {
          type: 'null'
        }
      }
    };

    it('should set null property to null if env var value is "null"', () => {
      const config: any = loadFromEnv({ NULL: 'null' }, schema);

      expect(config.null).toBeNull();
    });

    it('should leave null property undefined if env var value is not "null"', () => {
      const config: any = loadFromEnv({ NULL: '' }, schema);

      expect(config.null).toBeUndefined();
    });
  });

  describe('Arrays', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        strings: {
          type: 'array',
          items: {
            type: 'string'
          }
        },
        numbers: {
          type: 'array',
          items: {
            type: 'number'
          }
        },
        noItems: {
          type: 'array'
        },
        itemsArray: {
          type: 'array',
          items: [{ type: 'string' }, { type: 'number' }]
        }
      }
    };

    it('should parse array property env var value as JSON', () => {
      const config: any = loadFromEnv(
        { STRINGS: JSON.stringify(['a', 'b', 'c']) },
        schema
      );

      expect(config.strings).toEqual(['a', 'b', 'c']);
    });

    it('should parse array property env var value as CSV if it cannot be parsed as JSON', () => {
      const config: any = loadFromEnv({ STRINGS: 'a,b,c' }, schema);

      expect(config.strings).toEqual(['a', 'b', 'c']);
    });

    it('should convert CSV array elements to their schema type', () => {
      const config: any = loadFromEnv({ NUMBERS: '1,2,3' }, schema);

      expect(config.numbers).toEqual([1, 2, 3]);
    });

    it('should leave array property undefined if a CSV array element cannot be converted to its schema type', () => {
      const config: any = loadFromEnv({ NUMBERS: '1,2,c' }, schema);

      expect(config.numbers).toBeUndefined();
    });

    it('should set array property if JSON array has no items schema', () => {
      const config: any = loadFromEnv(
        { NO_ITEMS: JSON.stringify(['a', 'b', 'c']) },
        schema
      );

      expect(config.noItems).toEqual(['a', 'b', 'c']);
    });

    it('should leave array property undefined if CSV array has no items schema', () => {
      const config: any = loadFromEnv({ NO_ITEMS: 'a,b,c' }, schema);

      expect(config.noItems).toBeUndefined();
    });

    it('supports CSV array items schema arrays', () => {
      const config: any = loadFromEnv({ ITEMS_ARRAY: 'one,2' }, schema);
      expect(config.itemsArray).toEqual(['one', 2]);
    });

    it('should use additionalItems schema to interpret indices past the last items schema array element', () => {
      const multiItemArraySchema: JSONSchema4 = {
        type: 'object',
        properties: {
          additionalItemsArray: {
            type: 'array',
            items: [{ type: 'string' }],
            additionalItems: { type: 'number' }
          }
        }
      };

      const config: any = loadFromEnv(
        { ADDITIONAL_ITEMS_ARRAY: 'one,2,3' },
        multiItemArraySchema
      );
      expect(config.additionalItemsArray).toEqual(['one', 2, 3]);
    });

    it('should leave array property undefined if the CSV array is longer than the items schema array and additionalItems is not defined', () => {
      const config: any = loadFromEnv({ ITEMS_ARRAY: 'one,2,3' }, schema);
      expect(config.itemsArray).toBeUndefined();
    });
  });

  describe('Objects', () => {
    it('should parse object property env var value as JSON', () => {
      const object = { a: 1, b: true, c: 'three' };
      const schema: JSONSchema4 = {
        type: 'object',
        properties: {
          noProperties: {
            type: 'object'
          }
        }
      };
      const config: any = loadFromEnv(
        { NO_PROPERTIES: JSON.stringify(object) },
        schema
      );

      expect(config.noProperties).toEqual(object);
    });

    describe('properties', () => {
      const schema: JSONSchema4 = {
        type: 'object',
        properties: {
          namedBooleanProperty: {
            type: 'boolean'
          },
          namedNumericProperty: {
            type: 'number'
          }
        }
      };

      it('should be able to set a named object property using an env var', () => {
        const config: any = loadFromEnv(
          { NAMED_NUMERIC_PROPERTY: '42' },
          schema
        );

        expect(config.namedNumericProperty).toBe(42);
      });

      it('should create parent object when setting a named property', () => {
        const config: any = loadFromEnv(
          { NAMED_NUMERIC_PROPERTY: '42' },
          schema
        );

        expect(config.namedNumericProperty).toBe(42);
      });

      it('should be able to set multiple named properties independently', () => {
        const config: any = loadFromEnv(
          { NAMED_NUMERIC_PROPERTY: '42', NAMED_BOOLEAN_PROPERTY: 'true' },
          schema
        );

        expect(config.namedNumericProperty).toBe(42);
        expect(config.namedBooleanProperty).toBe(true);
      });
    });
  });

  describe('In-place applicators', () => {
    describe('anyOf', () => {
      it('should try to parse property using the schemas in the order they are given, stopping on success', () => {
        const config: any = loadFromEnv(
          {
            ANY_OF_PROPERTY: '3.14'
          },
          {
            type: 'object',
            properties: {
              anyOfProperty: {
                anyOf: [
                  { type: 'integer' },
                  { type: 'number' },
                  { type: 'string' }
                ]
              }
            }
          }
        );

        expect(config.anyOfProperty).toBe(3.14);
      });

      it('should recurse into object properties inside an anyOf schema', () => {
        const config: any = loadFromEnv(
          {
            ANY_OF_PROPERTY_KEY: '3.14'
          },
          {
            type: 'object',
            properties: {
              anyOfProperty: {
                anyOf: [
                  {
                    type: 'object',
                    properties: {
                      key: {
                        type: 'integer'
                      }
                    }
                  },
                  {
                    type: 'object',
                    properties: {
                      key: {
                        type: 'number'
                      }
                    }
                  }
                ]
              }
            }
          }
        );

        expect(config.anyOfProperty.key).toBe(3.14);
      });

      // This is a limitation of resolving properties individually - the
      // library would have to read all the properties's env vars and then try
      // validating possible combinations of types to discard any that are
      // invalid before picking one to use.
      it('sets properties of objects inside an anyOf schema independently', () => {
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
      });
    });
  });
});
