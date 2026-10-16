import { EncryptionConfig } from "../core/config/encryption.config";

export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5251/api',

encryption: <EncryptionConfig>{
    encryptionenabled: true,
    decryptionenabled:true,
    urlPrefixes: ['/api/v1/Products'],
    aesKeyBase64: 'q83vV6Xc1k2Z7lP4mYt9sQ2xW8rJ0nF5uK3aD6bH9cE=',
  },
  };