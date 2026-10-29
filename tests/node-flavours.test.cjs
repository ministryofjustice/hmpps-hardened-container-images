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
  for (const result of [
    { error: 'auth failed' }, {}, [], null, { vulnerabilities: [null] },
    { vulnerabilities: [{ severity: 'unknown' }] },
    { vulnerabilities: [], applications: {} },
    { vulnerabilities: [], applications: [{ error: 'application scan failed' }] },
    { vulnerabilities: [], applications: [null] },
    { vulnerabilities: [], applications: [{ vulnerabilities: [{ severity: 'unknown' }] }] },
  ]) {
    assert.throws(() => countVulnerabilities(result));
  }
});

test('counts nested Snyk container application findings even when OS findings are empty', () => {
  const report = {
    ok: true,
    vulnerabilities: [],
    applications: [{
      ok: false,
      vulnerabilities: [
        ...Array.from({ length: 1935 }, () => ({ severity: 'high' })),
        ...Array.from({ length: 986 }, () => ({ severity: 'medium' })),
      ],
    }],
  };
  assert.deepEqual(countVulnerabilities(report), { critical: 0, high: 1935, medium: 986, low: 0 });
  assert.deepEqual(countVulnerabilities([
    report,
    { vulnerabilities: [{ severity: 'critical' }], applications: [
      { vulnerabilities: [{ severity: 'low' }] },
      { vulnerabilities: [{ severity: 'high' }] },
    ] },
  ]), { critical: 1, high: 1936, medium: 986, low: 1 });
  assert.deepEqual(countVulnerabilities({ vulnerabilities: [], applications: [{ vulnerabilities: [] }] }),
    { critical: 0, high: 0, medium: 0, low: 0 });
});

test('checks Node/npm majors and requires both npm and apk in builds', () => {
  const runtime = { node: 'v24.22.1', npm: '11.12.1', managers };
  validateVersions(runtime, '24', '11', 'apko');
  assert.throws(() => validateVersions(runtime, '26', '11', 'apko'));
  assert.throws(() => validateVersions(runtime, '24', '12', 'apko'));
  assert.throws(() => validateVersions({ ...runtime, managers: { ...managers, apk: false } }, '24', '11', 'apko'));
});

test('Docker and apko runtimes reject every package manager', () => {
  for (const backend of ['docker', 'apko']) {
    for (const manager of Object.keys(managers)) {
      assert.throws(() => validateVersions({ node: 'v26.12.1', managers: { [manager]: true } }, '26', '', backend));
    }
    validateVersions({ node: 'v26.12.1', managers: {} }, '26', '', backend);
  }
});

test('comparison pairs configured flavours and distinguishes missing scans from zero findings', () => {
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

test('comparison ticks rank severity before totals and handle ties or unavailable counterparts', () => {
  const row = (backend, vulnerabilities, scanStatus = 'success') => ({
    comparison: 'runtime-24', backend, vulnerabilities, scanStatus,
    node: 'v24.22.1', managers: {}, bytes: 1048576, seconds: 1,
  });
  const counts = (critical, high, medium, low) => ({ critical, high, medium, low });
  const dockerLine = report => report.split('\n').find(line => line.startsWith('| runtime-24 | docker |'));
  const apkoLine = report => report.split('\n').find(line => line.startsWith('| runtime-24 | apko |'));
  for (const [docker, apko] of [
    [counts(1, 0, 0, 0), counts(0, 100, 100, 100)],
    [counts(0, 1, 0, 0), counts(0, 0, 100, 100)],
    [counts(0, 0, 1, 0), counts(0, 0, 0, 100)],
    [counts(0, 0, 0, 1), counts(0, 0, 0, 0)],
  ]) {
    const report = summary([row('docker', docker), row('apko', apko)]);
    assert.match(apkoLine(report), /✅ Fewer findings/);
    assert.match(dockerLine(report), /More findings/);
    const reversed = summary([row('docker', apko), row('apko', docker)]);
    assert.match(dockerLine(reversed), /✅ Fewer findings/);
  }
  const zero = counts(0, 0, 0, 0);
  assert.match(dockerLine(summary([row('docker', zero), row('apko', zero)])), /Tie/);
  for (const counterpart of [undefined, row('apko', null), row('apko', zero, 'failure')]) {
    const report = summary([row('docker', zero), ...(counterpart ? [counterpart] : [])]);
    assert.match(dockerLine(report), /Cannot compare/);
    assert.doesNotMatch(dockerLine(report), /✅/);
  }
  assert.throws(() => summary([row('docker', counts(-1, 0, 0, 0)), row('apko', zero)]), /Invalid critical/);
});

test('per-flavour reports include only their pair while the full report retains every pair', () => {
  const flavours = ['build-24-npm11', 'build-24-npm12', 'build-26-npm12', 'runtime-24', 'runtime-26'];
  for (const flavour of flavours) {
    const report = summary([], flavour);
    assert.equal(report.split('\n').filter(line => /^\| (build-|runtime-)/.test(line)).length, 2);
    assert.match(report, new RegExp(`AMD64\\): ${flavour}`));
    for (const other of flavours.filter(value => value !== flavour)) assert.ok(!report.includes(other));
  }
  assert.equal(summary([]).split('\n').filter(line => /^\| (build-|runtime-)/.test(line)).length, 10);
  assert.throws(() => summary([], 'invalid'), /Unknown comparison flavour/);
});

test('workflow covers matching Docker/apko pairs with correctly pinned npm APKs', () => {
  const workflow = JSON.parse(execFileSync('ruby', [
    '-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.safe_load(File.read(ARGV[0]), aliases: true))', '.github/workflows/build-images.yml',
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
  const scanner = workflow.jobs['publish-scanners'].strategy.matrix.include.find(entry => entry.scanners);
  assert.ok(scanner);
  assert.ok(!scanner.flavour);
  assert.ok(!scanner.comparison);
});
