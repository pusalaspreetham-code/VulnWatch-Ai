#!/usr/bin/env node
require('dotenv').config();
const advisoryCollectorService = require('../src/services/advisory_collector.service');
const pool = require('../src/db');

async function runCli() {
  console.log('\n===========================================');
  console.log('VULNWATCH AI: ADVISORY COLLECTION CLI');
  console.log('===========================================\n');

  try {
    const results = await advisoryCollectorService.collectAll();
    console.log('\nCollection Results Summary:');
    console.table(results);
    console.log('\nAdvisory collection finished successfully!\n');
  } catch (err) {
    console.error('Fatal collection error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCli();

