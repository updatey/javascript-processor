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
 * @interface NpmEvent
 * @property {string} name
 * @property {string} version
 */

/**
 * Invoked when an npm module is updated, triggered via the npm registry.
 * @param event {NpmEvent} The { name, version } combo of the updated npm module
 * @param context {🤷‍♂️}
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
 * @param {string} packageFile The path to the package.json to be updated
 * @param {string} dep The name of the npm module to be updated
 * @param {string} version The currently used version of the dependency in package.json
 * @returns {Promise<void>}
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
    let prefix = '';
    if (version.startsWith('~')) {
      prefix = '~';
    } else if (version.startsWith('^')) {
      prefix = '^';
    }
    const newVersion = prefix + latest;
    console.log(`Updating ${dep} in package ${packageFile} from ${version} to ${newVersion}`);
    exports.sendPR(packageFile);
  }
};

/**
 * Checks to see if a PR for the given version exists, and if not,
 * sends a new PR to update the module.
 * @param packageFile {string} The path to the package.json to be updated.
 * @param dep {string} The npm module to be udpated
 * @param version {string} The new version for the given dependency
 * @returns {Promise<void>}
 */
exports.sendPR = async (packageFile, dep, version) => {

  // Check to see if we've already sent a PR for this packageFile/dep combo
  const records = await db.collection('prs')
    .where('path', '==', packageFile)
    .where('dep', '==', dep)
    .get();

  if (records.length === 0) {
    // There are no PRs on file for this combo.  Go ahead and send one!
    return;
  }

  // We have already sent a PR. Let's check the current status.
  const pr = records[0].data();

  if (pr.closed) {
    // This PR was opened, and then closed.  Move along.
    return;
  }

  if (pr.hasUserCommits) {
    // This PR has commits from someone that ain't us. Move along.
    return;
  }

  if (pr.newVersion !== version) {
    // The submitted PR is for a different version than the current PR that's
    // open.  Let's push another commit to the existing PR.
    return;
  }

};
