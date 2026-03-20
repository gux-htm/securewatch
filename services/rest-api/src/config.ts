// All configuration is read from environment variables.
// No hardcoded values. See .env.example for required variables.

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  server: {
    host:    optional('API_HOST', '0.0.0.0'),
    port:    parseInt(optional('API_PORT', '3001'), 10),
    nodeEnv: optional('NODE_ENV', 'development'),
  },
  db: {
    host:     optional('DB_HOST', 'localhost'),
    port:     parseInt(optional('DB_PORT', '3306'), 10),
    user:     optional('DB_USER', 'root'),
    password: optional('DB_PASSWORD', ''),
    name:     optional('DB_NAME', 'securewatch'),
  },
  jwt: {
    privateKeyPath:      optional('JWT_PRIVATE_KEY_PATH', ''),
    publicKeyPath:       optional('JWT_PUBLIC_KEY_PATH', ''),
    expiresIn:           optional('JWT_EXPIRES_IN', '8h'),
    mfaIssuer:           optional('MFA_ISSUER', 'SecureWatch'),
  },
  security: {
    hmacSecret:    optional('HMAC_SECRET', 'change_this_to_a_random_64_char_string'),
    bcryptRounds:  parseInt(optional('BCRYPT_ROUNDS', '12'), 10),
  },
  kafka: {
    brokers:  optional('KAFKA_BROKERS', 'localhost:9092').split(','),
    clientId: optional('KAFKA_CLIENT_ID', 'securewatch-rest-api'),
    consumerGroups: {
      authEngine:         'sw-auth-engine',
      resourceEngine:     'sw-resource-engine',
      integrationMonitor: 'sw-integration-monitor',
      auditWriter:        'sw-audit-writer',
      alertManager:       'sw-alert-manager',
    },
    topics: {
      sessionEvents:     'sw.events.session',
      resourceEvents:    'sw.events.resource',
      integrationEvents: 'sw.events.integration',
      systemEvents:      'sw.events.system',
      alertsOutbound:    'sw.alerts.outbound',
    },
  },
} as const;
