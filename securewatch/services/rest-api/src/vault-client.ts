/**
 * Vault client for REST API — loads secrets at startup.
 * Rule S4: Zero secrets in code or config files.
 */

interface VaultSecret {
  data: Record<string, string>;
}

export interface RestApiSecrets {
  jwtPublicKey: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  redisHost: string;
  redisPort: number;
  kafkaBrokers: string;
  hmacKey: string;
}

async function fetchSecret(
  vaultAddr: string,
  token: string,
  path: string,
): Promise<Record<string, string>> {
  const res = await fetch(`${vaultAddr}/v1/${path}`, {
    headers: { 'X-Vault-Token': token },
  });
  if (!res.ok) throw new Error(`Vault fetch failed for ${path}: ${res.status}`);
  const body = (await res.json()) as VaultSecret;
  return body.data;
}

export async function loadSecrets(): Promise<RestApiSecrets> {
  const vaultAddr = process.env['VAULT_ADDR'];
  const vaultToken = process.env['VAULT_TOKEN'];
  if (!vaultAddr || !vaultToken) {
    throw new Error('VAULT_ADDR and VAULT_TOKEN must be set');
  }

  const [jwt, db, redis, kafka, hmac] = await Promise.all([
    fetchSecret(vaultAddr, vaultToken, 'secret/securewatch/jwt/public'),
    fetchSecret(vaultAddr, vaultToken, 'secret/securewatch/db/postgres'),
    fetchSecret(vaultAddr, vaultToken, 'secret/securewatch/redis'),
    fetchSecret(vaultAddr, vaultToken, 'secret/securewatch/kafka'),
    fetchSecret(vaultAddr, vaultToken, 'secret/securewatch/hmac/audit'),
  ]);

  return {
    jwtPublicKey:  jwt['key'] ?? '',
    dbHost:        db['host'] ?? '',
    dbPort:        parseInt(db['port'] ?? '5432', 10),
    dbName:        db['name'] ?? '',
    dbUser:        db['user'] ?? '',
    dbPassword:    db['password'] ?? '',
    redisHost:     redis['host'] ?? '',
    redisPort:     parseInt(redis['port'] ?? '6379', 10),
    kafkaBrokers:  kafka['brokers'] ?? '',
    hmacKey:       hmac['key'] ?? '',
  };
}
