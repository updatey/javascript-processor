
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

exports.npmEvent = (event, context) => {
  const message = event.data;
  const data = JSON.parse(Buffer.from(message, 'base64').toString());
  console.log(data);
}
