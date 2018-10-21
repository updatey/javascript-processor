const Firestore = require('@google-cloud/firestore');
const axios = require('axios');

const db = new Firestore();

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
  ['dependencies', 'devDependencies'].forEach(deps => {
    if (packageJson[deps]) {
      Object.keys(packageJson[deps]).forEach(async dep => {
        console.log(`Updating dep: ${dep}`);
        await db.collection('npm-modules')
          .doc(dep)
          .collection('packageFiles')
          .set(docPath, {
            path: docPath,
            version: packageJson.dependencies[dep]
          });
      });
    }
  });
};

/**
 * @interface npmEvent
 * @property {string} name
 * @property {string} version
 */

exports.npmEvent = async (event, context) => {
  const message = event.data;
  const data = JSON.parse(Buffer.from(message, 'base64').toString());
  console.log(data);
  // query all repos that use this package
  const snapshot = await db.collection('npm-modules').doc(data.name).collection('packageFiles');
  snapshot.forEach(doc => {
    console.log(JSON.stringify(doc));
  });
};
