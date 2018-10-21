const Firestore = require('@google-cloud/firestore');
const axios = require('axios');
const semver = require('semver');

const db = new Firestore();
exports.db = db;

/**
 * @interface javascriptEvent
 * @property {string} repo - owner/repoName
 * @property {string} file - package.json
 * @property {string} language - JavaScript
 * @property {string} event - 🤷‍♂️
 */

/**
  * When a package.json file has been added or changed,
  * do the following stuff:
  * - Fetch the file from GitHub
  * - Iterate over dependencies and devDependencies
  * - Save the collection of paths that reference the dep
  * - Trigger the check workflow for that dep/repo combo
  */
exports.javascriptProcessor = async (event, context) => {
  const message = event.data;
  const data = JSON.parse(Buffer.from(message, 'base64').toString());
  const docPath = `${data.repo}/${data.file}`;
  const url = `https://api.github.com/repos/${data.repo}/contents/${data.file}`;
  const res = await axios.get(url);
  const packageJson = res.data;
  await Promise.all(['dependencies', 'devDependencies'].map(async deps => {
    if (packageJson[deps]) {
      await Promise.all(
        Object.keys(packageJson[deps]).map(async dep => {
          try {
            const version = packageJson[deps][dep];
            await db.collection('npm-modules')
              .doc(dep)
              .collection('packageFiles')
              .set(docPath, {
                path: docPath,
                version
              });
            await exports.updateIfNeeded(docPath, dep, version);
          } catch (e) {
            console.error(e);
          }
        })
      );
    }
  }));
};

/**
 * @interface npmEvent
 * @property {string} name
 * @property {string} version
 */

exports.npmEvent = async (event, context) => {
  const message = event.data;
  const data = JSON.parse(Buffer.from(message, 'base64').toString());
  const dep = data.name;
  // query all repos that use this package
  const snapshot = await db.collection('npm-modules').doc(dep).collection('packageFiles').get();
  // TODO: this may need to be throttled with p-queue
  await Promise.all(
    snapshot.map(async doc => {
      const packageFile = doc.data().path;
      const version = doc.data().version;
      await exports.updateIfNeeded(packageFile, dep, version);
    })
  );
};

/**
 * Check to see if a dependency requires an update
 */
exports.updateIfNeeded = async (packageFile, dep, version) => {
  const {data} = await axios.get(`https://registry.npmjs.org/${dep}`);
  if (!data['dist-tags']) {
    return;
  }
  const {latest} = data['dist-tags'];
  if (!latest) {
    return;
  }
  const needs = !semver.satisfies(latest, version);
  if (needs) {
    console.log(`Updating ${dep} in package ${packageFile}`);
  }
};
