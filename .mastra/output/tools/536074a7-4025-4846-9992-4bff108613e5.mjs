function message(message2) {
  console.log("\x1B[32m%s\x1B[0m", message2);
}
function log(message2, data) {
  console.log("\x1B[33m%s\x1B[0m", message2, data);
}
function error(message2, data) {
  console.log("\x1B[31m%s\x1B[0m", message2, data);
}

export { error, log, message };
