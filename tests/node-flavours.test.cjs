const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { countVulnerabilities, validateVersions, summary } = require('../scripts/node-image-metrics.cjs');

const managers = { apk: true, npm: true, npx: true, yarn: false, yarnpkg: false, corepack: false, pnpm: false };

test('comparison CLI reports every missing build when no artifacts exist', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'node-metrics-'));
  try {
    const report = execFileSync(process.execPath, ['scripts/node-image-metrics.cjs', 'summary', directory], { encoding: 'utf8' });
    assert.equal((report.match(/Missing \/ failed build/g) || []).length, 10);
  } finally {
    fs.rmdirSync(directory);
  }
});

test('counts every supported severity across multiple Snyk results', () => {
  const result = countVulnerabilities([
    { vulnerabilities: [{ severity: 'critical' }, { severity: 'high' }] },
    { vulnerabilities: [{ severity: 'medium' }, { severity: 'low' }, { severity: 'high' }] },
  ]);
  assert.deepEqual(result, { critical: 1, high: 2, medium: 1, low: 1 });
  assert.deepEqual(countVulnerabilities({ vulnerabilities: [] }), { critical: 0, high: 0, medium: 0, low: 0 });
});

test('scan errors, missing results and unknown severities never become zero findings', () => {
  for (const result of [{ error: 'auth failed' }, {}, [], { vulnerabilities: [{ severity: 'unknown' }] }]) {
    assert.throws(() => countVulnerabilities(result));
  }
});

test('checks Node/npm majors and requires both npm and apk in builds', () => {
  const runtime = { node: 'v24.22.1', npm: '11.12.1', managers };
  validateVersions(runtime, '24', '11', 'apko');
  assert.throws(() => validateVersions(runtime, '26', '11', 'apko'));
  assert.throws(() => validateVersions(runtime, '24', '12', 'apko'));
  assert.throws(() => validateVersions({ ...runtime, managers: { ...managers, apk: false } }, '24', '11', 'apko'));
});

test('apko runtimes reject every package manager while Docker baselines remain observational', () => {
  for (const manager of Object.keys(managers)) {
    assert.throws(() => validateVersions({ node: 'v26.12.1', managers: { [manager]: true } }, '26', '', 'apko'));
  }
  validateVersions({ node: 'v26.12.1', managers: {} }, '26', '', 'apko');
  validateVersions({ node: 'v24.22.1', managers }, '24', '', 'docker');
});

test('comparison pairs all five flavours and distinguishes missing scans from zero findings', () => {
  const report = summary([
    { comparison: 'build-24-npm11', backend: 'docker', node: 'v24.22.1', npm: '11.12.1', managers, bytes: 10485760, seconds: 42, vulnerabilities: null },
    { comparison: 'build-24-npm11', backend: 'apko', node: 'v24.22.1', npm: '11.12.1', managers, bytes: 5242880, seconds: 21, vulnerabilities: { critical: 0, high: 2, medium: 3, low: 4 } },
  ]);
  assert.match(report, /10\.0 \| 42 \| N\/A \| N\/A \| N\/A \| N\/A/);
  assert.match(report, /5\.0 \| 21 \| 0 \| 2 \| 3 \| 4/);
  assert.equal((report.match(/Missing \/ failed build/g) || []).length, 8);
  assert.match(report, /runtime-26/);
  assert.throws(() => summary([
    { comparison: 'runtime-24', backend: 'apko' },
    { comparison: 'runtime-24', backend: 'apko' },
  ]));
});

test('rendering keeps shared trust/accounts and isolates all five flavour contracts', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'node-flavours-'));
  const baseFile = path.resolve(__dirname, '../images/node/alpine-runtime/apko.yaml');
  const original = fs.readFileSync(baseFile, 'utf8');
  try {
    for (const [major, flavour] of [['24', 'build'], ['26', 'build'], ['24', 'runtime'], ['26', 'runtime']]) {
      const output = path.join(directory, `${major}-${flavour}.yaml`);
      execFileSync('ruby', ['scripts/render-node-apko.rb', major, flavour, output]);
      const config = JSON.parse(execFileSync('ruby', ['-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.load_file(ARGV[0]))', output]));
      assert.equal(config.contents.packages.includes('apk-tools'), flavour === 'build');
      assert.ok(config.contents.packages.includes(major === '24' ? 'nodejs~24' : 'nodejs-current~26'));
      assert.ok(!config.contents.packages.some(p => /npm|corepack|yarn/.test(p)));
      assert.ok(config.contents.repositories.every(r => r.includes('/v3.24/')));
      assert.match(config.certificates.additional[0].content, /BEGIN CERTIFICATE/);
      assert.equal(config.accounts.users[0].uid, 2000);
      assert.equal(config.environment.NODE_ENV, flavour === 'build' ? 'development' : 'production');
    }
    assert.equal(fs.readFileSync(baseFile, 'utf8'), original);
    assert.throws(() => execFileSync('ruby', ['scripts/render-node-apko.rb', '28', 'runtime', path.join(directory, 'bad.yaml')], { stdio: 'pipe' }));
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test('workflow covers matching Docker/apko pairs with correctly pinned npm APKs', () => {
  const workflow = JSON.parse(execFileSync('ruby', [
    '-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.load_file(ARGV[0]))', '.github/workflows/build-images.yml',
  ]));
  const matrix = workflow.jobs['build-scan-push'].strategy.matrix.include;
  const comparisons = matrix.filter(entry => entry.comparison);
  assert.equal(comparisons.length, 10);
  for (const flavour of ['build-24-npm11', 'build-24-npm12', 'build-26-npm12', 'runtime-24', 'runtime-26']) {
    assert.deepEqual(comparisons.filter(entry => entry.comparison === flavour).map(entry => entry.backend).sort(), ['apko', 'docker']);
  }
  for (const entry of comparisons.filter(entry => entry.backend === 'apko' && entry.flavour === 'build')) {
    const recipe = JSON.parse(execFileSync('ruby', [
      '-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.load_file(ARGV[0]))', entry.melange_config,
    ]));
    assert.equal(entry.melange_package, `${recipe.package.name}=${recipe.package.version}-r${recipe.package.epoch}`);
  }
  const scanner = matrix.find(entry => entry.scanners);
  assert.ok(scanner);
  assert.equal(scanner.flavour, undefined);
  assert.equal(scanner.comparison, undefined);
});
