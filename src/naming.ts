import { snakeCase } from 'lodash';
import { EnvVarNamingOptions } from './common';
import { ConfigPropertyPath } from './walking';

export function transformPropertyName(
  name: string,
  options: EnvVarNamingOptions
): string {
  if (options.case === 'snake_case') {
    return snakeCase(name);
  }

  return snakeCase(name).toUpperCase();
}

export function getEnvVarName(
  configPropertyPath: ConfigPropertyPath,
  options: EnvVarNamingOptions
): string {
  const name = configPropertyPath
    .map((pathItem) => {
      if (pathItem.named) {
        return transformPropertyName(pathItem.value, options);
      }
      return pathItem.value;
    })
    .join(options.propertySeparator);

  if (options.prefix) {
    return options.prefix + options.propertySeparator + name;
  }

  return name;
}
