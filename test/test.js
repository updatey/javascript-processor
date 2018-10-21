const assert = require('assert');
const nock = require('nock');
const proxyquire = require('proxyquire');
const pkg = require('./fixtures/fakePackage.json');
const evt = require('./fixtures/fakeJSEvent.json');

class MockFirestoreCollection {
  constructor () {
    this.values = new Map();
  }
  doc (name) {
    return new MockFirestoreDoc();
  }
  async set (name, value) {
    this.values.set(name, value);
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
  it('should update dependencies', async () => {
    const basePath = 'https://api.github.com';
    const ghPath = `/repos/${evt.repo}/contents/${evt.file}`;
    const scope = nock(basePath).get(ghPath).reply(200, pkg);
    const event = {
      data: Buffer.from(JSON.stringify(evt), 'utf8')
    };
    await service.javascriptProcessor(event);
    scope.done();
    assert(true);
  });
});
