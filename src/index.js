/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event Event payload.
 * @param {!Object} context Metadata for the event.
 */
exports.javascriptProcessor = (event, context) => {
  const message = event.data;
  console.log(Buffer.from(message, 'base64').toString());
};
