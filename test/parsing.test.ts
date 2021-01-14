import { JSONSchema } from '../src/common';
import { parseEnvVarValue } from '../src/parsing';

describe('parseEnvVarValue', () => {
  const NAME = 'test';

  describe('Parsing booleans', () => {
    const SCHEMA: JSONSchema = { type: 'boolean' };

    it('should return true if given a string that is "true"', () => {
      const value = parseEnvVarValue(NAME, 'true', SCHEMA);

      expect(value).toBe(true);
    });

    it('should return false if given a string that is "false"', () => {
      const value = parseEnvVarValue(NAME, 'false', SCHEMA);

      expect(value).toBe(false);
    });

    it('should return undefined if given a string that is not "true" or "false"', () => {
      const invalidValues = [
        '',
        'TRUE',
        'True',
        'truetrue',
        'FALSE',
        'False',
        'falsefalse',
        '1',
        '0',
        'yes',
        'Yes',
        'YES',
        'no',
        'No',
        'NO',
        'y',
        'Y',
        'n',
        'N',
        'on',
        'On',
        'ON',
        'off',
        'Off',
        'OFF'
      ];
      for (const invalidString of invalidValues) {
        const value = parseEnvVarValue(NAME, invalidString, SCHEMA);

        expect(value).toBeUndefined();
      }
    });
  });

  describe('Parsing numbers', () => {
    const SCHEMA: JSONSchema = { type: 'number' };

    it('should return a number if the string only contains digits', () => {
      const value = parseEnvVarValue(NAME, '123', SCHEMA);

      expect(value).toBe(123);
    });

    it('should return a number if the string only contains digits and a decimal point', () => {
      const value = parseEnvVarValue(NAME, '12.3', SCHEMA);

      expect(value).toBe(12.3);
    });

    it('should return a number if the string only contains digits and a decimal point', () => {
      const value = parseEnvVarValue(NAME, '12.00', SCHEMA);

      expect(value).toBe(12);
    });

    it('should return a number if the string only contains digits and a decimal point', () => {
      const value = parseEnvVarValue(NAME, '12.00', SCHEMA);

      expect(value).toBe(12);
    });

    it('should return a number of the string contains a negative number with a decimal point and a negative exponent', () => {
      const value = parseEnvVarValue(NAME, '-1.23e-1', SCHEMA);

      expect(value).toBe(-0.123);
    });

    it('should return a number if the string contains leading whitespace', () => {
      const value = parseEnvVarValue(NAME, ' 12', SCHEMA);

      expect(value).toBe(12);
    });

    it('should return a number if the string contains trailing whitespace', () => {
      const value = parseEnvVarValue(NAME, '12 ', SCHEMA);

      expect(value).toBe(12);
    });

    it('should return undefined if the string has leading zeroes', () => {
      const value = parseEnvVarValue(NAME, '012', SCHEMA);

      expect(value).toBeUndefined();
    });

    it('should return undefined if the string has no digits before the decimal point', () => {
      const value = parseEnvVarValue(NAME, '.12', SCHEMA);

      expect(value).toBeUndefined();
    });

    it('should return undefined if the string is empty', () => {
      const value = parseEnvVarValue(NAME, '', SCHEMA);

      expect(value).toBeUndefined();
    });

    it('should return undefined if the string is Infinity', () => {
      const value = parseEnvVarValue(NAME, 'Infinity', SCHEMA);

      expect(value).toBeUndefined();
    });

    it('should return undefined if the string is +Infinity', () => {
      const value = parseEnvVarValue(NAME, '+Infinity', SCHEMA);

      expect(value).toBeUndefined();
    });

    it('should return undefined if the string is -Infinity', () => {
      const value = parseEnvVarValue(NAME, '-Infinity', SCHEMA);

      expect(value).toBeUndefined();
    });

    it('should return undefined if the string is a binary number', () => {
      const value = parseEnvVarValue(NAME, '0b11', SCHEMA);

      expect(value).toBeUndefined();
    });

    it('should return undefined if the string is a octal number', () => {
      const value = parseEnvVarValue(NAME, '0o11', SCHEMA);

      expect(value).toBeUndefined();
    });

    it('should return undefined if the string is a hexadecimal number', () => {
      const value = parseEnvVarValue(NAME, '0x11', SCHEMA);

      expect(value).toBeUndefined();
    });

    it('should return undefined if the string contains non-numeric characters', () => {
      const value = parseEnvVarValue(NAME, '123test', SCHEMA);

      expect(value).toBeUndefined();
    });
  });
});
