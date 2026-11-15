const PLAYGROUND_APP_NAME = 'playground-app'

const PLAYGROUND_FLOW_MODEL = {
  name: 'MockOrderFlow',
  nodes: [
    {
      id: 'script-node-1',
      name: 'script-node-1',
      type: 'script',
    },
  ],
}

const BASE_SNAPSHOT = {
  languageProjectionHints: {},
  javaImports: ['java.time.LocalDate'],
  javaTypes: [
    {
      qualifiedName: 'java.time.LocalDate',
      simpleName: 'LocalDate',
      packageName: 'java.time',
      constructors: [
        {
          name: 'LocalDate',
          memberKind: 'constructor',
          parameterTypeDisplayNames: ['int', 'int', 'int'],
        },
      ],
      staticMethods: [
        {
          name: 'now',
          memberKind: 'method',
          returnTypeDisplayName: 'LocalDate',
          parameterTypeDisplayNames: [],
        },
      ],
      staticFields: [
        {
          name: 'MIN',
          memberKind: 'field',
          returnTypeDisplayName: 'LocalDate',
        },
      ],
      instanceMethods: [
        {
          name: 'getYear',
          memberKind: 'method',
          returnTypeDisplayName: 'int',
          parameterTypeDisplayNames: [],
        },
      ],
    },
  ],
  globals: [
    {
      name: '$input',
      kind: 'object',
      typeDisplayName: 'OrderInput',
      documentation: 'Logicflow node input payload',
      members: [
        {
          name: 'orderId',
          memberKind: 'field',
          returnTypeDisplayName: 'String',
        },
        {
          name: 'submittedAt',
          memberKind: 'field',
          returnTypeDisplayName: 'LocalDate',
        },
        {
          name: 'toMap',
          memberKind: 'method',
          returnTypeDisplayName: 'Map',
          parameterTypeDisplayNames: [],
        },
      ],
    },
    {
      name: 'LocalDate',
      kind: 'class',
      typeDisplayName: 'java.time.LocalDate',
      qualifiedTypeName: 'java.time.LocalDate',
    },
  ],
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function buildPlaygroundMockSnapshot(request) {
  const language = request && request.language ? request.language : 'unknown'
  return Object.assign(cloneJson(BASE_SNAPSHOT), {
    source: 'playground-mock',
    runtimeProfile: 'playground-mock',
    versionToken: `${language}-playground-v1`,
  })
}

module.exports = {
  PLAYGROUND_APP_NAME,
  PLAYGROUND_FLOW_MODEL,
  buildPlaygroundMockSnapshot,
}
