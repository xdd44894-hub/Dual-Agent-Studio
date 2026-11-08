import { constants, closeSync, existsSync, fsyncSync, fstatSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import sodium from 'libsodium-wrappers-sumo';
import type { AgentId, VaultStatus } from '../shared/api';

const MAGIC = Buffer.from('DASV\x01');
const SALT_BYTES = 16;
const NONCE_BYTES = 24;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + NONCE_BYTES;
const MAX_FILE = 32_768;
const MAX_SECRET = 4096;

type Secrets = Partial<Record<AgentId, string>>;

export class CredentialVault {
  private key?: Uint8Array;

  constructor(private readonly path: string) {}

  status(): VaultStatus {
    if (!existsSync(this.path)) return { phase: 'missing' };
    if (!this.key) return { phase: 'locked' };
    const { secrets } = this.readUnlocked();
    return { phase: 'unlocked', configured: { codex: Boolean(secrets.codex), deepseek: Boolean(secrets.deepseek) } };
  }

  async create(passphrase: string): Promise<VaultStatus> {
    await sodium.ready;
    if (existsSync(this.path)) throw new Error('凭据库已经存在。');
    const salt = randomBytes(SALT_BYTES);
    const key = this.derive(passphrase, salt);
    try {
      this.write(key, salt, {});
      this.key = key;
    } catch (error) {
      key.fill(0);
      throw error;
    }
    return this.status();
  }

  async unlock(passphrase: string): Promise<VaultStatus> {
    await sodium.ready;
    if (this.key) throw new Error('凭据库已经解锁。');
    const file = this.read();
    const key = this.derive(passphrase, this.salt(file));
    try {
      this.decrypt(file, key);
      this.key = key;
    } catch {
      key.fill(0);
      throw new Error('主密码错误，或凭据库已损坏。');
    }
    return this.status();
  }

  lock(): VaultStatus {
    this.key?.fill(0);
    this.key = undefined;
    return this.status();
  }

  set(id: AgentId, secret: string): VaultStatus {
    if (!this.key) throw new Error('请先解锁凭据库。');
    if (typeof secret !== 'string' || secret.length > MAX_SECRET || !secret.trim()) throw new Error('凭据长度无效。');
    const { salt, secrets } = this.readUnlocked();
    secrets[id] = secret;
    this.write(this.key, salt, secrets);
    return this.status();
  }

  remove(id: AgentId): VaultStatus {
    if (!this.key) throw new Error('请先解锁凭据库。');
    const { salt, secrets } = this.readUnlocked();
    delete secrets[id];
    this.write(this.key, salt, secrets);
    return this.status();
  }

  private derive(passphrase: string, salt: Uint8Array): Uint8Array {
    if (typeof passphrase !== 'string' || passphrase.length < 12 || passphrase.length > 1024) {
      throw new Error('主密码须为 12–1024 个字符。');
    }
    const password = Buffer.from(passphrase);
    try {
      return sodium.crypto_pwhash(32, password, salt, 3, 64 * 1024 * 1024, sodium.crypto_pwhash_ALG_ARGON2ID13);
    } finally {
      password.fill(0);
    }
  }

  private read(): Buffer {
    const fd = openSync(this.path, constants.O_RDONLY);
    try {
      const { size } = fstatSync(fd);
      if (size < HEADER_BYTES + 16 || size > MAX_FILE) throw new Error('凭据库文件无效。');
      const file = readFileSync(fd);
      if (file.length !== size || !file.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('凭据库格式无效或不受支持。');
      return file;
    } finally {
      closeSync(fd);
    }
  }

  private salt(file: Buffer): Buffer {
    return file.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  }

  private readUnlocked() {
    if (!this.key) throw new Error('请先解锁凭据库。');
    const file = this.read();
    return { salt: this.salt(file), secrets: this.decrypt(file, this.key) };
  }

  private decrypt(file: Buffer, key: Uint8Array): Secrets {
    const header = file.subarray(0, HEADER_BYTES);
    const nonce = header.subarray(-NONCE_BYTES);
    const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, file.subarray(HEADER_BYTES), header, nonce, key);
    try {
      return JSON.parse(Buffer.from(plaintext.buffer, plaintext.byteOffset, plaintext.byteLength).toString('utf8')) as Secrets;
    } finally {
      plaintext.fill(0);
    }
  }

  private write(key: Uint8Array, salt: Uint8Array, secrets: Secrets): void {
    const nonce = randomBytes(NONCE_BYTES);
    const header = Buffer.concat([MAGIC, salt, nonce]);
    const plaintext = Buffer.from(JSON.stringify(secrets));
    let ciphertext: Uint8Array;
    try {
      ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, header, null, nonce, key);
    } finally {
      plaintext.fill(0);
    }

    const temporary = `${this.path}.${randomBytes(12).toString('hex')}.tmp`;
    const fd = openSync(temporary, 'wx', 0o600);
    try {
      try {
        writeFileSync(fd, Buffer.concat([header, ciphertext]));
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      renameSync(temporary, this.path);
    } finally {
      rmSync(temporary, { force: true });
    }
  }
}
