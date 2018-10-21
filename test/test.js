const assert = require('assert');
const nock = require('nock');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const pkg = require('./fixtures/fakePackage.json');
const evt = require('./fixtures/fakeJSEvent.json');
const npmEvent = require('./fixtures/fakeNpmEvent.json');
const registryResponse = require('./fixtures/fakeRegistryResponse.json');

nock.disableNetConnect();

class MockFirestoreCollection {
  constructor () {
    this.data = new Map();
  }
  doc (name) {
    if (!this.data.has(name)) {
      this.data.set(name, new MockFirestoreDoc());
    }
    return this.data.get(name);
  }
  async get () {
    return [...this.data.keys()].map(key => {
      return {
        id: key,
        data: () => {
          return this.data.get(key);
        }
      };
    });
  }
  async set (key, value) {
    this.data.set(key, value);
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

const service = proxyquire('../src', {
  '@google-cloud/firestore': MockFirestoreDoc
});

let sandbox;
beforeEach(() => {
  sandbox = sinon.createSandbox();
});
afterEach(() => {
  sandbox.restore();
});

it('should store dependencies', async () => {
  const basePath = 'https://api.github.com';
  const ghPath = `/repos/${evt.repo}/contents/${evt.file}`;
  const scope = nock(basePath).get(ghPath).reply(200, pkg);
  const stub = sandbox.stub(service, 'updateIfNeeded').resolves();
  const event = {
    data: Buffer.from(JSON.stringify(evt), 'utf8')
  };
  await service.javascriptProcessor(event);

  // ensure the API call to GitHub actually happened
  scope.done();

  // ensure the `updateIfNeeded` method was invoked
  assert(stub.called);

  // ensure all 7 modules in the fixture response are found
  const npmModules = await service.db.collection('npm-modules').get();
  assert.strictEqual(npmModules.length, 7);

  // ensure the cloudcats package.json is the only one
  const codecov = service.db.collection('npm-modules').doc('codecov');
  const packageFiles = await codecov.collection('packageFiles').get();
  assert.strictEqual(packageFiles.length, 1);

  // ensure it finds the right value
  const packageFile = packageFiles[0];
  assert.strictEqual(packageFile.id, 'JustinBeckwith/cloudcats/package.json');
  assert.strictEqual(packageFile.data().version, '^3.1.0');
});

it('should find all relevant packages', async () => {
  const event = {
    data: Buffer.from(JSON.stringify(npmEvent), 'utf8')
  };
  const stub = sandbox.stub(service, 'updateIfNeeded').resolves();
  await service.npmEvent(event);
  assert.strictEqual(stub.called, true);

  // TODO: go beyond basic tests to verify the times called
});

it('should update if needed', async () => {
  const fakePackageFile = '/does/not/exist/package.json';
  const fakeDep = 'retry-axios';
  const fakeVersion = '^0.2.0';
  const scope = nock('https://registry.npmjs.org').get('/retry-axios').reply(200, registryResponse);
  await service.updateIfNeeded(fakePackageFile, fakeDep, fakeVersion);
  scope.done();
});
