declare module 'yaml-schema-validator' {
  export interface YamlSchemaValidationError {
    path?: string | null
    message: string
  }

  export default function validateSchema(
    file: string,
    options: {schema: string; logLevel?: string}
  ): YamlSchemaValidationError[]
}
