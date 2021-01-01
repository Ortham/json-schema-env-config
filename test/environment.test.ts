/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'fs';
import { JSONSchema4 } from 'json-schema';
import { loadFromEnv } from '../src/environment';

describe('loadFromEnv', () => {
  describe('Options', () => {
    it('should turn camelCase property name into env var name using snake_case with __ property separators and no prefix by default', () => {
      const schema: JSONSchema4 = {
        type: 'object',
        properties: {
          camelCased: {
            type: 'object',
            properties: {
              propertyName: {
                type: 'string'
              }
            }
          }
        }
      };
      const config: any = loadFromEnv(
        { camel_cased__property_name: 'test' },
        schema
      );

      expect(config.camelCased.propertyName).toBe('test');
    });

    it('should turn camelCase property name into env var name using snake_case if configured to do so', () => {
      const schema: JSONSchema4 = {
        type: 'object',
        properties: {
          camelCased: {
            type: 'object',
            properties: {
              propertyName: {
                type: 'string'
              }
            }
          }
        }
      };
      const config: any = loadFromEnv(
        { camel_cased__property_name: 'test' },
        schema,
        { case: 'snake_case' }
      );

      expect(config.camelCased.propertyName).toBe('test');
    });

    it('should turn camelCase property name into env var name using SCREAMING_SNAKE_CASE if configured to do so', () => {
      const schema: JSONSchema4 = {
        type: 'object',
        properties: {
          camelCased: {
            type: 'object',
            properties: {
              propertyName: {
                type: 'string'
              }
            }
          }
        }
      };
      const config: any = loadFromEnv(
        { CAMEL_CASED__PROPERTY_NAME: 'test' },
        schema,
        { case: 'SCREAMING_SNAKE_CASE' }
      );

      expect(config.camelCased.propertyName).toBe('test');
    });

    it('should turn camelCase property name into env var name using _ property separator if configured to do so', () => {
      const schema: JSONSchema4 = {
        type: 'object',
        properties: {
          camelCased: {
            type: 'object',
            properties: {
              propertyName: {
                type: 'string'
              }
            }
          }
        }
      };
      const config: any = loadFromEnv(
        { camel_cased_property_name: 'test' },
        schema,
        { propertySeparator: '_' }
      );

      expect(config.camelCased.propertyName).toBe('test');
    });

    it('should turn camelCase property name into env var name using prefix if configured to do so', () => {
      const schema: JSONSchema4 = {
        type: 'object',
        properties: {
          camelCased: {
            type: 'object',
            properties: {
              propertyName: {
                type: 'string'
              }
            }
          }
        }
      };
      const config: any = loadFromEnv(
        { APP_NAME__camel_cased__property_name: 'test' },
        schema,
        { prefix: 'APP_NAME' }
      );

      expect(config.camelCased.propertyName).toBe('test');
    });
  });

  it('should leave property undefined if its schema has no type property', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        unknownType: {}
      }
    };
    const config: any = loadFromEnv({ unknown_type: 'test' }, schema);

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
    const config = loadFromEnv({ multi_type: '3.14' }, schema);

    expect(config.multiType).toBeCloseTo(3.14);
  });

  it('should read value from env var if it does not end in __file', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        str: {
          type: 'string'
        }
      }
    };
    const config: any = loadFromEnv({ str: 'test-string' }, schema);

    expect(config.str).toBe('test-string');
  });

  it('should read value from env var if it does not end in __file and the same env var with a __file suffix is defined', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        str: {
          type: 'string'
        }
      }
    };
    const config: any = loadFromEnv(
      { str: 'test-string', str__file: `${__dirname}/schema.json` },
      schema
    );

    expect(config.str).toBe('test-string');
  });

  it('should read value from the file path given by an env var ending in __file if it is set, trimming whitespace', () => {
    const schema: JSONSchema4 = {
      type: 'object',
      properties: {
        str: {
          type: 'string'
        }
      }
    };
    const config: any = loadFromEnv({ str__file: __filename }, schema);

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
      const config: any = loadFromEnv({ str: 'test-string' }, schema);

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
      const config: any = loadFromEnv({ num: '3.14' }, schema);

      expect(config.num).toBeCloseTo(3.14);
    });

    it('should leave number property undefined if env var value is non-numeric', () => {
      const config: any = loadFromEnv({ num: '3.14one' }, schema);

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
      const config: any = loadFromEnv({ int: '3' }, schema);

      expect(config.int).toBe(3);
    });

    it('should leave integer property undefined if env var value has a non-integer value', () => {
      const config: any = loadFromEnv({ int: '3.14' }, schema);

      expect(config.int).toBeUndefined();
    });

    it('should leave integer property undefined if env var value is non-numeric', () => {
      const config: any = loadFromEnv({ int: 'three' }, schema);

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
      const config: any = loadFromEnv({ bool: 'TrUe' }, schema);

      expect(config.bool).toBe(true);
    });

    it('should convert case-insensitive env var value false to false for boolean properties', () => {
      const config: any = loadFromEnv({ bool: 'FaLsE' }, schema);

      expect(config.bool).toBe(false);
    });

    it('should convert env var values other than true to undefined for boolean properties', () => {
      let config: any = loadFromEnv({ bool: '1' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ bool: '0' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ bool: '-1' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ bool: 'true1' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ bool: 'false0' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ bool: 'yes' }, schema);
      expect(config.bool).toBeUndefined();

      config = loadFromEnv({ bool: 'no' }, schema);
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
      const config: any = loadFromEnv({ null: 'null' }, schema);

      expect(config.null).toBeNull();
    });

    it('should leave null property undefined if env var value is not "null"', () => {
      const config: any = loadFromEnv({ null: '' }, schema);

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
        { strings: JSON.stringify(['a', 'b', 'c']) },
        schema
      );

      expect(config.strings).toEqual(['a', 'b', 'c']);
    });

    it('should parse array property env var value as CSV if it cannot be parsed as JSON', () => {
      const config: any = loadFromEnv({ strings: 'a,b,c' }, schema);

      expect(config.strings).toEqual(['a', 'b', 'c']);
    });

    it('should parse array property env var value as CSV if it cannot be parsed as a JSON array', () => {
      const config: any = loadFromEnv({ strings: 'a' }, schema);

      expect(config.strings).toEqual(['a']);
    });

    it('should convert CSV array elements to their schema type', () => {
      const config: any = loadFromEnv({ numbers: '1,2,3' }, schema);

      expect(config.numbers).toEqual([1, 2, 3]);
    });

    it('should leave array property undefined if a CSV array element cannot be converted to its schema type', () => {
      const config: any = loadFromEnv({ numbers: '1,2,c' }, schema);

      expect(config.numbers).toBeUndefined();
    });

    it('should set array property if JSON array has no items schema', () => {
      const config: any = loadFromEnv(
        { no_items: JSON.stringify(['a', 'b', 'c']) },
        schema
      );

      expect(config.noItems).toEqual(['a', 'b', 'c']);
    });

    it('should leave array property undefined if CSV array has no items schema', () => {
      const config: any = loadFromEnv({ no_items: 'a,b,c' }, schema);

      expect(config.noItems).toBeUndefined();
    });

    it('supports CSV array items schema arrays', () => {
      const config: any = loadFromEnv({ items_array: 'one,2' }, schema);
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
        { additional_items_array: 'one,2,3' },
        multiItemArraySchema
      );
      expect(config.additionalItemsArray).toEqual(['one', 2, 3]);
    });

    it('should leave array property undefined if the CSV array is longer than the items schema array and additionalItems is not defined', () => {
      const config: any = loadFromEnv({ items_array: 'one,2,3' }, schema);
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
        { no_properties: JSON.stringify(object) },
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
          { named_numeric_property: '42' },
          schema
        );

        expect(config.namedNumericProperty).toBe(42);
      });

      it('should create parent object when setting a named property', () => {
        const config: any = loadFromEnv(
          { named_numeric_property: '42' },
          schema
        );

        expect(config.namedNumericProperty).toBe(42);
      });

      it('should be able to set multiple named properties independently', () => {
        const config: any = loadFromEnv(
          { named_numeric_property: '42', named_boolean_property: 'true' },
          schema
        );

        expect(config.namedNumericProperty).toBe(42);
        expect(config.namedBooleanProperty).toBe(true);
      });
    });

    describe('patternProperties', () => {
      it('should ignore additional properties if patternProperties is undefined', () => {
        const config: any = loadFromEnv(
          { property: 'test' },
          { type: 'object' }
        );

        expect(config.property).toBeUndefined();
      });

      it('should only match regex patterns against env vars with the correct prefix for the parent property path', () => {
        const config: any = loadFromEnv(
          {
            codeword: 'test',
            'sub__secret-code': 'other'
          },
          {
            type: 'object',
            properties: {
              sub: {
                type: 'object',
                patternProperties: {
                  code: {
                    type: 'string'
                  }
                }
              }
            },
            patternProperties: {
              '(^code|code$)': {
                type: 'string'
              }
            }
          }
        );

        expect(config.codeword).toBe('test');
        expect(config.sub['secret-code']).toBe('other');
      });

      it('should treat patterns as Unicode-aware and case-sensitive', () => {
        const config: any = loadFromEnv(
          { 'code👌': '3' },
          {
            type: 'object',
            patternProperties: {
              CODE: {
                type: 'number'
              },
              'code.*\\p{Emoji_Presentation}': {
                type: 'string'
              }
            }
          }
        );

        expect(config['code👌']).toBe('3');
      });

      it('should be able to match a single pattern against multiple env vars', () => {
        const config: any = loadFromEnv(
          {
            codeword: 'test',
            'secret-code': 'other'
          },
          {
            type: 'object',
            patternProperties: {
              code: {
                type: 'string'
              }
            }
          }
        );

        expect(config.codeword).toBe('test');
        expect(config['secret-code']).toBe('other');
      });

      it("should be able to match multiple patterns for the same object's properties", () => {
        const config: any = loadFromEnv(
          {
            passcode: 'test',
            swordfish: 'other'
          },
          {
            type: 'object',
            patternProperties: {
              code: {
                type: 'string'
              },
              word: {
                type: 'string'
              }
            }
          }
        );

        expect(config.passcode).toBe('test');
        expect(config.swordfish).toBe('other');
      });

      it("should set a property using the first matching pattern's schema that successfully parses the env var value", () => {
        const config: any = loadFromEnv(
          {
            codeword: 'test',
            passcode: '3'
          },
          {
            type: 'object',
            patternProperties: {
              code: {
                type: 'number'
              },
              word: {
                type: 'string'
              }
            }
          }
        );

        expect(config.codeword).toBe('test');
        expect(config.passcode).toBe(3);
      });

      it('should ignore pattern schemas that have no type', () => {
        const config: any = loadFromEnv(
          { codeword: 'test' },
          {
            type: 'object',
            patternProperties: {
              code: {}
            }
          }
        );

        expect(config.codeword).toBeUndefined();
      });

      it('should support the null type', () => {
        const config: any = loadFromEnv(
          { codeword: 'null' },
          {
            type: 'object',
            patternProperties: {
              code: { type: 'null' }
            }
          }
        );

        expect(config.codeword).toBe(null);
      });

      it('should support the boolean type', () => {
        const config: any = loadFromEnv(
          { codeword: 'true' },
          {
            type: 'object',
            patternProperties: {
              code: { type: 'boolean' }
            }
          }
        );

        expect(config.codeword).toBe(true);
      });

      it('should support the number type', () => {
        const config: any = loadFromEnv(
          { codeword: '3.14' },
          {
            type: 'object',
            patternProperties: {
              code: { type: 'number' }
            }
          }
        );

        expect(config.codeword).toBe(3.14);
      });

      it('should support the integer type', () => {
        const config: any = loadFromEnv(
          { codeword: '3' },
          {
            type: 'object',
            patternProperties: {
              code: { type: 'integer' }
            }
          }
        );

        expect(config.codeword).toBe(3);
      });

      it('should support the string type', () => {
        const config: any = loadFromEnv(
          { codeword: 'test' },
          {
            type: 'object',
            patternProperties: {
              code: { type: 'string' }
            }
          }
        );

        expect(config.codeword).toBe('test');
      });

      it('should support the array type', () => {
        const config: any = loadFromEnv(
          { codeword: '1,2,3' },
          {
            type: 'object',
            patternProperties: {
              code: {
                type: 'array',
                items: {
                  type: 'number'
                }
              }
            }
          }
        );

        expect(config.codeword).toEqual([1, 2, 3]);
      });

      it('should support the object type', () => {
        const value = { a: 1, b: 2, c: 3 };
        const config: any = loadFromEnv(
          { codeword: JSON.stringify(value) },
          {
            type: 'object',
            patternProperties: {
              code: {
                type: 'object'
              }
            }
          }
        );

        expect(config.codeword).toEqual(value);
      });

      it('should be able to set a property in a descendant object value of a pattern key', () => {
        const config: any = loadFromEnv(
          {
            object__sub__a: '42'
          },
          {
            type: 'object',
            patternProperties: {
              object: {
                type: 'object',
                properties: {
                  sub: {
                    type: 'object',
                    properties: {
                      a: {
                        type: 'number'
                      }
                    }
                  }
                }
              }
            }
          }
        );

        expect(config.object.sub.a).toBe(42);
      });

      it('should be able to set a should be able to set a property in a descendant object value of a pattern key that ends with a literal $', () => {
        const config: any = loadFromEnv(
          {
            object$__sub__a: '42',
            object__sub__a: '24'
          },
          {
            type: 'object',
            patternProperties: {
              'object\\$': {
                type: 'object',
                properties: {
                  sub: {
                    type: 'object',
                    properties: {
                      a: {
                        type: 'number'
                      }
                    }
                  }
                }
              }
            }
          }
        );

        expect(config).toEqual({
          object$: {
            sub: {
              a: 42
            }
          }
        });
      });

      it('should be able to set a should be able to set a property in a descendant object value of a pattern key that ends with a $', () => {
        const config: any = loadFromEnv(
          {
            object$__sub__a: '42',
            object__sub__a: '24'
          },
          {
            type: 'object',
            patternProperties: {
              object$: {
                type: 'object',
                properties: {
                  sub: {
                    type: 'object',
                    properties: {
                      a: {
                        type: 'number'
                      }
                    }
                  }
                }
              }
            }
          }
        );

        expect(config).toEqual({
          object: {
            sub: {
              a: 24
            }
          }
        });
      });

      it('should not override named property values', () => {
        const config: any = loadFromEnv(
          {
            named_object__a: '3.14',
            object__a: 'test'
          },
          {
            type: 'object',
            properties: {
              namedObject: {
                type: 'object',
                properties: {
                  a: {
                    type: 'number'
                  }
                }
              }
            },
            additionalProperties: {
              type: 'object',
              properties: {
                a: {
                  type: 'string'
                }
              }
            }
          }
        );

        expect(config.namedObject).toEqual({
          a: 3.14
        });
        expect(config.object.a).toBe('test');
      });
    });

    describe('additionalProperties', () => {
      it('should ignore additional properties if additionalProperties is undefined', () => {
        const config: any = loadFromEnv(
          { property: 'test' },
          { type: 'object' }
        );

        expect(config.property).toBeUndefined();
      });

      it('should ignore additional properties if additionalProperties is false', () => {
        const config: any = loadFromEnv(
          { property: 'test' },
          {
            type: 'object',
            additionalProperties: false
          }
        );

        expect(config.property).toBeUndefined();
      });

      it('should ignore additional properties if additionalProperties is true', () => {
        const config: any = loadFromEnv(
          { property: 'test' },
          {
            type: 'object',
            additionalProperties: false
          }
        );

        expect(config.property).toBeUndefined();
      });

      it('should ignore additional properties schema with no type', () => {
        const config: any = loadFromEnv(
          { property: 'test' },
          {
            type: 'object',
            additionalProperties: {}
          }
        );

        expect(config.property).toBeUndefined();
      });

      it('should create parent object when setting an additional property', () => {
        const config: any = loadFromEnv(
          { property: 'test' },
          {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        );

        expect(config.property).toBe('test');
      });

      it('should not transform property name in env var', () => {
        const config: any = loadFromEnv(
          { mixedCase_STR: 'test' },
          {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        );

        expect(config.mixedCase_STR).toBe('test');
      });

      it('should be able to set an additional property null', () => {
        const config: any = loadFromEnv(
          { property: 'null' },
          {
            type: 'object',
            additionalProperties: { type: 'null' }
          }
        );

        expect(config.property).toBe(null);
      });

      it('should be able to set an additional property boolean', () => {
        const config: any = loadFromEnv(
          { property: 'true' },
          {
            type: 'object',
            additionalProperties: { type: 'boolean' }
          }
        );

        expect(config.property).toBe(true);
      });

      it('should be able to set an additional property string', () => {
        const config: any = loadFromEnv(
          { property: 'test' },
          {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        );

        expect(config.property).toBe('test');
      });

      it('should be able to set an additional property integer', () => {
        const config: any = loadFromEnv(
          { property: '3' },
          {
            type: 'object',
            additionalProperties: { type: 'integer' }
          }
        );

        expect(config.property).toBe(3);
      });

      it('should be able to set an additional property number', () => {
        const config: any = loadFromEnv(
          { property: '3.14' },
          {
            type: 'object',
            additionalProperties: { type: 'number' }
          }
        );

        expect(config.property).toBe(3.14);
      });

      it('should be able to set an additional property array', () => {
        const value = [1, 2, 3];
        const config: any = loadFromEnv(
          { property: JSON.stringify(value) },
          {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: { type: 'number' }
            }
          }
        );

        expect(config.property).toEqual(value);
      });

      it('should be able to set an object', () => {
        const value = { name: 'John' };
        const config: any = loadFromEnv(
          { property: JSON.stringify(value) },
          {
            type: 'object',
            additionalProperties: { type: 'object' }
          }
        );

        expect(config.property).toEqual(value);
      });

      it('should be able to set multiple named object properties independently', () => {
        const config: any = loadFromEnv(
          {
            property__name: 'John',
            property__number: '42'
          },
          {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                name: {
                  type: 'string'
                },
                number: {
                  type: 'number'
                }
              }
            }
          }
        );

        expect(config.property.name).toBe('John');
        expect(config.property.number).toBe(42);
      });

      it('should recurse into object additional properties', () => {
        const config: any = loadFromEnv(
          {
            property__obj__a: '1',
            property__obj__b: '2'
          },
          {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                obj: {
                  type: 'object',
                  additionalProperties: {
                    type: 'number'
                  }
                }
              }
            }
          }
        );

        expect(config.property.obj.a).toBe(1);
        expect(config.property.obj.b).toBe(2);
      });

      it('should recurse into object properties', () => {
        const config: any = loadFromEnv(
          {
            object__sub__a: '42'
          },
          {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                sub: {
                  type: 'object',
                  properties: {
                    a: {
                      type: 'number'
                    }
                  }
                }
              }
            }
          }
        );

        expect(config.object.sub.a).toBe(42);
      });

      it('should distinguish between nested property names and property names that happen to contain nested property names', () => {
        const config: any = loadFromEnv(
          {
            book__METADATA__lengthsuffix: JSON.stringify({ author: 'Joe' })
          },
          {
            type: 'object',
            properties: {
              book: {
                type: 'object',
                patternProperties: {
                  '.*length': {
                    type: 'number'
                  },
                  '.*METADATA': {
                    type: 'object',
                    properties: {
                      length: {
                        type: 'number'
                      },
                      author: {
                        type: 'string'
                      }
                    }
                  }
                }
              }
            }
          }
        );

        expect(config.book.METADATA__lengthsuffix.author).toBe('Joe');
      });

      it('should not overlap with named properties', () => {
        const config: any = loadFromEnv(
          {
            named_object__a: '3.14',
            object__a: 'test'
          },
          {
            type: 'object',
            properties: {
              namedObject: {
                type: 'object',
                properties: {
                  a: {
                    type: 'number'
                  }
                }
              }
            },
            additionalProperties: {
              type: 'object',
              properties: {
                a: {
                  type: 'string'
                }
              }
            }
          }
        );

        expect(config.namedObject).toEqual({
          a: 3.14
        });
        expect(config.object.a).toBe('test');
      });

      it('should overlap with a named property if the named object env var value is ignored', () => {
        const config: any = loadFromEnv(
          {
            named_object__a: 'three',
            object__a: 'test'
          },
          {
            type: 'object',
            properties: {
              NAMED_OBJECT: {
                type: 'object',
                properties: {
                  a: {
                    type: 'number'
                  }
                }
              }
            },
            additionalProperties: {
              type: 'object',
              properties: {
                a: {
                  type: 'string'
                }
              }
            }
          }
        );

        expect(config.named_object.a).toBe('three');
        expect(config.object.a).toBe('test');
      });

      it('should not overlap with pattern properties', () => {
        const config: any = loadFromEnv(
          {
            PATTERN_OBJECT__a: '3.14',
            OBJECT__a: 'test'
          },
          {
            type: 'object',
            patternProperties: {
              PAT: {
                type: 'object',
                properties: {
                  a: {
                    type: 'number'
                  }
                }
              }
            },
            additionalProperties: {
              type: 'object',
              properties: {
                a: {
                  type: 'string'
                }
              }
            }
          }
        );

        expect(config.PATTERN_OBJECT).toEqual({
          a: 3.14
        });
        expect(config.OBJECT.a).toBe('test');
      });
    });
  });

  describe('In-place applicators', () => {
    const keywords = ['anyOf', 'oneOf', 'allOf'];

    for (const keyword of keywords) {
      describe(keyword, () => {
        it('should try to parse property using the schemas in the order they are given, stopping on success', () => {
          const config: any = loadFromEnv(
            {
              property: '3.14'
            },
            {
              type: 'object',
              properties: {
                property: {
                  [keyword]: [
                    { type: 'integer' },
                    { type: 'number' },
                    { type: 'string' }
                  ]
                }
              }
            }
          );

          expect(config.property).toBe(3.14);
        });

        it(`should recurse into object properties inside an ${keyword} schema`, () => {
          const config: any = loadFromEnv(
            {
              property__key: '3.14'
            },
            {
              type: 'object',
              properties: {
                property: {
                  [keyword]: [
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

          expect(config.property.key).toBe(3.14);
        });
      });
    }

    // allOf isn't problematic because the types in all elements need to be
    // consistent for validation to be successful.
    const problematicKeywords = ['anyOf', 'oneOf'];

    for (const keyword of problematicKeywords) {
      describe(keyword, () => {
        // This is a limitation of resolving properties individually - the
        // library would have to read all the properties's env vars and then try
        // validating possible combinations of types to discard any that are
        // invalid before picking one to use.
        it(`sets properties of objects inside an ${keyword} schema independently`, () => {
          const config: any = loadFromEnv(
            {
              property__key_1: '3.14',
              property__key_2: 'true'
            },
            {
              type: 'object',
              properties: {
                property: {
                  [keyword]: [
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
          expect(config.property.key1).toBe(3.14);
          expect(config.property.key2).toBe(true);
        });
      });
    }
  });
});
