#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { load } from './loader.js';
import { YAMLException } from './exception.js';

const args = process.argv.slice(2);

let filename: string | null = null;
let trace = false;

for (const arg of args) {
  if (arg === '-h' || arg === '--help') {
    console.log(`Usage: yamlite <filename> [-t]

Parse a YAML file and print its JSON representation.

Options:
  -h, --help     Show this help message
  -t, --trace    Show full stack trace on error`);
    process.exit(0);
  } else if (arg === '-t' || arg === '--trace') {
    trace = true;
  } else if (!arg.startsWith('-')) {
    filename = arg;
  }
}

if (!filename) {
  console.error('Error: no input file specified. Use -h for help.');
  process.exit(1);
}

try {
  const content = readFileSync(filename, 'utf8');
  const result = load(content, { filename });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  if (err instanceof YAMLException) {
    console.error(err.toString(true));
    if (trace) {
      console.error(err.stack);
    }
    process.exit(1);
  }
  throw err;
}
