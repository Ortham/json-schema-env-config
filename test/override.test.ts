/* eslint-disable @typescript-eslint/no-explicit-any */
import { cloneDeep } from 'lodash';
import { JSONType } from '../src/common';
import { overrideArrayValues } from '../src/override';

describe('overrideArrayValues', () => {
  it('should not override non-array properties', () => {
    const initialConfig = {
      string: 'test',
      number: 3.14,
      integer: 3,
      boolean: true,
      object: { prop1: 'test' }
    };
    const config: any = overrideArrayValues(
      // Deep clone to not rely on overrideArrayValues doing a deep clone itself.
      cloneDeep(initialConfig),
      {
        string: 'override',
        number: '1',
        integer: '1',
        boolean: 'false',
        null: 'null',
        object: JSON.stringify({ prop1: 'other' }),
        object__prop1: 'other'
      },
      {
        type: 'object',
        properties: {
          string: { type: 'string' },
          number: { type: 'number' },
          integer: { type: 'integer' },
          boolean: { type: 'boolean' },
          null: { type: 'null' },
          object: {
            type: 'object',
            properties: {
              prop1: { type: 'string' }
            }
          }
        }
      }
    );

    expect(config).toEqual(initialConfig);
  });

  it('should not override whole array property values', () => {
    const initialConfig = {
      array: [1, 2],
      arrayOfObjects: [{ prop1: 'test1', prop2: 'test2' }]
    };
    const config: any = overrideArrayValues(
      // Deep clone to not rely on overrideArrayValues doing a deep clone itself.
      cloneDeep(initialConfig),
      {
        array: '3,4',
        array_of_objects: JSON.stringify([
          { prop1: 'other1' },
          { prop1: 'other2' }
        ])
      },
      {
        type: 'object',
        properties: {
          array: {
            type: 'array',
            items: { type: 'number' }
          },
          arrayOfObjects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                prop1: { type: 'string' }
              }
            }
          }
        }
      }
    );

    expect(config).toEqual(initialConfig);
  });

  describe('Override a property with the same value for every element', () => {
    it('should support overriding a child property', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
        },
        {
          array__every__prop_2: '1'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'number'
                  }
                }
              }
            }
          }
        }
      );

      expect(config).toEqual({
        array: [
          { prop1: 'a', prop2: 1 },
          { prop1: 'b', prop2: 1 }
        ]
      });
    });

    it('should support overriding a nested property', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', prop2: { sub1: 0 } }, { prop1: 'b' }]
        },
        {
          array__every__prop_2__sub_1: '1'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'object',
                    properties: {
                      sub1: {
                        type: 'number'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      );

      expect(config).toEqual({
        array: [
          { prop1: 'a', prop2: { sub1: 1 } },
          { prop1: 'b', prop2: { sub1: 1 } }
        ]
      });
    });

    it('should support overriding an unnamed property', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
        },
        {
          array__every__prop2: '1'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  }
                },
                additionalProperties: {
                  type: 'number'
                }
              }
            }
          }
        }
      );

      expect(config).toEqual({
        array: [
          { prop1: 'a', prop2: 1 },
          { prop1: 'b', prop2: 1 }
        ]
      });
    });

    it('should support overriding a property nested in an unnamed property', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', prop2: { sub1: 0 } }, { prop1: 'b' }]
        },
        {
          array__every__prop2__sub_1: '1'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  }
                },
                additionalProperties: {
                  type: 'object',
                  properties: {
                    sub1: {
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
        array: [
          { prop1: 'a', prop2: { sub1: 1 } },
          { prop1: 'b', prop2: { sub1: 1 } }
        ]
      });
    });

    it('should not support overriding every element in an array in every element of another array', () => {
      const initialConfig: Record<string, JSONType> = {
        array: [
          { prop1: 'a', prop2: [{ sub1: 0 }, { sub1: 0 }] },
          { prop1: 'b', prop2: [{ sub1: 0 }] },
          { prop1: 'c' }
        ]
      };
      const config: any = overrideArrayValues(
        // Deep clone to not rely on overrideArrayValues doing a deep clone itself.
        cloneDeep(initialConfig),
        {
          array__every__prop_2__every__sub_1: '1'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sub1: {
                          type: 'number'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      );

      expect(config).toEqual(initialConfig);
    });

    it('should not be confused by an array that has a name ending with "every"', () => {
      const config: any = overrideArrayValues(
        {
          array_every: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
        },
        {
          array_every_prop_2: '1'
        },
        {
          type: 'object',
          properties: {
            array_every: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'number'
                  }
                }
              }
            }
          }
        },
        { propertySeparator: '_' }
      );

      expect(config).toEqual({
        array_every: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
      });
    });

    it('should not be confused by an array that has a name ending with "every"', () => {
      const config: any = overrideArrayValues(
        {
          array_every_prop_2: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
        },
        {
          array_every_prop_2: '1'
        },
        {
          type: 'object',
          properties: {
            array_every_prop_2: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'number'
                  }
                }
              }
            }
          }
        },
        { propertySeparator: '_' }
      );

      expect(config).toEqual({
        array_every_prop_2: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
      });
    });

    it('should not be confused by an array element property that has a name containing "every"', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', everyProp2: 0 }, { prop1: 'b' }]
        },
        {
          array_every_prop_2: '1'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  everyProp2: {
                    type: 'number'
                  }
                }
              }
            }
          }
        },
        { propertySeparator: '_' }
      );

      expect(config).toEqual({
        array: [{ prop1: 'a', everyProp2: 0 }, { prop1: 'b' }]
      });
    });
  });

  describe('Override a property with a different value for each element', () => {
    it('should support overriding a child property', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
        },
        {
          array__each__prop_2: '1,2'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'number'
                  }
                }
              }
            }
          }
        }
      );

      expect(config).toEqual({
        array: [
          { prop1: 'a', prop2: 1 },
          { prop1: 'b', prop2: 2 }
        ]
      });
    });

    it('should support overriding a nested property', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', prop2: { sub1: 0 } }, { prop1: 'b' }]
        },
        {
          array__each__prop_2__sub_1: '1,2'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'object',
                    properties: {
                      sub1: {
                        type: 'number'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      );

      expect(config).toEqual({
        array: [
          { prop1: 'a', prop2: { sub1: 1 } },
          { prop1: 'b', prop2: { sub1: 2 } }
        ]
      });
    });

    it('should support overriding an unnamed property', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
        },
        {
          array__each__prop2: '1,2'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  }
                },
                additionalProperties: {
                  type: 'number'
                }
              }
            }
          }
        }
      );

      expect(config).toEqual({
        array: [
          { prop1: 'a', prop2: 1 },
          { prop1: 'b', prop2: 2 }
        ]
      });
    });

    it('should support overriding a property nested in an unnamed property', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', prop2: { sub1: 0 } }, { prop1: 'b' }]
        },
        {
          array__each__prop2__sub_1: '1,2'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  }
                },
                additionalProperties: {
                  type: 'object',
                  properties: {
                    sub1: {
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
        array: [
          { prop1: 'a', prop2: { sub1: 1 } },
          { prop1: 'b', prop2: { sub1: 2 } }
        ]
      });
    });

    it('should stop at the length of the env var value array if it is shorter than the target array', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
        },
        {
          array__each__prop_2: '1'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'number'
                  }
                }
              }
            }
          }
        }
      );

      expect(config).toEqual({
        array: [{ prop1: 'a', prop2: 1 }, { prop1: 'b' }]
      });
    });

    it('should stop at the length of the target array if it is shorter than the env var value array', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', prop2: 0 }]
        },
        {
          array__each__prop_2: '1,2'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'number'
                  }
                }
              }
            }
          }
        }
      );

      expect(config).toEqual({
        array: [{ prop1: 'a', prop2: 1 }]
      });
    });

    it('should not support overriding each element in an array in each element of another array', () => {
      const initialConfig: Record<string, JSONType> = {
        array: [
          { prop1: 'a', prop2: [{ sub1: 0 }, { sub1: 0 }] },
          { prop1: 'b', prop2: [{ sub1: 0 }] },
          { prop1: 'c' }
        ]
      };
      const config: any = overrideArrayValues(
        // Deep clone to not rely on overrideArrayValues doing a deep clone itself.
        cloneDeep(initialConfig),
        {
          array__each__prop_2__each__sub_1: JSON.stringify([
            [1, 2],
            [3, 4]
          ])
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sub1: {
                          type: 'number'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      );

      expect(config).toEqual(initialConfig);
    });

    it('should not support overriding each element in an array in every element of another array', () => {
      const initialConfig: Record<string, JSONType> = {
        array: [
          { prop1: 'a', prop2: [{ sub1: 0 }, { sub1: 0 }] },
          { prop1: 'b', prop2: [{ sub1: 0 }] },
          { prop1: 'c' }
        ]
      };
      const config: any = overrideArrayValues(
        // Deep clone to not rely on overrideArrayValues doing a deep clone itself.
        cloneDeep(initialConfig),
        {
          array__every__prop_2__each__sub_1: JSON.stringify([1, 2])
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sub1: {
                          type: 'number'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      );

      expect(config).toEqual(initialConfig);
    });

    it('should not support overriding every element in an array in each element of another array', () => {
      const initialConfig: Record<string, JSONType> = {
        array: [
          { prop1: 'a', prop2: [{ sub1: 0 }, { sub1: 0 }] },
          { prop1: 'b', prop2: [{ sub1: 0 }] },
          { prop1: 'c' }
        ]
      };
      const config: any = overrideArrayValues(
        // Deep clone to not rely on overrideArrayValues doing a deep clone itself.
        cloneDeep(initialConfig),
        {
          array__each__prop_2__every__sub_1: JSON.stringify([1, 2])
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sub1: {
                          type: 'number'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      );

      expect(config).toEqual(initialConfig);
    });

    it('should not be confused by an array that has a name ending with "each"', () => {
      const config: any = overrideArrayValues(
        {
          array_each: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
        },
        {
          array_each_prop_2: '1,2'
        },
        {
          type: 'object',
          properties: {
            array_each: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'number'
                  }
                }
              }
            }
          }
        },
        { propertySeparator: '_' }
      );

      expect(config).toEqual({
        array_each: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
      });
    });

    it('should not be confused by an array that has a name ending with "each"', () => {
      const config: any = overrideArrayValues(
        {
          array_each_prop_2: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
        },
        {
          array_each_prop_2: '1,2'
        },
        {
          type: 'object',
          properties: {
            array_each_prop_2: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  prop2: {
                    type: 'number'
                  }
                }
              }
            }
          }
        },
        { propertySeparator: '_' }
      );

      expect(config).toEqual({
        array_each_prop_2: [{ prop1: 'a', prop2: 0 }, { prop1: 'b' }]
      });
    });

    it('should not be confused by an array element property that has a name containing "each"', () => {
      const config: any = overrideArrayValues(
        {
          array: [{ prop1: 'a', eachProp2: 0 }, { prop1: 'b' }]
        },
        {
          array_each_prop_2: '1,2'
        },
        {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prop1: {
                    type: 'string'
                  },
                  eachProp2: {
                    type: 'number'
                  }
                }
              }
            }
          }
        },
        { propertySeparator: '_' }
      );

      expect(config).toEqual({
        array: [{ prop1: 'a', eachProp2: 0 }, { prop1: 'b' }]
      });
    });
  });
});
