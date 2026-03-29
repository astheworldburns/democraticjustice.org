#!/usr/bin/env node

import crypto from 'node:crypto';

function printUsage() {
  console.log(`Usage:
  node scripts/cms-user.mjs add --email editor@example.com --name "Jane Doe" --password "secret" --role editor
  node scripts/cms-user.mjs remove --email editor@example.com
  node scripts/cms-user.mjs list`);
}

function parseArgs(argv) {
  const command = argv[0];
  const options = {};

  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (!key) {
      throw new Error('Invalid option: --');
    }

    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    options[key] = value;
    i += 1;
  }

  return { command, options };
}

function requiredOption(options, name) {
  const value = options[name];
  if (!value) {
    throw new Error(`Missing required option --${name}`);
  }
  return value;
}

function buildAddOutput(options) {
  const email = requiredOption(options, 'email');
  const name = requiredOption(options, 'name');
  const password = requiredOption(options, 'password');
  const role = requiredOption(options, 'role');

  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

  const kvKey = `user:${email}`;
  const kvValue = {
    id: crypto.randomUUID(),
    name,
    role,
    password_hash: hash.toString('base64'),
    password_salt: salt.toString('base64'),
  };

  const kvJson = JSON.stringify(kvValue);

  console.log(`KV Key: ${kvKey}`);
  console.log(`KV Value: ${kvJson}`);
  console.log('');
  console.log(`wrangler kv key put --namespace-id NAMESPACE_ID "${kvKey}" '${kvJson}'`);
}

function buildRemoveOutput(options) {
  const email = requiredOption(options, 'email');
  const kvKey = `user:${email}`;
  console.log(`wrangler kv key delete --namespace-id NAMESPACE_ID "${kvKey}"`);
}

function buildListOutput() {
  console.log('wrangler kv key list --namespace-id NAMESPACE_ID --prefix "user:"');
}

function printNamespaceReminder() {
  console.log('');
  console.log('Reminder: Replace NAMESPACE_ID with the actual KV namespace ID from wrangler.toml.');
}

function main() {
  try {
    const { command, options } = parseArgs(process.argv.slice(2));

    if (!command || command === '--help' || command === '-h') {
      printUsage();
      process.exit(0);
    }

    if (command === 'add') {
      buildAddOutput(options);
      printNamespaceReminder();
      return;
    }

    if (command === 'remove') {
      buildRemoveOutput(options);
      printNamespaceReminder();
      return;
    }

    if (command === 'list') {
      if (Object.keys(options).length > 0) {
        throw new Error('The list command does not accept options');
      }
      buildListOutput();
      printNamespaceReminder();
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error('');
    printUsage();
    process.exit(1);
  }
}

main();
