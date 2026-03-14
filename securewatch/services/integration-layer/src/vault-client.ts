/**
 * Vault client — all secrets fetched from HashiCorp Vault at startup.
 * Rule S4: Zero secrets in code, config files, or environment variables.
 */

interface VaultSecret {
  data: Record<string, string>;
}

export interface AppSecrets {
  kafkaBrokers: string;
  redisHost: string;
  redisPort: number;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}

async function fetchSecret(vaultAddr: string, token: string, path: string): Promise<Record<string, string>> {
  const url = `${vaultAddr}/v1/${path}`;
  const res = await fetch(url, {
    headers: { 'X-Vault-Token': token },
  });

  if (!res.ok) {
    throw new Error(`Vault fetch failed for path ${path}: ${res.status}`);
  }

  const body = (await res.json()) as VaultSecret;
  return body.data;
}

export async function loadSecrets(): Promise<AppSecrets> {
  const vaultAddr = process.env['VAULT_ADDR'];
  const vaultToken = process.env['VAULT_TOKEN'];

  if (!vaultAddr || !vaultToken) {
    throw new Error('VAULT_ADDR and VAULT_TOKEN must be set');
  }

  const [kafka, redis, db] = await Promise.all([
    fetchSecret(vaultAddr, vaultToken, 'secret/securewatch/kafka'),
    fetchSecret(vaultAddr, vaultToken, 'secret/securewatch/redis'),
    fetchSecret(vaultAddr, vaultToken, 'secret/securewatch/db/postgres'),
  ]);

  return {
    kafkaBrokers: kafka['brokers'] ?? '',
    redisHost:    redis['host'] ?? '',
    redisPort:    parseInt(redis['port'] ?? '6379', 10),
    dbHost:       db['host'] ?? '',
    dbPort:       parseInt(db['port'] ?? '5432', 10),
    dbName:       db['name'] ?? '',
    dbUser:       db['user'] ?? '',
    dbPassword:   db['password'] ?? '',
  };
}
