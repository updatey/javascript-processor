const assert = require('assert');
const nock = require('nock');
const proxyquire = require('proxyquire');
const pkg = require('./fixtures/fakePackage.json');
const evt = require('./fixtures/fakeJSEvent.json');

class MockFirestoreCollection {
  constructor () {
    this.values = new Map();
    this.docs = new Map();
  }
  doc (name) {
    if (!this.docs.has(name)) {
      this.docs.set(name, new MockFirestoreDoc())
    }
    return this.docs.get(name);
  }
  async set (name, value) {
    this.values.set(name, value);
  }
  async get (name) {
    return this.values.get(name);
  }
}

class MockFirestoreDoc {
  constructor () {
    this.collections = new Map();
  }
  collection (name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockFirestoreCollection());
    }
    return this.collections.get(name);
  }
}

const service = proxyquire('../src/index.js', {
  '@google-cloud/firestore': MockFirestoreDoc
});

describe('javascript-processor', () => {
  it('should store dependencies', async () => {
    const basePath = 'https://api.github.com';
    const ghPath = `/repos/${evt.repo}/contents/${evt.file}`;
    const scope = nock(basePath).get(ghPath).reply(200, pkg);
    const event = {
      data: Buffer.from(JSON.stringify(evt), 'utf8')
    };
    await service.javascriptProcessor(event);
    scope.done();

    // ensure all 7 modules in the fixture response are found
    const npmModules = service.db.collection('npm-modules');
    assert.strictEqual(npmModules.docs.size, 7);

    // ensure the cloudcats package.json is the only one
    const codecov = npmModules.doc('codecov');
    const packageFiles = codecov.collection('packageFiles');
    assert.strictEqual(packageFiles.values.size, 1);

    // ensure it finds the right value
    const packageFile = packageFiles.values.get('JustinBeckwith/cloudcats/package.json');
    assert.strictEqual(packageFile.version, '^3.1.0');
  });
});

describe('npm-events', () => {
  it('should find all relevant packages', async () => {

  });
});
