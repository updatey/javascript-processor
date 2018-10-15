const Firestore = require('@google-cloud/firestore');
const db = new Firestore();
const modules = db.collection('npm-modules');

/**
 * @interface javascriptEvent
 * @property {string} repo
 * @property {string} file
 * @property {string} language
 * @property {string} event
 */

exports.javascriptProcessor = (event, context) => {
  const message = event.data;
  const data = JSON.parse(Buffer.from(message, 'base64').toString());
  console.log(data);
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
  await modules.doc(data.name).set(data);
}
